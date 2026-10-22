'use strict';
const express = require('express');
const { getSettings } = require('../db');
const { requireAdmin } = require('../auth');
const { db } = require('../db');

const router = express.Router();

// Público: datos que necesita la tienda (incluye logo)
router.get('/settings', (req, res) => {
  const s = getSettings();
  res.json({
    store_name: s.store_name || 'Mi Tienda',
    whatsapp_number: s.whatsapp_number || '',
    currency: s.currency || '$',
    logo_url: s.logo_url || ''
  });
});

router.put('/admin/settings', requireAdmin, (req, res) => {
  const allowed = ['store_name', 'whatsapp_number', 'currency'];
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const k of allowed) {
    if (req.body[k] !== undefined) up.run(k, String(req.body[k]));
  }
  const s = getSettings();
  res.json({
    store_name: s.store_name,
    whatsapp_number: s.whatsapp_number,
    currency: s.currency,
    logo_url: s.logo_url || ''
  });
});

module.exports = router;
