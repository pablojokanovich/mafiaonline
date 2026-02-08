import { io } from 'socket.io-client';
import { setTimeout } from 'timers/promises';

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('Starting Police Restriction Test...');

  // 1. Connect Host
  const hostSocket = io(SERVER_URL);
  await new Promise(resolve => hostSocket.on('connect', resolve));
  console.log('Host connected');

  let roomId;
  // 2. Create Room
  const roomIdPromise = new Promise(resolve => {
    hostSocket.on('room_update', (data) => {
        if (data.status === 'LOBBY' && Object.keys(data.players).length === 1) {
            resolve(data.id);
        }
    });
  });

  hostSocket.emit('create_room', { playerName: 'Host', playerId: 'host-1' });
  roomId = await roomIdPromise;
  console.log(`Room created: ${roomId}`);

  // 3. Connect 2 other players (Total 3: 1 Mafia, 1 Doctor, 1 Police)
  const players = [];
  const playerSockets = { 'host-1': hostSocket };
  
  for (let i = 0; i < 2; i++) {
    const s = io(SERVER_URL);
    await new Promise(r => s.on('connect', r));
    const pid = `p-${i}`;
    s.emit('join_room', { roomId, playerName: `Player${i}`, playerId: pid });
    players.push(s);
    playerSockets[pid] = s;
  }

  // Wait for all to join
  await setTimeout(1000);
  console.log('All players joined');

  // 4. Start Game
  hostSocket.emit('start_game', { roomId });
  console.log('Game started, waiting for NIGHT...');

  // 5. Wait for NIGHT and Identify Police
  let policeId = null;
  let targetId = null; // Someone who is NOT the police

  await new Promise(resolve => {
      const listener = (data) => {
          if (data.status === 'NIGHT') {
              // Find Police
              Object.values(data.players).forEach(p => {
                  if (p.role === 'POLICE') {
                      policeId = p.id;
                      console.log(`Police identified: ${p.name} (${p.id})`);
                  } else {
                      targetId = p.id;
                  }
              });
              
              if (policeId) {
                  hostSocket.off('room_update', listener);
                  resolve();
              }
          }
      };
      hostSocket.on('room_update', listener);
  });

  if (!policeId) {
      console.error('Test Failed: No Police found (unexpected role distribution)');
      process.exit(1);
  }

  const policeSocket = playerSockets[policeId];
  
  // 6. Perform First Action
  console.log(`Police (${policeId}) investigating ${targetId}...`);
  policeSocket.emit('action', { roomId, targetId, playerId: policeId });

  // Verify Action Recorded
  await new Promise(resolve => {
      const listener = (data) => {
          const p = data.players[policeId];
          if (p && p.actionTarget === targetId && p.hasActedThisRound) {
              console.log('First action successful (recorded in state).');
              policeSocket.off('room_update', listener);
              resolve();
          }
      };
      policeSocket.on('room_update', listener);
  });

  // 7. Perform Second Action (Should Fail)
  console.log('Attempting second investigation (should fail)...');
  const differentTargetId = Object.keys(playerSockets).find(id => id !== policeId && id !== targetId);
  
  let errorReceived = false;
  policeSocket.on('error', (msg) => {
      console.log(`Received Error: "${msg}"`);
      if (msg.includes('Ya has seleccionado tu sospechoso')) {
          errorReceived = true;
      }
  });

  policeSocket.emit('action', { roomId, targetId: differentTargetId, playerId: policeId });

  await setTimeout(1000);

  if (errorReceived) {
      console.log('TEST PASSED: Second investigation blocked.');
  } else {
      console.log('TEST FAILED: No error received for second investigation.');
  }

  // Cleanup
  hostSocket.disconnect();
  players.forEach(p => p.disconnect());
  process.exit(0);
}

runTest().catch((err) => {
    console.error(err);
    process.exit(1);
});
