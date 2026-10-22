'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    category    TEXT    NOT NULL DEFAULT '',
    price       REAL    NOT NULL DEFAULT 0,
    list_price  REAL    NOT NULL DEFAULT 0,
    cost        REAL    NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    sizes       TEXT    NOT NULL DEFAULT '[]',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url        TEXT    NOT NULL,
    kind       TEXT    NOT NULL DEFAULT 'upload',
    position   INTEGER NOT NULL DEFAULT 0,
    is_main    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// --- Migraciones (bases de datos creadas antes de existir la columna) ---
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.log(`[db] Migración: columna ${table}.${column} agregada`);
  }
}
ensureColumn('products', 'cost', 'cost REAL NOT NULL DEFAULT 0');
ensureColumn('products', 'list_price', 'list_price REAL NOT NULL DEFAULT 0');
ensureColumn('products', 'category', "category TEXT NOT NULL DEFAULT ''");

// --- Seed: usuario admin desde .env ---
const adminRow = db.prepare('SELECT id FROM admin_users WHERE id = 1').get();
if (!adminRow) {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (1, ?, ?)')
    .run(user, bcrypt.hashSync(pass, 10));
  console.log(`[db] Usuario admin creado: ${user}`);
}

// --- Seed: ajustes por defecto ---
const seedSettings = {
  store_name: process.env.STORE_NAME || 'Mi Tienda de Ropa',
  whatsapp_number: process.env.WHATSAPP_NUMBER || '',
  currency: process.env.CURRENCY || '$',
  logo_url: ''
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(seedSettings)) insertSetting.run(k, v);

// --- Helpers ---
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function productImages(productId) {
  return db.prepare('SELECT id, url, kind, position, is_main FROM product_images WHERE product_id = ? ORDER BY is_main DESC, position, id').all(productId);
}

function rowToProduct(row, images = []) {
  const main = images.find((i) => i.is_main === 1) || images[0] || null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category || '',
    price: row.price,
    list_price: row.list_price || 0,
    cost: row.cost || 0,
    stock: row.stock,
    sizes: JSON.parse(row.sizes || '[]'),
    active: !!row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images,
    main_image: main ? main.url : null
  };
}

module.exports = { db, ROOT, DATA_DIR, UPLOADS_DIR, getSettings, productImages, rowToProduct };
