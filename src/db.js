const { Pool } = require('pg');

// pg reads DATABASE_URL automatically from environment.
// Render injects this when you attach a PostgreSQL database.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// --- Schema Setup ---
// Creates tables if they don't exist. Called once on server start.
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      room       TEXT NOT NULL,
      username   TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Tables ready');
}

// --- Query Helpers ---
// Unlike better-sqlite3, pg is async — all queries return Promises.

const userQueries = {
  findByUsername: (username) =>
    pool.query('SELECT * FROM users WHERE username = $1', [username]),

  create: (username, password) =>
    pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, password]
    )
};

const messageQueries = {
  save: (room, username, content) =>
    pool.query(
      'INSERT INTO messages (room, username, content) VALUES ($1, $2, $3)',
      [room, username, content]
    ),

  getByRoom: (room) =>
    pool.query(
      `SELECT username, content, created_at
       FROM messages
       WHERE room = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [room]
    )
};

module.exports = { initDb, userQueries, messageQueries };
