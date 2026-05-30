const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Neon requiere search_path explícito en cada conexión nueva
pool.on('connect', (client) => {
  client.query("SET search_path TO public");
  console.log('Conectado a PostgreSQL (Neon Cloud)');
});

pool.on('error', (err) => {
  console.error('Error en pool:', err.message);
});

module.exports = pool;
