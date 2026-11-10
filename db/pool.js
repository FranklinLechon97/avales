const { Pool } = require('pg');
require('dotenv').config();

// El Pool toma automáticamente PGHOST, PGPORT, PGDATABASE, PGUSER y
// PGPASSWORD desde las variables de entorno (cargadas desde .env).
const pool = new Pool();

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = pool;
