import { io } from 'socket.io-client';

// Use environment variable for production URL, fallback to localhost for development
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const socket = io(SERVER_URL);
