import { initDB, runQuery, getQuery, allQuery } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', async ({ playerName, playerId }) => {
      const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
      try {
        await runQuery('INSERT INTO rooms (id, status) VALUES (?, ?)', [roomId, 'LOBBY']);
        
        // Remove player if exists to avoid UNIQUE constraint violation
        await runQuery('DELETE FROM players WHERE id = ?', [playerId]);
        
        await runQuery(
          'INSERT INTO players (id, room_id, name, is_host, socket_id, is_alive) VALUES (?, ?, ?, ?, ?, ?)',
          [playerId, roomId, playerName, 1, socket.id, 1]
        );
        
        socket.join(roomId);
        await broadcastRoomState(io, roomId);
      } catch (err) {
        console.error(err);
        socket.emit('error', 'Could not create room');
      }
    });

    socket.on('join_room', async ({ roomId, playerName, playerId }) => {
      try {
        const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [roomId]);
        if (!room) return socket.emit('error', 'Room not found');
        if (room.status !== 'LOBBY') return socket.emit('error', 'Game already started');

        // Check if player exists, if so update socket
        const existingPlayer = await getQuery('SELECT * FROM players WHERE id = ?', [playerId]);
        if (existingPlayer) {
             await runQuery('UPDATE players SET socket_id = ?, room_id = ?, name = ? WHERE id = ?', [socket.id, roomId, playerName, playerId]);
        } else {
             await runQuery(
              'INSERT INTO players (id, room_id, name, is_host, socket_id, is_alive) VALUES (?, ?, ?, ?, ?, ?)',
              [playerId, roomId, playerName, 0, socket.id, 1]
            );
        }

        socket.join(roomId);
        await broadcastRoomState(io, roomId);
      } catch (err) {
        console.error(err);
        socket.emit('error', 'Could not join room');
      }
    });

    socket.on('start_game', async ({ roomId }) => {
      try {
        // Only host check (simplified, trust socket context or verify db)
        // Ideally check if socket.id belongs to host of roomId
        const players = await allQuery('SELECT * FROM players WHERE room_id = ?', [roomId]);
        if (players.length < 4) {
            // Allow for testing with fewer, but warn?
            // return socket.emit('error', 'Not enough players');
        }

        // Assign Roles
        let roles = [];
        let mafiaCount = players.length < 9 ? 1 : 2;
        let doctorCount = 1;
        let policeCount = 1;
        let villagerCount = players.length - mafiaCount - doctorCount - policeCount;
        
        // Fix negative villagers for small tests
        if (villagerCount < 0) {
             mafiaCount = 1; doctorCount = 0; policeCount = 0;
             villagerCount = players.length - 1;
        }

        for (let i = 0; i < mafiaCount; i++) roles.push('MAFIA');
        for (let i = 0; i < doctorCount; i++) roles.push('DOCTOR');
        for (let i = 0; i < policeCount; i++) roles.push('POLICE');
        for (let i = 0; i < villagerCount; i++) roles.push('VILLAGER');

        roles = roles.sort(() => Math.random() - 0.5);

        // Update DB
        for (let i = 0; i < players.length; i++) {
          await runQuery('UPDATE players SET role = ?, action_target = NULL WHERE id = ?', [roles[i], players[i].id]);
        }

        const endTime = Date.now() + 30000; // 30s
        await runQuery('UPDATE rooms SET status = ?, phase_end_time = ? WHERE id = ?', ['NIGHT', endTime, roomId]);
        
        await broadcastRoomState(io, roomId);

        // Start Server Timer
        startPhaseTimer(io, roomId, 30000);

      } catch (err) {
        console.error(err);
      }
    });

    socket.on('action', async ({ roomId, targetId, playerId }) => {
       try {
           await runQuery('UPDATE players SET action_target = ? WHERE id = ?', [targetId, playerId]);
           // Emit update to room so mafias can see each other (filtered on client) or just generic update
           await broadcastRoomState(io, roomId);
       } catch (err) {
           console.error(err);
       }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Optional: Handle cleanup or waiting for reconnect
    });

    socket.on('reset_server', async () => {
      try {
        console.log('RESETTING SERVER...');
        // Clean DB
        await runQuery('DELETE FROM players');
        await runQuery('DELETE FROM rooms');
        
        // Notify all clients to reload/reset state
        io.emit('server_reset');
        
        // Exit process to force restart (nodemon will handle it)
        setTimeout(() => {
          process.exit(0);
        }, 1000);
      } catch (err) {
        console.error(err);
        socket.emit('error', 'Reset failed');
      }
    });
  });
};

const broadcastRoomState = async (io, roomId) => {
  const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [roomId]);
  const players = await allQuery('SELECT * FROM players WHERE room_id = ?', [roomId]);
  
  // Transform to format expected by frontend
  const roomData = {
    id: room.id,
    status: room.status,
    phaseEndTime: room.phase_end_time,
    lastNightResult: room.last_night_result,
    winner: room.winner,
    players: {}
  };
  
  players.forEach(p => {
    roomData.players[p.id] = {
      id: p.id,
      name: p.name,
      role: p.role,
      isAlive: !!p.is_alive,
      isHost: !!p.is_host,
      actionTarget: p.action_target
    };
  });

  io.to(roomId).emit('room_update', roomData);
};

const startPhaseTimer = (io, roomId, durationMs) => {
  setTimeout(async () => {
    await handlePhaseTransition(io, roomId);
  }, durationMs);
};

const handlePhaseTransition = async (io, roomId) => {
    const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!room || room.status === 'GAME_OVER') return;

    if (room.status === 'NIGHT') {
        // Resolve Night
        const players = await allQuery('SELECT * FROM players WHERE room_id = ?', [roomId]);
        const mafias = players.filter(p => p.role === 'MAFIA' && p.is_alive);
        const doctor = players.find(p => p.role === 'DOCTOR' && p.is_alive);

        // Mafia Target Logic
        let mafiaTargetId = null;
        const mafiaTargets = mafias.map(m => m.action_target).filter(t => t);
        // Simple consensus: if any vote, take the first one or majority. 
        // For strict rules: must match. Let's do strict match or first if single.
        if (mafias.length > 0 && mafiaTargets.length > 0) {
             // If all match
             if (mafiaTargets.every(t => t === mafiaTargets[0])) {
                 mafiaTargetId = mafiaTargets[0];
             } else {
                 // Disagreement = No Kill? or Random? Let's say First.
                 mafiaTargetId = mafiaTargets[0];
             }
        }

        let victimId = null;
        if (mafiaTargetId) {
            if (!doctor || doctor.action_target !== mafiaTargetId) {
                victimId = mafiaTargetId;
            }
        }

        let log = "Noche tranquila.";
        if (victimId) {
            const victim = players.find(p => p.id === victimId);
            if (victim) {
                await runQuery('UPDATE players SET is_alive = 0 WHERE id = ?', [victimId]);
                log = `${victim.name} ha sido eliminado.`;
            }
        }

        // Reset actions
        await runQuery('UPDATE players SET action_target = NULL WHERE room_id = ?', [roomId]);

        // Set Day
        const dayTime = 120 * 1000; // 2 min
        await runQuery('UPDATE rooms SET status = ?, phase_end_time = ?, last_night_result = ? WHERE id = ?', 
            ['DAY', Date.now() + dayTime, log, roomId]);
        
        await broadcastRoomState(io, roomId);
        startPhaseTimer(io, roomId, dayTime);

    } else if (room.status === 'DAY') {
        // End of debate -> Voting
        const votingTime = 30 * 1000;
        await runQuery('UPDATE rooms SET status = ?, phase_end_time = ? WHERE id = ?', ['VOTING', Date.now() + votingTime, roomId]);
        await broadcastRoomState(io, roomId);
        startPhaseTimer(io, roomId, votingTime);

    } else if (room.status === 'VOTING') {
        // Tally Votes
        const players = await allQuery('SELECT * FROM players WHERE room_id = ?', [roomId]);
        const votes = {};
        players.forEach(p => {
            if (p.is_alive && p.action_target) {
                votes[p.action_target] = (votes[p.action_target] || 0) + 1;
            }
        });

        let eliminatedId = null;
        let maxVotes = 0;
        for (const [pid, count] of Object.entries(votes)) {
            if (count > maxVotes) {
                maxVotes = count;
                eliminatedId = pid;
            } else if (count === maxVotes) {
                eliminatedId = null; // Tie
            }
        }

        if (eliminatedId) {
            await runQuery('UPDATE players SET is_alive = 0 WHERE id = ?', [eliminatedId]);
        }

        // Win Condition Check
        const currentPlayers = await allQuery('SELECT * FROM players WHERE room_id = ?', [roomId]);
        const alive = currentPlayers.filter(p => p.is_alive);
        const mafiaCount = alive.filter(p => p.role === 'MAFIA').length;
        const villagerCount = alive.length - mafiaCount;

        if (mafiaCount === 0) {
            await runQuery('UPDATE rooms SET status = ?, winner = ? WHERE id = ?', ['GAME_OVER', 'PUEBLO', roomId]);
        } else if (mafiaCount >= villagerCount) {
            await runQuery('UPDATE rooms SET status = ?, winner = ? WHERE id = ?', ['GAME_OVER', 'MAFIA', roomId]);
        } else {
            // Next Night
             const nightTime = 30 * 1000;
             await runQuery('UPDATE rooms SET status = ?, phase_end_time = ? WHERE id = ?', ['NIGHT', Date.now() + nightTime, roomId]);
             // Reset actions
             await runQuery('UPDATE players SET action_target = NULL WHERE room_id = ?', [roomId]);
             startPhaseTimer(io, roomId, nightTime);
        }

        await broadcastRoomState(io, roomId);
    }
};
