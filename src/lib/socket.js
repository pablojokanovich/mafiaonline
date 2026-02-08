import { io } from 'socket.io-client';

// Connect to local backend
export const socket = io('http://localhost:3000');
