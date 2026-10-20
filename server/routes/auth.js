'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAdmin, issueToken, clearToken, verify, getToken } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare('SELECT * FROM admin_users WHERE id = 1').get();
  if (!row || row.username !== username || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  issueToken(res, row.username);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const payload = verify(getToken(req));
  res.json({ admin: !!payload });
});

router.get('/ping-admin', requireAdmin, (req, res) => res.json({ ok: true }));

module.exports = router;
