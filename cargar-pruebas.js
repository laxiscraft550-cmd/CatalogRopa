'use strict';
/* Script temporal: carga productos de prueba con fotos para verificar el diseño.
   Las fotos salen de Lorem Picsum (imágenes de Unsplash con licencia libre).
   Borrá los productos "PRUEBA" desde el panel cuando quieras. */

const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const UPLOADS = path.join(__dirname, 'uploads');
const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASSWORD || 'cambia123';

const PRUEBAS = [
  { name: 'PRUEBA Pantalón Jean hombre', category: 'Ropa', price: 60, list_price: 90, cost: 30, stock: 5, sizes: ['32', '34'], seed: 'jeans1' },
  { name: 'PRUEBA Zapatillas urbanas', category: 'Zapatos', price: 119, list_price: 179, cost: 55, stock: 8, sizes: ['37', '38', '39', '40'], seed: 'sneaker7' },
  { name: 'PRUEBA Perfume Floral 100ml', category: 'Perfumes', price: 89, list_price: 149, cost: 40, stock: 12, sizes: [], seed: 'perfume3' },
  { name: 'PRUEBA Audífonos Bluetooth', category: 'Tecnología', price: 45, list_price: 79, cost: 22, stock: 20, sizes: [], seed: 'headphones2' },
  { name: 'PRUEBA Bolso de cuero', category: 'Accesorios', price: 95, list_price: 0, cost: 42, stock: 6, sizes: [], seed: 'bag9' },
  { name: 'PRUEBA Licuadora 1.5L', category: 'Hogar y cocina', price: 129, list_price: 199, cost: 70, stock: 3, sizes: [], seed: 'blender1' }
];

async function login() {
  const r = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS })
  });
  if (!r.ok) throw new Error('Login falló: ' + r.status);
  return r.headers.get('set-cookie') || '';
}

async function bajarFoto(seed, destino) {
  const url = `https://picsum.photos/seed/${seed}/800/1067`;
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`Foto ${seed}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(destino, buf);
  return buf;
}

async function main() {
  if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });
  const cookie = await login();
  const headers = { Cookie: cookie };
  let creados = 0, conFoto = 0, fallasFoto = 0;

  for (const t of PRUEBAS) {
    // ¿Ya existe?
    const lista = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
    let prod = lista.find((p) => p.name === t.name);

    if (!prod) {
      const r = await fetch(`${BASE}/api/admin/products`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: t.name, description: 'Producto de prueba para verificar el diseño del catálogo.',
          category: t.category, price: t.price, list_price: t.list_price,
          cost: t.cost, stock: t.stock, sizes: t.sizes, active: 1
        })
      });
      prod = await r.json();
      creados++;
      console.log(`  creado: ${t.name} (id ${prod.id})`);
    }

    if (prod.images && prod.images.length) { conFoto++; continue; }

    try {
      const destino = path.join(UPLOADS, `prueba-${t.seed}.jpg`);
      const buf = await bajarFoto(t.seed, destino);
      const fd = new FormData();
      fd.append('images', new Blob([buf], { type: 'image/jpeg' }), `prueba-${t.seed}.jpg`);
      const up = await fetch(`${BASE}/api/admin/products/${prod.id}/images`, { method: 'POST', headers, body: fd });
      if (up.ok) { conFoto++; console.log(`  foto subida: ${t.name}`); }
      else { fallasFoto++; console.log(`  foto falló (${up.status}): ${t.name}`); }
    } catch (e) {
      fallasFoto++;
      console.log(`  foto error: ${t.name} -> ${e.message}`);
    }
  }

  console.log(`\nListo. Creados=${creados} conFoto=${conFoto} fallasFoto=${fallasFoto}`);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
