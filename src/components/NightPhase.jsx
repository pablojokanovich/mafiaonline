import React from 'react';
import { useGame } from '../context/GameContext';

const NightPhase = ({ roomData, myPlayer }) => {
  const { performAction } = useGame();
  const players = Object.values(roomData.players).sort((a, b) => a.id.localeCompare(b.id)); // Consistent order

  const handlePlayerClick = (targetId) => {
    if (!myPlayer.isAlive) return;
    if (targetId === myPlayer.id && myPlayer.role !== 'DOCTOR') return; // Usually can't pick self unless Doctor?
    // Actually Mafia usually can't kill self, Police can't investigate self.
    
    performAction('NIGHT_ACTION', targetId);
  };

  // Helper to determine feedback text
  const getFeedback = () => {
    if (!myPlayer.actionTarget) return null;
    const target = roomData.players[myPlayer.actionTarget];
    
    if (myPlayer.role === 'POLICE') {
      return (
        <div className="fixed bottom-20 left-0 right-0 text-center pointer-events-none">
          <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${
            target.role === 'MAFIA' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}>
            {target.role === 'MAFIA' ? 'ES MAFIA' : 'ES INOCENTE'}
          </span>
        </div>
      );
    }
    return null;
  };

  // Helper to show partner vote for Mafia
  const getMafiaPartnerVote = (playerId) => {
    if (myPlayer.role !== 'MAFIA') return false;
    // Find other mafia
    const otherMafia = Object.values(roomData.players).find(p => p.role === 'MAFIA' && p.id !== myPlayer.id);
    if (otherMafia && otherMafia.actionTarget === playerId) {
      return true;
    }
    return false;
  };

  return (
    <div className="p-4 relative min-h-[50vh]">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-serif text-zinc-400">
          {myPlayer.role === 'MAFIA' && <span className="text-red-600">Mafia</span>}
          {myPlayer.role === 'POLICE' && <span className="text-blue-500">Policía</span>}
          {myPlayer.role === 'DOCTOR' && <span className="text-green-500">Médico</span>}
          {myPlayer.role === 'VILLAGER' && <span className="text-zinc-500">Pueblo</span>}
        </h2>
        <p className="text-xs text-zinc-600 uppercase tracking-widest mt-1">
          {myPlayer.role === 'MAFIA' && "Elige una víctima"}
          {myPlayer.role === 'POLICE' && "Investiga un sospechoso"}
          {myPlayer.role === 'DOCTOR' && "Protege a alguien"}
          {myPlayer.role === 'VILLAGER' && "¿De quién sospechas?"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {players.map((p) => {
          const isSelected = myPlayer.actionTarget === p.id;
          const isPartnerVote = getMafiaPartnerVote(p.id);
          const isDead = !p.isAlive;

          return (
            <button
              key={p.id}
              disabled={!myPlayer.isAlive || isDead}
              onClick={() => handlePlayerClick(p.id)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center p-2 relative transition-all
                ${isDead ? 'opacity-30 grayscale' : 'opacity-100'}
                ${isSelected ? 'bg-zinc-800 border-2 border-white' : 'bg-zinc-900 border border-zinc-800'}
                active:scale-95
              `}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-2 text-zinc-400 font-bold text-sm">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-zinc-300 truncate w-full text-center">{p.name}</span>
              
              {/* Partner Vote Indicator (Only for Mafia) */}
              {isPartnerVote && (
                <div className="absolute top-1 right-1 w-3 h-3 bg-red-600 rounded-full border border-black animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {getFeedback()}
      
      {!myPlayer.isAlive && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <p className="text-red-600 text-xl font-bold uppercase tracking-widest">Estás Muerto</p>
        </div>
      )}
    </div>
  );
};

export default NightPhase;
