'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { db, UPLOADS_DIR, productImages, getSettings } = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// ---------- Detección de formato por magic bytes (no confiar en el MIME) ----------
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: 'gif', mime: 'image/gif' };
  if (b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12);
    if (['avif', 'avis'].includes(brand)) return { ext: 'avif', mime: 'image/avif' };
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return { ext: 'heic', mime: 'image/heic' };
  }
  if (b[0] === 0x42 && b[1] === 0x4d) return { ext: 'bmp', mime: 'image/bmp' };
  if (b[0] === 0x49 && b[1] === 0x49 || b[0] === 0x4d && b[1] === 0x4d) return { ext: 'tiff', mime: 'image/tiff' };
  return null;
}

// Almacenamiento en memoria: sniff + guardado con extensión correcta
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Acepta cualquier archivo que parezca imagen (se valida por magic bytes al procesar)
    const okExt = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?|jfif)$/i.test(file.originalname || '');
    const okMime = /^image\//.test(file.mimetype || '') || file.mimetype === 'application/octet-stream';
    if (okExt || okMime) return cb(null, true);
    cb(new Error('Formato no reconocido. Subí una imagen: JPG, PNG, WEBP, GIF, AVIF, HEIC, BMP o TIFF.'));
  }
});

function saveBuffer(buffer) {
  const info = sniffImage(buffer);
  if (!info) {
    const err = new Error('El archivo no es una imagen válida (formato no reconocido).');
    err.status = 400;
    throw err;
  }
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${info.ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
  return { url: `/uploads/${name}`, ...info };
}

function saveImageRow(productId, url, kind) {
  const info = db.prepare('INSERT INTO product_images (product_id, url, kind, position) VALUES (?, ?, ?, 0)')
    .run(productId, url, kind);
  const count = db.prepare('SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?').get(productId).c;
  if (count === 1) db.prepare('UPDATE product_images SET is_main = 1 WHERE id = ?').run(info.lastInsertRowid);
  return db.prepare('SELECT * FROM product_images WHERE id = ?').get(info.lastInsertRowid);
}

// ---------- Subir una o varias fotos de la prenda ----------
router.post('/admin/products/:id/images', requireAdmin, upload.any(), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  const saved = [];
  for (const f of req.files || []) {
    try {
      const { url } = saveBuffer(f.buffer);
      saved.push(saveImageRow(product.id, url, 'upload'));
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }
  if (!saved.length) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  res.status(201).json({ images: productImages(product.id) });
});

// ---------- Borrar imagen ----------
router.delete('/admin/images/:id', requireAdmin, (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Imagen no encontrada' });
  fs.rm(path.join(UPLOADS_DIR, path.basename(img.url)), { force: true }, () => {});
  db.prepare('DELETE FROM product_images WHERE id = ?').run(img.id);
  if (img.is_main) {
    const next = db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY position, id LIMIT 1').get(img.product_id);
    if (next) db.prepare('UPDATE product_images SET is_main = 1 WHERE id = ?').run(next.id);
  }
  res.json({ ok: true, images: productImages(img.product_id) });
});

// ---------- Marcar como principal ----------
router.put('/admin/images/:id/main', requireAdmin, (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Imagen no encontrada' });
  db.prepare('UPDATE product_images SET is_main = 0 WHERE product_id = ?').run(img.product_id);
  db.prepare('UPDATE product_images SET is_main = 1 WHERE id = ?').run(img.id);
  res.json({ ok: true, images: productImages(img.product_id) });
});

// ---------- Logo de la tienda ----------
router.post('/admin/logo', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió el logo' });
  let saved;
  try {
    saved = saveBuffer(req.file.buffer);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
  // Borrar logo anterior
  const old = getSettings().logo_url;
  if (old && old.startsWith('/uploads/')) {
    fs.rm(path.join(UPLOADS_DIR, path.basename(old)), { force: true }, () => {});
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('logo_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(saved.url);
  res.status(201).json({ logo_url: saved.url });
});

router.delete('/admin/logo', requireAdmin, (req, res) => {
  const old = getSettings().logo_url;
  if (old && old.startsWith('/uploads/')) {
    fs.rm(path.join(UPLOADS_DIR, path.basename(old)), { force: true }, () => {});
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('logo_url', '') ON CONFLICT(key) DO UPDATE SET value = ''").run();
  res.json({ ok: true });
});

// Errores de multer / sniff
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.status === 400) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message) return res.status(400).json({ error: err.message });
  next(err);
});

module.exports = router;
