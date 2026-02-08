import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

function AppContent() {
  const { gameState } = useGame();

  if (!gameState.isInRoom) {
    return <Lobby />;
  }

  return <GameRoom />;
}

function App() {
  return (
    <GameProvider>
      <div className="min-h-screen bg-black text-gray-200 font-sans flex flex-col items-center justify-center p-4">
        <AppContent />
      </div>
    </GameProvider>
  );
}

export default App;
