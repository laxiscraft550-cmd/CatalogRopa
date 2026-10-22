'use strict';

/* Panel de admin: CRUD de productos, fotos con editor, logo, IA y ajustes */

// Tallas agrupadas: letras (ropa) y numericas de pantalon (cintura pulgadas)
const SIZE_GROUPS = [
  { label: 'Ropa (letras)', sizes: ['Único', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { label: 'Pantalón (pulgadas)', sizes: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'] }
];
const ALL_SIZES = SIZE_GROUPS.flatMap((g) => g.sizes);
let PRODUCTS = [];
let AI_CONFIGURED = false;

/* ---------- Sesión ---------- */
(async function guard() {
  try {
    const r = await api('/api/me');
    if (!r.admin) location.href = '/admin/login.html';
  } catch {
    location.href = '/admin/login.html';
  }
  loadGlobalSettings();
  init();
  initRipple();
})();

document.querySelector('.js-logout').addEventListener('click', async (e) => {
  e.preventDefault();
  await api('/api/logout', { method: 'POST' });
  location.href = '/admin/login.html';
});

/* ---------- Tabs ---------- */
document.querySelectorAll('.admin-nav a[data-tab]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.admin-nav a').forEach((x) => x.classList.remove('active'));
    a.classList.add('active');
    const tab = a.dataset.tab;
    document.getElementById('tab-productos').style.display = tab === 'productos' ? '' : 'none';
    document.getElementById('tab-ajustes').style.display = tab === 'ajustes' ? '' : 'none';
    document.getElementById('tab-calculadora').style.display = tab === 'calculadora' ? '' : 'none';
    if (tab === 'calculadora') initCalc();
  });
});

async function init() {
  await loadAiStatus();
  await loadProducts();
  await loadSettingsForm();
  renderLogo();
}

async function loadAiStatus() {
  try {
    const s = await api('/api/admin/ai-status');
    AI_CONFIGURED = s.configured;
    const el = document.querySelector('.js-ai-status');
    if (!el) return;
    el.innerHTML = s.configured
      ? `Proveedor activo: <b>${esc(s.provider)}</b>. En cada foto de prenda aparecerá el botón "Foto de modelo" para convertirla en una imagen de maniquí.`
      : `Sin configurar. Para activarla, editá el archivo <code>.env</code> y poné:<br><code>IA_PROVIDER=gemini</code><br><code>IA_API_KEY=tu-clave</code><br>y reiniciá el servidor. Mientras tanto podés subir vos las fotos de modelo manualmente.`;
  } catch { /* IA desactivada */ }
}

async function loadProducts() {
  try {
    PRODUCTS = await api('/api/admin/products');
  } catch (e) {
    return toast(e.message, 'error');
  }
  renderStats();
  renderRows();
  fillCategoryList();
}

// Llena el datalist de categorías con las ya usadas
function fillCategoryList() {
  const dl = document.getElementById('cat-list');
  if (!dl) return;
  const cats = [...new Set(PRODUCTS.map((p) => (p.category || '').trim()).filter(Boolean))];
  dl.innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
}

function renderStats() {
  const total = PRODUCTS.length;
  const visible = PRODUCTS.filter((p) => p.active).length;
  const stock = PRODUCTS.reduce((s, p) => s + (p.stock || 0), 0);
  const low = PRODUCTS.filter((p) => p.stock > 0 && p.stock <= 3).length;
  // Rentabilidad potencial: suma de (precio - costo) * stock de los productos con costo cargado
  const renta = PRODUCTS.reduce((s, p) => {
    const c = Number(p.cost) || 0;
    if (c <= 0) return s;
    return s + ((Number(p.price) || 0) - c) * (p.stock || 0);
  }, 0);
  document.querySelector('.js-stats').innerHTML = [
    ['Productos', total],
    ['Visibles', visible],
    ['Unidades en stock', stock],
    ['Poco stock (≤3)', low],
    ['Ganancia potencial', fmtMoney(Math.max(0, Math.round(renta)))]
  ].map(([lbl, num]) => `<div class="stat-card"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');
}

function renderRows() {
  const tbody = document.querySelector('.js-rows');
  document.querySelector('.js-empty').style.display = PRODUCTS.length ? 'none' : 'block';
  tbody.innerHTML = PRODUCTS.map((p) => {
    const cost = Number(p.cost) || 0;
    const price = Number(p.price) || 0;
    const ganancia = cost > 0 ? price - cost : null;
    const margen = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null;
    const gananciaHtml = ganancia === null
      ? '<span class="muted">—</span>'
      : `<div class="ganancia ${ganancia > 0 ? 'pos' : 'neg'}">${fmtMoney(ganancia)}<span class="margen">${margen}%</span></div>`;
    return `
    <tr>
      <td>${p.main_image
        ? `<img class="thumb-sm" src="${esc(p.main_image)}" alt="" onerror="this.style.display='none'">`
        : `<div class="thumb-none">${icon('image', 20)}</div>`}</td>
      <td><b>${esc(p.name)}</b><div class="muted">${esc((p.description || '').slice(0, 50))}${(p.description || '').length > 50 ? '…' : ''}</div></td>
      <td>${cost > 0 ? fmtMoney(cost) : '<span class="muted">—</span>'}</td>
      <td><b>${fmtMoney(price)}</b></td>
      <td>${gananciaHtml}</td>
      <td>${p.stock}</td>
      <td class="muted">${(p.sizes || []).map(esc).join(' · ') || '—'}</td>
      <td><span class="tag ${p.active ? 'tag-on' : 'tag-off'}">${p.active ? 'Visible' : 'Oculto'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-ghost js-edit" data-id="${p.id}">${icon('edit', 14)} Editar</button>
          <button class="btn btn-sm btn-ghost js-toggle" data-id="${p.id}">${p.active ? 'Ocultar' : 'Publicar'}</button>
          <button class="btn btn-sm btn-danger js-del" data-id="${p.id}">${icon('trash', 14)}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ---------- Acciones de la tabla ---------- */
document.querySelector('.js-rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;

  if (btn.classList.contains('js-edit')) openEditor(p);
  else if (btn.classList.contains('js-toggle')) {
    try {
      await api(`/api/admin/products/${id}`, { method: 'PUT', body: { active: !p.active } });
      toast(p.active ? 'Producto ocultado' : 'Producto publicado');
      loadProducts();
    } catch (err) { toast(err.message, 'error'); }
  } else if (btn.classList.contains('js-del')) {
    if (!confirm(`¿Borrar "${p.name}" y todas sus fotos?`)) return;
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      toast('Producto eliminado');
      loadProducts();
    } catch (err) { toast(err.message, 'error'); }
  }
});

/* ---------- Editor ---------- */
const overlay = document.getElementById('editor-overlay');
const form = document.getElementById('product-form');
let CURRENT = null;

document.querySelector('.js-sizes-picker').innerHTML = SIZE_GROUPS.map((g) => `
  <div class="size-group" style="width:100%">
    <span class="size-group-label">${g.label}</span>
    <div class="check-row" style="margin-bottom:6px">
      ${g.sizes.map((s) => `<label class="check-chip"><input type="checkbox" value="${s}">${s}</label>`).join('')}
    </div>
  </div>`).join('');
document.querySelector('.js-sizes-picker').addEventListener('change', (e) => {
  e.target.closest('.check-chip').classList.toggle('on', e.target.checked);
});

document.querySelector('.js-new').addEventListener('click', () => openEditor(null));
document.querySelectorAll('.js-close-editor').forEach((b) => b.addEventListener('click', closeEditor));
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditor(); });

// Sugerir precio de venta a partir del costo
document.querySelector('.js-suggest-price').addEventListener('click', () => {
  const costo = Number(form.cost.value) || 0;
  if (costo <= 0) return toast('Primero cargá el precio de compra', 'error');
  // 2.5x para nacional, 3x para marca (no distinguimos tipo acá, usamos 2.5x por defecto
  // pero si hay precio de etiqueta en el campo, asumimos marca -> 3x)
  const markup = 2.5;
  const p = Math.round(costo * markup);
  form.price.value = p % 10 === 0 ? p - 1 : p;
  toast(`Precio sugerido: ${fmtMoney(form.price.value)} (x${markup} sobre tu costo)`);
});

function openEditor(p) {
  CURRENT = p;
  form.reset();
  form.id.value = p ? p.id : '';
  form.name.value = p ? p.name : '';
  form.price.value = p ? p.price : '';
  form.list_price.value = p && p.list_price ? p.list_price : '';
  form.cost.value = p && p.cost ? p.cost : '';
  form.stock.value = p ? p.stock : '';
  form.description.value = p ? p.description : '';
  form.category.value = p ? (p.category || '') : '';
  form.active.checked = p ? p.active : true;
  document.querySelectorAll('.js-sizes-picker input').forEach((cb) => {
    cb.checked = p ? (p.sizes || []).includes(cb.value) : false;
    cb.closest('.check-chip').classList.toggle('on', cb.checked);
  });
  document.querySelector('.js-editor-title').textContent = p ? `Editar: ${p.name}` : 'Nuevo producto';
  document.querySelector('.js-photos-box').style.display = p ? 'block' : 'none';
  if (p) renderPhotos();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEditor() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  CURRENT = null;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: form.name.value,
    price: Number(form.price.value),
    list_price: Number(form.list_price.value) || 0,
    cost: Number(form.cost.value) || 0,
    stock: parseInt(form.stock.value, 10) || 0,
    description: form.description.value,
    category: form.category.value.trim(),
    sizes: [...document.querySelectorAll('.js-sizes-picker input:checked')].map((c) => c.value),
    active: form.active.checked ? 1 : 0
  };
  try {
    if (CURRENT) {
      await api(`/api/admin/products/${CURRENT.id}`, { method: 'PUT', body });
      toast('Producto actualizado');
      closeEditor();
    } else {
      const created = await api('/api/admin/products', { method: 'POST', body });
      toast('Producto creado. Ahora subile fotos');
      CURRENT = created;
      form.id.value = created.id;
      document.querySelector('.js-editor-title').textContent = `Editar: ${created.name}`;
      document.querySelector('.js-photos-box').style.display = 'block';
      renderPhotos();
    }
    loadProducts();
  } catch (err) { toast(err.message, 'error'); }
});

/* ---------- Fotos ---------- */
function renderPhotos() {
  if (!CURRENT) return;
  const grid = document.querySelector('.js-photo-grid');
  const images = CURRENT.images || [];
  grid.innerHTML = images.length
    ? images.map((img) => `
      <div class="photo-cell" data-img="${img.id}">
        <img src="${esc(img.url)}" alt="" onerror="this.src=placeholderImg()">
        <div class="ph-actions">
          <button class="mini ${img.is_main ? 'main-on' : ''} js-main" ${img.is_main ? 'disabled' : ''}>${img.is_main ? 'Principal' : 'Hacer principal'}</button>
          <button class="mini gen js-gen" ${img.kind === 'generated' ? 'disabled' : ''}>${img.kind === 'generated' ? 'Foto de modelo' : 'Generar modelo'}</button>
          <button class="mini js-del-img">${icon('trash', 12)} Borrar</button>
        </div>
        <div class="kind-tag">${img.kind === 'generated' ? 'Generada con IA' : 'Subida'}</div>
      </div>`).join('')
    : '<p class="muted">Todavía sin fotos. Subí la foto de la prenda.</p>';
}

// Subida con editor de ajuste
const drop = document.querySelector('.js-drop');
const fileInput = document.querySelector('.js-file');
drop.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

async function handleFiles(files) {
  if (!CURRENT || !files.length) return;
  fileInput.value = '';
  for (const file of files) {
    let blob = file;
    // Abrir editor para ajustar (recortar/rotar/zoom) cualquier imagen
    try {
      const edited = await editImage(file, { aspect: 3 / 4, title: `Ajustar foto: ${file.name}` });
      blob = edited;
    } catch (err) {
      if (err.message === 'cancelado') continue;
      toast(err.message, 'error');
      continue;
    }
    const fd = new FormData();
    fd.append('file', blob, 'foto.jpg');
    try {
      const r = await api(`/api/admin/products/${CURRENT.id}/images`, { method: 'POST', body: fd });
      CURRENT.images = r.images;
    } catch (err) { toast(err.message, 'error'); }
  }
  toast('Foto(s) subidas');
  renderPhotos();
  loadProducts();
}

document.querySelector('.js-photo-grid').addEventListener('click', async (e) => {
  const cell = e.target.closest('.photo-cell');
  const btn = e.target.closest('button');
  if (!cell || !btn) return;
  const imgId = Number(cell.dataset.img);

  if (btn.classList.contains('js-main')) {
    try {
      const r = await api(`/api/admin/images/${imgId}/main`, { method: 'PUT' });
      CURRENT.images = r.images;
      renderPhotos();
      loadProducts();
    } catch (err) { toast(err.message, 'error'); }
  } else if (btn.classList.contains('js-del-img')) {
    if (!confirm('¿Borrar esta foto?')) return;
    try {
      const r = await api(`/api/admin/images/${imgId}`, { method: 'DELETE' });
      CURRENT.images = r.images;
      renderPhotos();
      loadProducts();
      toast('Foto borrada');
    } catch (err) { toast(err.message, 'error'); }
  } else if (btn.classList.contains('js-gen')) {
    if (!AI_CONFIGURED) {
      return toast('La IA no está configurada. Andá a Ajustes para ver cómo activarla.', 'error');
    }
    btn.disabled = true;
    btn.textContent = 'Generando…';
    toast('Generando foto de modelo… esto puede tardar unos segundos');
    try {
      const r = await api(`/api/admin/images/${imgId}/generate-model`, { method: 'POST' });
      CURRENT.images = r.images;
      toast('Foto de modelo generada');
      renderPhotos();
      loadProducts();
    } catch (err) {
      toast(err.message, 'error');
      renderPhotos();
    }
  }
});

/* ---------- Logo ---------- */
const logoFile = document.querySelector('.js-logo-file');

function renderLogo() {
  const box = document.querySelector('.js-logo-preview');
  const del = document.querySelector('.js-logo-del');
  const url = (window.LOGO_URL || '');
  if (url) {
    box.innerHTML = `<img src="${esc(url)}" alt="Logo" style="width:100%;height:100%;object-fit:contain">`;
    del.style.display = '';
  } else {
    box.innerHTML = '<span class="muted">Sin logo</span>';
    del.style.display = 'none';
  }
}

document.querySelector('.js-logo-pick').addEventListener('click', () => logoFile.click());
logoFile.addEventListener('change', async () => {
  const file = logoFile.files[0];
  logoFile.value = '';
  if (!file) return;
  let blob = file;
  try {
    // Logo sin recorte fijo: aspecto libre
    blob = await editImage(file, { aspect: 1, title: 'Ajustar logo' });
  } catch (err) {
    if (err.message !== 'cancelado') toast(err.message, 'error');
    return;
  }
  const fd = new FormData();
  fd.append('file', blob, 'logo.jpg');
  try {
    const r = await api('/api/admin/logo', { method: 'POST', body: fd });
    window.LOGO_URL = r.logo_url;
    renderLogo();
    loadGlobalSettings();
    toast('Logo actualizado');
  } catch (err) { toast(err.message, 'error'); }
});

document.querySelector('.js-logo-del').addEventListener('click', async () => {
  if (!confirm('¿Quitar el logo?')) return;
  try {
    await api('/api/admin/logo', { method: 'DELETE' });
    window.LOGO_URL = '';
    renderLogo();
    loadGlobalSettings();
    toast('Logo quitado');
  } catch (err) { toast(err.message, 'error'); }
});

/* ---------- Ajustes ---------- */
const sForm = document.getElementById('settings-form');

async function loadSettingsForm() {
  try {
    const s = await api('/api/settings');
    sForm.store_name.value = s.store_name || '';
    sForm.whatsapp_number.value = s.whatsapp_number || '';
    sForm.currency.value = s.currency || '$';
    window.LOGO_URL = s.logo_url || '';
  } catch { /* ignore */ }
}

sForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: {
        store_name: sForm.store_name.value,
        whatsapp_number: sForm.whatsapp_number.value.replace(/\D/g, ''),
        currency: sForm.currency.value || '$'
      }
    });
    await loadGlobalSettings();
    toast('Ajustes guardados');
  } catch (err) { toast(err.message, 'error'); }
});
