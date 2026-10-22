'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const { db, UPLOADS_DIR, productImages } = require('../db');
const { requireAdmin } = require('../auth');
const { generateModelImage } = require('../services/imageGen');

const router = express.Router();

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

// Convierte una foto subida en foto de catalogo (maniqui si es ropa, producto si es otra cosa)
router.post('/admin/images/:id/generate-model', requireAdmin, async (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Imagen no encontrada' });
  if (img.kind === 'generated') return res.status(400).json({ error: 'Esta imagen ya es una foto generada. Sube la foto original del producto.' });

  const prod = db.prepare('SELECT name, category FROM products WHERE id = ?').get(img.product_id) || {};

  const file = path.join(UPLOADS_DIR, path.basename(img.url));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'El archivo de la imagen no existe en el servidor' });

  const source = fs.readFileSync(file);
  const mime = 'image/' + (path.extname(file).slice(1) === 'jpg' ? 'jpeg' : path.extname(file).slice(1));

  try {
    const out = await generateModelImage(
      source,
      mime.startsWith('image/') ? mime : 'image/jpeg',
      { category: prod.category || '', name: prod.name || '' }
    );
    const ext = EXT[out.mime] || '.png';
    const name = `modelo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), out.buffer);
    const info = db.prepare('INSERT INTO product_images (product_id, url, kind, position) VALUES (?, ?, ?, 0)')
      .run(img.product_id, `/uploads/${name}`, 'generated');
    const created = db.prepare('SELECT * FROM product_images WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ image: created, images: productImages(img.product_id) });
  } catch (e) {
    const status = e.code === 'IA_NOT_CONFIGURED' ? 400 : 502;
    res.status(status).json({ error: e.message });
  }
});

// Estado de la IA para mostrar/ocultar el boton en el panel
router.get('/admin/ai-status', requireAdmin, (req, res) => {
  const configured = !!(process.env.IA_PROVIDER && process.env.IA_API_KEY);
  res.json({ configured, provider: process.env.IA_PROVIDER || null });
});

module.exports = router;
