import React from 'react';
import { useGame } from '../context/GameContext';
import NightPhase from './NightPhase';
import DayPhase from './DayPhase';

const GameRoom = () => {
  const { gameState, startGame } = useGame();
  const { roomData, isHost, playerId } = gameState;

  if (!roomData) return <div className="text-white">Cargando sala...</div>;

  const { players, status, id: roomCode, winner } = roomData;
  const playerList = Object.values(players);
  const myPlayer = players[playerId];

  if (status === 'LOBBY') {
    return (
      <div className="w-full max-w-md p-6 bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Sala: <span className="text-red-500 tracking-widest">{roomCode}</span></h2>
          <span className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-400">{playerList.length} Jugadores</span>
        </div>
        
        <div className="space-y-2 mb-8 max-h-[60vh] overflow-y-auto">
          {playerList.map((p) => (
            <div key={p.id} className="flex items-center p-3 bg-zinc-950 rounded border border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mr-3 text-xs font-bold text-zinc-500">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-zinc-200">{p.name}</span>
              {p.isHost && <span className="ml-auto text-xs text-yellow-600 border border-yellow-900 px-2 py-0.5 rounded">HOST</span>}
            </div>
          ))}
        </div>

        {isHost ? (
          <button 
            onClick={startGame}
            disabled={playerList.length < 4} 
            className="w-full bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-all"
          >
            {playerList.length < 4 ? 'Esperando jugadores (min 4)' : 'INICIAR PARTIDA'}
          </button>
        ) : (
          <div className="text-center text-zinc-500 animate-pulse">
            Esperando al anfitrión...
          </div>
        )}
      </div>
    );
  }

  if (status === 'GAME_OVER') {
      return (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
              <h1 className="text-5xl font-bold text-red-600 mb-4">FIN DEL JUEGO</h1>
              <div className="text-3xl text-white">
                  Ganan: <span className={winner === 'MAFIA' ? 'text-red-500' : 'text-blue-400'}>{winner}</span>
              </div>
              <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black font-bold rounded mt-8">
                  Volver al Lobby
              </button>
          </div>
      )
  }

  // Force re-render for timer
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer Display Logic (Client side estimation based on server end time)
  const timeLeft = Math.max(0, Math.ceil((roomData.phaseEndTime - Date.now()) / 1000));

  const isDayPhase = status === 'DAY' || status === 'VOTING';
  const themeClasses = isDayPhase 
    ? "bg-white text-black" 
    : "bg-zinc-950 text-white";
  
  const headerClasses = isDayPhase
    ? "bg-white/90 border-zinc-200 text-black"
    : "bg-zinc-900/50 border-zinc-800 text-white";

  return (
    <div className={`w-full max-w-md h-full flex flex-col transition-colors duration-500 ${themeClasses}`}>
       {/* Header Info */}
       <div className={`flex justify-between items-center p-4 border-b backdrop-blur-sm fixed top-0 w-full max-w-md z-10 transition-colors duration-500 ${headerClasses}`}>
          <div className={`text-xs ${isDayPhase ? 'text-zinc-500' : 'text-zinc-500'}`}>
              {status === 'NIGHT' ? '🌙 NOCHE' : status === 'DAY' ? '☀️ DÍA' : '🗳️ VOTACIÓN'}
          </div>
          <div className="font-mono text-red-500 font-bold">
              {timeLeft}s
          </div>
       </div>

       <div className="mt-16 mb-4 flex-1 overflow-y-auto">
          {status === 'NIGHT' && <NightPhase roomData={roomData} myPlayer={myPlayer} />}
          {(status === 'DAY' || status === 'VOTING') && <DayPhase roomData={roomData} myPlayer={myPlayer} />}
       </div>
    </div>
  );
};

export default GameRoom;
