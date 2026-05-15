const { messageQueries } = require('./db');

function registerSocketHandlers(io) {

  io.on('connection', (socket) => {
    const username = socket.user.username;
    console.log(`[Socket] ${username} connected (${socket.id})`);

    // --- Join Room ---
    socket.on('join_room', async ({ room }) => {
      if (!room) return;

      socket.join(room);

      socket.to(room).emit('user_joined', {
        username,
        message: `${username} joined the room`,
        timestamp: new Date().toISOString(),
      });

      // Load last 50 messages — now async with pg
      try {
        const result = await messageQueries.getByRoom(room);
        const history = result.rows.reverse();
        socket.emit('message_history', history);
      } catch (err) {
        console.error('[Socket] Failed to load history:', err);
      }
    });

    // --- Send Message ---
    socket.on('send_message', async ({ room, content }) => {
      if (!room || !content?.trim()) return;

      const messageData = {
        username,
        content: content.trim(),
        room,
        created_at: new Date().toISOString(),
      };

      try {
        await messageQueries.save(room, username, content.trim());
      } catch (err) {
        console.error('[Socket] Failed to save message:', err);
        socket.emit('error_message', { error: 'Failed to send message' });
        return;
      }

      io.to(room).emit('new_message', messageData);
    });

    // --- Leave Room ---
    socket.on('leave_room', ({ room }) => {
      if (!room) return;
      socket.leave(room);
      socket.to(room).emit('user_left', {
        username,
        message: `${username} left the room`,
        timestamp: new Date().toISOString(),
      });
    });

    // --- Typing Indicator ---
    socket.on('typing', ({ room, isTyping }) => {
      socket.to(room).emit('user_typing', { username, isTyping });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      console.log(`[Socket] ${username} disconnected`);
    });
  });
}

module.exports = { registerSocketHandlers };
