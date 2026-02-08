import React from 'react';
import { useGame } from '../context/GameContext';

const DayPhase = ({ roomData, myPlayer }) => {
  const { performAction } = useGame();
  const players = Object.values(roomData.players).sort((a, b) => a.id.localeCompare(b.id));
  
  // Now DAY status implies voting is allowed
  const isVoting = roomData.status === 'DAY' || roomData.status === 'VOTING';
  const lastNightResult = roomData.lastNightResult || "Amanece en el pueblo...";

  const handleVote = (targetId) => {
    if (!isVoting) return;
    if (!myPlayer.isAlive) return;
    
    // Toggle vote if clicking same person? Or just update.
    // Server handles update.
    performAction('VOTE', targetId);
  };

  // Calculate votes received for each player (for visualization)
  const getVotesReceived = (playerId) => {
    // Show votes always in this phase
    return players.filter(p => p.actionTarget === playerId).length;
  };
  
  // Calculate total votes cast vs active players (considering only ONLINE and ALIVE players for the requirement)
  // Actually, we should show based on what the server expects. 
  // Server expects ALIVE && ONLINE.
  const activeOnlinePlayers = players.filter(p => p.isAlive && p.isOnline);
  const totalVotes = activeOnlinePlayers.filter(p => p.actionTarget).length;
  const votesNeeded = activeOnlinePlayers.length;
  const votesRemaining = votesNeeded - totalVotes;

  return (
    <div className="p-4 flex flex-col h-full">
      {/* Night Result / Header */}
      <div className="mb-4 p-3 bg-zinc-100 rounded-lg border border-zinc-200 text-center shadow-sm">
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Reporte del día</p>
        <p className="text-zinc-900 font-medium text-base leading-relaxed">
          {lastNightResult}
        </p>
      </div>

      <div className="text-center mb-4">
        <h2 className="text-2xl font-serif text-yellow-600">
          DEBATE Y VOTACIÓN
        </h2>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
          Discutan y voten para linchar
        </p>
      </div>
      
      {/* Vote Progress Bar */}
      <div className="mb-6 px-2">
         <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Progreso de Votación</span>
            <span className="text-sm font-mono font-bold text-zinc-900">{totalVotes} / {votesNeeded}</span>
         </div>
         <div className="w-full bg-zinc-200 rounded-full h-2.5 overflow-hidden">
            <div 
                className={`h-2.5 rounded-full transition-all duration-500 ${votesRemaining === 1 ? 'bg-orange-500 animate-pulse' : 'bg-green-600'}`} 
                style={{ width: `${votesNeeded > 0 ? (totalVotes / votesNeeded) * 100 : 0}%` }}
            ></div>
         </div>
         {votesRemaining === 1 && (
            <p className="text-center text-xs text-orange-600 font-bold mt-2 animate-bounce">
                ¡Falta 1 voto para cerrar el debate!
            </p>
         )}
         {votesRemaining === 0 && votesNeeded > 0 && (
             <p className="text-center text-xs text-green-600 font-bold mt-2">
                 Votación completada. Procesando...
             </p>
         )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {players.map((p) => {
          const isSelected = myPlayer.actionTarget === p.id;
          const isDead = !p.isAlive;
          const isOffline = !p.isOnline;
          const voteCount = getVotesReceived(p.id);

          return (
            <button
              key={p.id}
              disabled={!isVoting || !myPlayer.isAlive || isDead}
              onClick={() => handleVote(p.id)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center p-2 relative transition-all shadow-sm
                ${isDead ? 'opacity-30 grayscale' : 'opacity-100'}
                ${isOffline && !isDead ? 'opacity-60 border-dashed' : ''}
                ${isSelected ? 'bg-red-50 border-2 border-red-600' : 'bg-white border border-zinc-200 hover:border-zinc-400'}
                ${!isVoting && !isDead ? 'cursor-default' : ''}
              `}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-2 text-zinc-600 font-bold text-sm relative border border-zinc-200">
                {p.name.charAt(0).toUpperCase()}
                
                {/* Vote Badge */}
                {voteCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-zinc-900 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {voteCount}
                  </div>
                )}

                {/* Offline Badge */}
                {isOffline && !isDead && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-zinc-400 border-2 border-white rounded-full" title="Desconectado"></div>
                )}
              </div>
              <span className="text-xs text-zinc-700 truncate w-full text-center font-medium">{p.name}</span>
              {isOffline && !isDead && <span className="text-[10px] text-zinc-400">OFFLINE</span>}
            </button>
          );
        })}
      </div>

      {!myPlayer.isAlive && (
        <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded text-center">
          <p className="text-red-600 text-sm font-medium">Estás muerto. Solo puedes observar.</p>
        </div>
      )}
    </div>
  );
};

export default DayPhase;
