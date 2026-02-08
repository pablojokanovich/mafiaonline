import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDB } from './db.js';
import { setupSocketHandlers } from './gameController.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Init Database
initDB();

// Setup Socket Logic
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
