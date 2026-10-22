'use strict';
require('dotenv').config();

const path = require('path');
const express = require('express');
const { ROOT, UPLOADS_DIR } = require('./db');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Sin cache para HTML, CSS y JS: así siempre ves la última versión de la tienda.
// (Las fotos de /uploads sí se cachean 7 días, son pesadas e inmutables.)
app.use((req, res, next) => {
  if (/\.(html?|css|js)$/i.test(req.path) || req.path === '/') {
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Archivos estaticos del sitio
app.use(express.static(path.join(ROOT, 'public'), { etag: true, lastModified: true }));
// Fotos subidas y generadas
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// API
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/products'));
app.use('/api', require('./routes/upload'));
app.use('/api', require('./routes/ai'));
app.use('/api', require('./routes/settings'));

// 404 de API
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Errores inesperados
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Tienda corriendo en       http://localhost:${PORT}`);
  console.log(`  Panel de admin               http://localhost:${PORT}/admin/login.html\n`);
});
