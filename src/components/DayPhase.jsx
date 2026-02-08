import React from 'react';
import { useGame } from '../context/GameContext';

const DayPhase = ({ roomData, myPlayer }) => {
  const { performAction } = useGame();
  const players = Object.values(roomData.players).sort((a, b) => a.id.localeCompare(b.id));
  const isVoting = roomData.status === 'VOTING';
  const lastNightResult = roomData.lastNightResult || "Amanece en el pueblo...";

  const handleVote = (targetId) => {
    if (!isVoting) return;
    if (!myPlayer.isAlive) return;
    if (targetId === myPlayer.id) return; // Usually can't vote self? Or can? Let's assume yes.

    performAction('VOTE', targetId);
  };

  // Calculate votes received for each player (for visualization)
  const getVotesReceived = (playerId) => {
    if (!isVoting) return 0;
    return players.filter(p => p.actionTarget === playerId).length;
  };

  return (
    <div className="p-4 flex flex-col h-full">
      {/* Night Result / Header */}
      <div className="mb-6 p-4 bg-zinc-100 rounded-lg border border-zinc-200 text-center shadow-sm">
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Reporte del día</p>
        <p className="text-zinc-900 font-medium text-lg leading-relaxed">
          {lastNightResult}
        </p>
      </div>

      <div className="text-center mb-4">
        <h2 className={`text-2xl font-serif ${isVoting ? 'text-red-600 animate-pulse' : 'text-yellow-600'}`}>
          {isVoting ? 'VOTACIÓN FINAL' : 'DEBATE'}
        </h2>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
          {isVoting ? 'Decidan quién será linchado' : 'Discutan quién es el culpable'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {players.map((p) => {
          const isSelected = myPlayer.actionTarget === p.id;
          const isDead = !p.isAlive;
          const voteCount = getVotesReceived(p.id);

          return (
            <button
              key={p.id}
              disabled={!isVoting || !myPlayer.isAlive || isDead}
              onClick={() => handleVote(p.id)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center p-2 relative transition-all shadow-sm
                ${isDead ? 'opacity-30 grayscale' : 'opacity-100'}
                ${isSelected && isVoting ? 'bg-red-50 border-2 border-red-600' : 'bg-white border border-zinc-200 hover:border-zinc-400'}
                ${!isVoting && !isDead ? 'cursor-default' : ''}
              `}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-2 text-zinc-600 font-bold text-sm relative border border-zinc-200">
                {p.name.charAt(0).toUpperCase()}
                
                {/* Vote Badge */}
                {isVoting && voteCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-zinc-900 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {voteCount}
                  </div>
                )}
              </div>
              <span className="text-xs text-zinc-700 truncate w-full text-center font-medium">{p.name}</span>
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
