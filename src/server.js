require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const authRoutes = require('./auth');
const { authenticateToken, authenticateSocket } = require('./middleware');
const { registerSocketHandlers } = require('./socket');
const { initDb, messageQueries } = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// --- Express Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// --- Routes ---
app.use('/auth', authRoutes);

app.get('/rooms/:room/history', authenticateToken, async (req, res) => {
  try {
    const { room } = req.params;
    const result = await messageQueries.getByRoom(room);
    res.json({ room, messages: result.rows.reverse() });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Something went wrong' });
});

// --- Socket.io ---
io.use(authenticateSocket);
registerSocketHandlers(io);

// --- Start ---
const PORT = process.env.PORT || 3000;

// Initialize DB tables first, then start listening
initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`
  ================================
   Chat App running on port ${PORT}
  ================================
   HTTP endpoints:
     POST /auth/register
     POST /auth/login
     GET  /rooms/:room/history  (auth required)
     GET  /health

   WebSocket:
     ws://localhost:${PORT}  (JWT required)
      `);
    });
  })
  .catch((err) => {
    console.error('[DB] Failed to initialize:', err);
    process.exit(1);
  });
