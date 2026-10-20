'use strict';
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'catalogo-ropa-dev-secret';
const COOKIE = 'admin_token';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  const a = Buffer.from(s);
  const c = Buffer.from(expected);
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const pair of raw.split(';')) {
    const i = pair.indexOf('=');
    if (i > -1) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}

function getToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return parseCookies(req)[COOKIE] || null;
}

function requireAdmin(req, res, next) {
  const payload = verify(getToken(req));
  if (!payload) return res.status(401).json({ error: 'No autorizado. Inicia sesion.' });
  next();
}

function issueToken(res, username) {
  const maxAge = 7 * 24 * 3600;
  const token = sign({ u: username, exp: Date.now() + maxAge * 1000 });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
  return token;
}

function clearToken(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

module.exports = { requireAdmin, issueToken, clearToken, verify, getToken };
