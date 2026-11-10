require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const pool = require('./db/pool');
const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const avalRoutes = require('./routes/avales');
const reporteRoutes = require('./routes/reportes');
const reporteUsuariosRoutes = require('./routes/reporteUsuarios');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
    httpOnly: true,
    sameSite: 'lax'
  }
}));

/// ==============================================
// RUTAS API - SISTEMA DE AVALES
// ==============================================

app.use('/api/auth', authRoutes);

app.use('/api/usuarios', usuarioRoutes);

app.use('/api/avales', avalRoutes);

app.use('/api/reportes', reporteRoutes);

// Reporte PDF de usuarios
app.use('/api/reportes', reporteUsuariosRoutes);

// Raíz: manda a cada quien a su panel según el rol
app.get('/', requireAuth, (req, res) => {
  if (req.session.usuarioRol === 'administrador') {
    return res.redirect('/admin.html');
  }
  return res.redirect('/asesor.html');
});

// Panel de administrador (protegido)
app.get('/admin.html', requireAuth, (req, res) => {
  if (req.session.usuarioRol !== 'administrador') {
    return res.redirect('/asesor.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Panel de asesor (protegido)
app.get('/asesor.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'asesor.html'));
});

// Estáticos (login.html, css, js)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Sistema de Avales corriendo en http://localhost:${PORT}`);
});
