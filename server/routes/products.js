'use strict';
const express = require('express');
const { db, productImages, rowToProduct } = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// Tallas permitidas: letras (ropa) + numericas de pantalon (cintura en pulgadas)
const ALLOWED_SIZES = [
  'Único', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
  '26', '28', '30', '32', '34', '36', '38', '40', '42', '44'
];

function cleanSizes(sizes) {
  if (!Array.isArray(sizes)) return [];
  return [...new Set(sizes.filter((s) => ALLOWED_SIZES.includes(s)))];
}

// ---------- Publico ----------
// Quita datos sensibles (costo de compra) antes de mostrar al cliente
function toPublic(p) {
  const { cost, ...rest } = p;
  return rest;
}

router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC, id DESC').all();
  res.json(rows.map((r) => toPublic(rowToProduct(r, productImages(r.id)))));
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(toPublic(rowToProduct(row, productImages(row.id))));
});

// ---------- Admin ----------
router.get('/admin/products', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC, id DESC').all();
  res.json(rows.map((r) => rowToProduct(r, productImages(r.id))));
});

router.post('/admin/products', requireAdmin, (req, res) => {
  const { name, description = '', category = '', price = 0, list_price = 0, cost = 0, stock = 0, sizes = [], active = 1 } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const info = db.prepare('INSERT INTO products (name, description, category, price, list_price, cost, stock, sizes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(String(name).trim(), String(description), String(category).trim(), Number(price) || 0, Number(list_price) || 0, Number(cost) || 0, Math.max(0, parseInt(stock, 10) || 0), JSON.stringify(cleanSizes(sizes)), active ? 1 : 0);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToProduct(row, []));
});

router.put('/admin/products/:id', requireAdmin, async (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  const b = req.body || {};
  const name = b.name !== undefined ? String(b.name).trim() : row.name;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  db.prepare(`
    UPDATE products SET name = ?, description = ?, category = ?, price = ?, list_price = ?, cost = ?, stock = ?, sizes = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name,
    b.description !== undefined ? String(b.description) : row.description,
    b.category !== undefined ? String(b.category).trim() : (row.category || ''),
    b.price !== undefined ? Number(b.price) || 0 : row.price,
    b.list_price !== undefined ? Number(b.list_price) || 0 : (row.list_price || 0),
    b.cost !== undefined ? Number(b.cost) || 0 : (row.cost || 0),
    b.stock !== undefined ? Math.max(0, parseInt(b.stock, 10) || 0) : row.stock,
    b.sizes !== undefined ? JSON.stringify(cleanSizes(b.sizes)) : row.sizes,
    b.active !== undefined ? (b.active ? 1 : 0) : row.active,
    row.id
  );
  // Cambiar foto principal
  if (b.main_image_id !== undefined) {
    db.prepare('UPDATE product_images SET is_main = 0 WHERE product_id = ?').run(row.id);
    if (b.main_image_id !== null) {
      db.prepare('UPDATE product_images SET is_main = 1 WHERE id = ? AND product_id = ?').run(b.main_image_id, row.id);
    }
  }
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(row.id);
  res.json(rowToProduct(updated, productImages(row.id)));
});

router.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  // Borrar archivos de imagenes del disco
  const fs = require('fs');
  const path = require('path');
  const { UPLOADS_DIR } = require('../db');
  for (const img of productImages(row.id)) {
    const file = path.join(UPLOADS_DIR, path.basename(img.url));
    fs.rm(file, { force: true }, () => {});
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.ALLOWED_SIZES = ALLOWED_SIZES;
