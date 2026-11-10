/**
 * Inicializa la base de datos: crea las tablas (schema.sql) y, si no existe
 * ningún usuario todavía, crea un administrador y un asesor de prueba.
 *
 * Uso:  npm run init-db
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('Creando tablas (si no existen)...');
  await pool.query(schema);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios');

  if (rows[0].total === 0) {
    const admin = {
      nombre: 'Administrador',
      email: 'admin@avales.local',
      password: 'admin1234',
      rol: 'administrador'
    };
    const asesor = {
      nombre: 'Asesor de Prueba',
      email: 'asesor@avales.local',
      password: 'asesor1234',
      rol: 'asesor'
    };

    for (const u of [admin, asesor]) {
      const hash = await bcrypt.hash(u.password, 10);
      await pool.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
        [u.nombre, u.email, hash, u.rol]
      );
    }

    console.log('----------------------------------------------------');
    console.log('Usuarios de prueba creados:');
    console.log('  Administrador -> admin@avales.local  / admin1234');
    console.log('  Asesor        -> asesor@avales.local / asesor1234');
    console.log('Cámbialos apenas puedas iniciar sesión.');
    console.log('----------------------------------------------------');
  } else {
    console.log('Ya existen usuarios, no se creó ninguno nuevo.');
  }

  await pool.end();
  console.log('Listo.');
}

main().catch((err) => {
  console.error('Error al inicializar la base de datos:', err);
  process.exit(1);
});
