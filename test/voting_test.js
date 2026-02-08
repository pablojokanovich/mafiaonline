import { io } from 'socket.io-client';
import { setTimeout } from 'timers/promises';

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('Starting Voting Test...');

  // 1. Connect Host
  const hostSocket = io(SERVER_URL);
  const hostPromise = new Promise(resolve => hostSocket.on('connect', resolve));
  await hostPromise;
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

  // 3. Connect 3 other players
  const players = [];
  for (let i = 0; i < 3; i++) {
    const s = io(SERVER_URL);
    await new Promise(r => s.on('connect', r));
    s.emit('join_room', { roomId, playerName: `Player${i}`, playerId: `p-${i}` });
    players.push(s);
  }

  // Wait for all to join
  await setTimeout(1000);
  console.log('All players joined');

  // 4. Start Game
  hostSocket.emit('start_game', { roomId });
  console.log('Game started, waiting for NIGHT to end (30s)...');

  // Wait for NIGHT -> DAY transition
  await new Promise(resolve => {
      const listener = (data) => {
          if (data.status === 'DAY') {
              console.log('Phase is now DAY');
              hostSocket.off('room_update', listener);
              resolve();
          }
      };
      hostSocket.on('room_update', listener);
  });

  console.log('In DAY phase. Casting votes...');

  // 5. Cast votes
  // Host votes for Player0
  hostSocket.emit('action', { roomId, targetId: 'p-0', playerId: 'host-1' });
  await setTimeout(500);
  
  // Player0 votes for Host
  players[0].emit('action', { roomId, targetId: 'host-1', playerId: 'p-0' });
  await setTimeout(500);

  // Player1 votes for Host
  players[1].emit('action', { roomId, targetId: 'host-1', playerId: 'p-1' });
  await setTimeout(500);

  console.log('3/4 votes cast. Waiting briefly to ensure phase does NOT change yet...');
  await setTimeout(2000);
  
  console.log('Casting final vote...');
  const startTime = Date.now();
  
  // Player2 votes for Host
  players[2].emit('action', { roomId, targetId: 'host-1', playerId: 'p-2' });

  // 6. Wait for transition
  await new Promise(resolve => {
      const listener = (data) => {
          if (data.status === 'NIGHT' || data.status === 'GAME_OVER') {
              const elapsed = Date.now() - startTime;
              console.log(`Phase changed to ${data.status} in ${elapsed}ms`);
              if (elapsed < 5000) { 
                  console.log('TEST PASSED: Early termination triggered.');
              } else {
                  console.log('TEST FAILED: Took too long (expected < 5s).');
              }
              hostSocket.off('room_update', listener);
              resolve();
          }
      };
      hostSocket.on('room_update', listener);
  });

  // Cleanup
  hostSocket.disconnect();
  players.forEach(p => p.disconnect());
  console.log('Test finished.');
  process.exit(0);
}

runTest().catch((err) => {
    console.error(err);
    process.exit(1);
});
