import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

const Lobby = () => {
  const { createRoom, joinRoom, resetServer } = useGame();
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState('menu'); // menu, create, join
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = () => {
    if (!name) return alert("Ingresa tu nombre");
    setIsLoading(true);
    createRoom(name);
    // Timeout fallback just in case
    setTimeout(() => setIsLoading(false), 5000);
  };

  const handleJoin = () => {
    if (!name || !roomId) return alert("Ingresa nombre y código");
    joinRoom(roomId.toUpperCase(), name);
  };

  return (
    <div className="w-full max-w-md p-6 space-y-8 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl relative">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tighter text-red-600 mb-2 font-serif">MAFIA</h1>
        <p className="text-zinc-400 text-sm">El pueblo duerme, la mafia acecha.</p>
      </div>

      {mode === 'menu' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Tu Nombre"
            className="w-full bg-zinc-950 border border-zinc-700 p-4 rounded-lg text-white focus:outline-none focus:border-red-500 transition-colors"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={() => setMode('create')}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02]"
          >
            Crear Sala
          </button>
          <button 
            onClick={() => setMode('join')}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02]"
          >
            Unirse a Sala
          </button>
          
          <div className="pt-8 border-t border-zinc-800">
             <button 
                onClick={resetServer}
                className="w-full text-xs text-red-900 hover:text-red-500 uppercase tracking-widest transition-colors py-2 border border-transparent hover:border-red-900/30 rounded"
             >
               ⚠️ Reiniciar Servidor
             </button>
          </div>
        </div>
      )}

      {mode === 'create' && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-zinc-300 text-center">Creando sala como <span className="text-white font-bold">{name}</span></p>
          <button 
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-gray-400 text-white font-bold py-4 rounded-lg flex justify-center items-center"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Confirmar e Iniciar'}
          </button>
          <button onClick={() => setMode('menu')} className="w-full text-zinc-500 text-sm hover:text-zinc-300">Volver</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="space-y-4 animate-fade-in">
           <p className="text-zinc-300 text-center">Entrando como <span className="text-white font-bold">{name || 'Anon'}</span></p>
          <input
            type="text"
            placeholder="Código de Sala (ej. X7Z9)"
            className="w-full bg-zinc-950 border border-zinc-700 p-4 rounded-lg text-white text-center tracking-widest uppercase focus:outline-none focus:border-red-500"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button 
            onClick={handleJoin}
            className="w-full bg-white text-black font-bold py-4 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Entrar
          </button>
          <button onClick={() => setMode('menu')} className="w-full text-zinc-500 text-sm hover:text-zinc-300">Volver</button>
        </div>
      )}
    </div>
  );
};

export default Lobby;
