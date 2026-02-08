import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { v4 as uuidv4 } from 'uuid';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState({
    isInRoom: false,
    roomId: null,
    playerId: null,
    playerName: null,
    isHost: false,
    roomData: null,
  });

  const [connectionState, setConnectionState] = useState('connected'); // connected, disconnected, resetting

  // Init Player ID
  useEffect(() => {
    let id = localStorage.getItem('mafia_player_id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('mafia_player_id', id);
    }
    setGameState(prev => ({ ...prev, playerId: id }));
  }, []);

  // Socket Listeners
  useEffect(() => {
    socket.on('connect', () => {
      setConnectionState('connected');
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('room_update', (data) => {
      setGameState(prev => ({
        ...prev,
        roomData: data,
        isInRoom: true,
        roomId: data.id,
        // Update isHost based on data received from server
        isHost: data.players[prev.playerId]?.isHost || false
      }));
    });

    socket.on('server_reset', () => {
      setConnectionState('resetting');
      setGameState(prev => ({
        ...prev,
        isInRoom: false,
        roomId: null,
        roomData: null,
        isHost: false
      }));
      // Optional: Force reload to clear any local weirdness
      setTimeout(() => {
         window.location.reload();
      }, 2000);
    });

    socket.on('error', (msg) => {
      alert(msg);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_update');
      socket.off('server_reset');
      socket.off('error');
    };
  }, []);

  const createRoom = (playerName) => {
    socket.emit('create_room', { playerName, playerId: gameState.playerId });
    setGameState(prev => ({ ...prev, playerName }));
  };

  const joinRoom = (roomId, playerName) => {
    socket.emit('join_room', { roomId, playerName, playerId: gameState.playerId });
    setGameState(prev => ({ ...prev, playerName }));
  };

  const startGame = () => {
    if (gameState.roomId) {
      socket.emit('start_game', { roomId: gameState.roomId });
    }
  };

  const performAction = (actionType, targetId) => {
    if (gameState.roomId) {
      socket.emit('action', { 
        roomId: gameState.roomId, 
        targetId, 
        playerId: gameState.playerId 
      });
    }
  };

  const resetServer = () => {
    if (window.confirm("¿ESTÁS SEGURO? Esto borrará todas las salas y reiniciará el servidor para todos los jugadores.")) {
      socket.emit('reset_server');
    }
  };

  return (
    <GameContext.Provider value={{ 
      gameState, 
      connectionState,
      createRoom, 
      joinRoom, 
      startGame,
      performAction,
      resetServer
    }}>
      {children}
      
      {connectionState === 'disconnected' && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center">
          <div className="text-white text-xl animate-pulse">Conectando con el servidor...</div>
        </div>
      )}
      
      {connectionState === 'resetting' && (
        <div className="fixed inset-0 bg-red-900/90 z-[100] flex items-center justify-center">
          <div className="text-white text-xl font-bold">REINICIANDO SISTEMA...</div>
        </div>
      )}

    </GameContext.Provider>
  );
};
