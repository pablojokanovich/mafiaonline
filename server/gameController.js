import { initDB, runQuery, getQuery, allQuery } from './db.js';
import { v4 as uuidv4 } from 'uuid';

// Store timer references to clear them if phase ends early
const roomTimers = {};

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
          'INSERT INTO players (id, room_id, name, is_host, socket_id, is_alive, is_online) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [playerId, roomId, playerName, 1, socket.id, 1, 1]
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
             await runQuery('UPDATE players SET socket_id = ?, room_id = ?, name = ?, is_online = 1 WHERE id = ?', [socket.id, roomId, playerName, playerId]);
        } else {
             await runQuery(
              'INSERT INTO players (id, room_id, name, is_host, socket_id, is_alive, is_online) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [playerId, roomId, playerName, 0, socket.id, 1, 1]
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
        const players = await allQuery('SELECT * FROM players WHERE room_id = ?', [roomId]);
        
        // Assign Roles
        let roles = [];
        let mafiaCount = players.length < 9 ? 1 : 2;
        let doctorCount = 1;
        let policeCount = 1;
        let villagerCount = players.length - mafiaCount - doctorCount - policeCount;
        
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
          await runQuery('UPDATE players SET role = ?, action_target = NULL, has_acted_this_round = 0 WHERE id = ?', [roles[i], players[i].id]);
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
           const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [roomId]);
           if (!room) return;

           const player = await getQuery('SELECT * FROM players WHERE id = ?', [playerId]);
           if (!player) return;

           // Police Restriction: One investigation per round
           if (player.role === 'POLICE' && room.status === 'NIGHT') {
               if (player.has_acted_this_round) {
                   console.log(`[AUDIT] Player ${player.name} (POLICE) attempted multiple investigations in room ${roomId}`);
                   return socket.emit('error', 'Ya has seleccionado tu sospechoso para esta ronda');
               }
               await runQuery('UPDATE players SET has_acted_this_round = 1 WHERE id = ?', [playerId]);
               console.log(`[AUDIT] Player ${player.name} (POLICE) investigated ${targetId} in room ${roomId}`);
           }

           await runQuery('UPDATE players SET action_target = ? WHERE id = ?', [targetId, playerId]);
           await broadcastRoomState(io, roomId);

           // Check for early completion if in DAY phase
           if (room.status === 'DAY') {
             const players = await allQuery('SELECT * FROM players WHERE room_id = ? AND is_alive = 1 AND is_online = 1', [roomId]);
             const votedCount = players.filter(p => p.action_target).length;
             
             if (votedCount === players.length && players.length > 0) {
               console.log(`[${roomId}] All online players voted. Ending DAY phase early.`);
               clearTimeout(roomTimers[roomId]);
               await handlePhaseTransition(io, roomId);
             }
           }

       } catch (err) {
           console.error(err);
       }
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      try {
        const player = await getQuery('SELECT * FROM players WHERE socket_id = ?', [socket.id]);
        if (player) {
           await runQuery('UPDATE players SET is_online = 0 WHERE id = ?', [player.id]);
           await broadcastRoomState(io, player.room_id);
           
           // Check if this disconnection triggers early end (if everyone else has voted)
           const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [player.room_id]);
           if (room && room.status === 'DAY') {
               const players = await allQuery('SELECT * FROM players WHERE room_id = ? AND is_alive = 1 AND is_online = 1', [player.room_id]);
               const votedCount = players.filter(p => p.action_target).length;
               
               if (votedCount === players.length && players.length > 0) {
                   console.log(`[${player.room_id}] All online players voted (after disconnect). Ending DAY phase early.`);
                   clearTimeout(roomTimers[player.room_id]);
                   await handlePhaseTransition(io, player.room_id);
               }
           }
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('reset_server', async () => {
      try {
        console.log('RESETTING SERVER...');
        await runQuery('DELETE FROM players');
        await runQuery('DELETE FROM rooms');
        io.emit('server_reset');
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
  
  if (!room) return;

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
      isOnline: !!p.is_online,
      hasActedThisRound: !!p.has_acted_this_round,
      actionTarget: p.action_target
    };
  });

  io.to(roomId).emit('room_update', roomData);
};

const startPhaseTimer = (io, roomId, durationMs) => {
  if (roomTimers[roomId]) clearTimeout(roomTimers[roomId]);
  
  roomTimers[roomId] = setTimeout(async () => {
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
        
        if (mafias.length > 0 && mafiaTargets.length > 0) {
             const counts = {};
             mafiaTargets.forEach(t => counts[t] = (counts[t] || 0) + 1);
             const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
             mafiaTargetId = sorted[0][0];
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
        await runQuery('UPDATE players SET action_target = NULL, has_acted_this_round = 0 WHERE room_id = ?', [roomId]);

        // Set Day (Merged Discussion + Voting)
        const dayTime = 120 * 1000; // 2 min
        await runQuery('UPDATE rooms SET status = ?, phase_end_time = ?, last_night_result = ? WHERE id = ?', 
            ['DAY', Date.now() + dayTime, log, roomId]);
        
        await broadcastRoomState(io, roomId);
        startPhaseTimer(io, roomId, dayTime);

    } else if (room.status === 'DAY') {
        // Tally Votes directly from DAY phase
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
             await runQuery('UPDATE players SET action_target = NULL, has_acted_this_round = 0 WHERE room_id = ?', [roomId]);
             startPhaseTimer(io, roomId, nightTime);
        }

        await broadcastRoomState(io, roomId);
    }
};
