'use strict';

/* ============================================================
   Catálogo dinámico: riel horizontal, pestañas de categoría,
   favoritos, buscador desplegable y animaciones de scroll.
   ============================================================ */

let PRODUCTS = [];
let activeCat = '';
let activeSize = null;
let searchTerm = '';
let sortMode = 'new';
let favOnly = false;

const FAV_KEY = 'fav_productos_v1';

/* ---------- Favoritos ---------- */
const Fav = {
  get() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; } },
  has(id) { return Fav.get().includes(id); },
  toggle(id) {
    const list = Fav.get();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
    updateFavCount();
    return i < 0;
  }
};

function updateFavCount() {
  const n = Fav.get().length;
  const b = document.querySelector('.js-fav-count');
  if (b) { b.textContent = n; b.style.display = n ? 'flex' : 'none'; }
}

/* ---------- Carga ---------- */
async function loadCatalog() {
  const grid = document.querySelector('.js-grid');
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="product-card" style="pointer-events:none">
      <div class="card-img-wrap" style="background:linear-gradient(100deg,#e5e7eb 30%,#f6f6f6 50%,#e5e7eb 70%);background-size:200% 100%;animation:shimmer 1.4s infinite"></div>
      <div class="card-body"><div style="height:11px;width:35%;background:#e5e7eb;border-radius:2px;margin-bottom:9px"></div><div style="height:12px;width:65%;background:#e5e7eb;border-radius:2px;margin-bottom:8px"></div><div style="height:15px;width:40%;background:#e5e7eb;border-radius:2px"></div></div>
    </div>`).join('');

  try {
    PRODUCTS = await api('/api/products');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">No se pudo cargar el catálogo: ${esc(e.message)}</div>`;
    return;
  }

  buildNav();
  buildPills();
  buildTabs();
  buildSizeFilters();
  buildFooterCats();
  renderRail();
  renderGrid();
  updateFavCount();
}

function allCats() {
  const set = new Set();
  PRODUCTS.forEach((p) => { const c = (p.category || '').trim(); if (c) set.add(c); });
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

function allSizes() {
  const set = new Set();
  PRODUCTS.forEach((p) => (p.sizes || []).forEach((s) => set.add(s)));
  return [...set];
}

function discountPct(p) {
  const list = Number(p.list_price) || 0;
  if (list <= 0 || list <= p.price) return 0;
  return Math.round(((list - p.price) / list) * 100);
}

/* ---------- Tarjeta ---------- */
function cardHTML(p, i = 0) {
  const off = discountPct(p);
  const listPrice = Number(p.list_price) || 0;
  const faved = Fav.has(p.id);
  const hasSizes = (p.sizes || []).length > 0;
  const out = p.stock <= 0;
  const url = `/producto.html?id=${p.id}`;

  return `
  <div class="product-card reveal" data-id="${p.id}" style="transition-delay:${Math.min(i * 45, 360)}ms">
    <div class="card-img-wrap">
      <a class="card-link" href="${url}" aria-label="${esc(p.name)}">
        <img class="card-img" src="${esc(p.main_image || placeholderImg())}" alt="${esc(p.name)}" onerror="this.src=placeholderImg()">
      </a>
      ${off > 0 ? `<span class="badge-off">-${off}%</span>` : ''}
      <button class="fav-btn ${faved ? 'faved' : ''}" data-fav="${p.id}" aria-label="Guardar en favoritos" aria-pressed="${faved}">
        <svg viewBox="0 0 24 24" fill="${faved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.9z"/></svg>
      </button>
      ${out ? '' : `<button class="quick-add" data-add="${p.id}">Agregar</button>`}
    </div>
    <div class="card-body">
      ${(p.category || '') ? `<div class="card-cat">${esc(p.category)}</div>` : ''}
      <a href="${url}"><h3>${esc(p.name)}</h3></a>
      <div class="card-prices">
        <span class="card-price">${fmtMoney(p.price)}</span>
        ${off > 0 ? `<span class="card-list">${fmtMoney(listPrice)}</span><span class="card-off">-${off}%</span>` : ''}
      </div>
      ${hasSizes ? `<div class="card-sizes">${p.sizes.slice(0, 4).map(esc).join(' · ')}</div>` : ''}
      ${out ? '<span class="badge-soldout">Sin stock</span>' : ''}
    </div>
  </div>`;
}

/* ---------- Riel de destacados ---------- */
function renderRail() {
  const rail = document.querySelector('.js-rail');
  if (!rail) return;
  const list = PRODUCTS.filter((p) => p.stock > 0).slice(0, 10);
  const section = rail.closest('.rail-section');
  if (!list.length) { if (section) section.style.display = 'none'; return; }
  rail.innerHTML = list.map((p, i) => cardHTML(p, i)).join('');
  initReveal(rail);
}

/* ---------- Pestañas y filtros ---------- */
function buildTabs() {
  const box = document.querySelector('.js-tabs');
  if (!box) return;
  const cats = allCats();
  box.innerHTML = `<button class="tab active" data-cat="">Todo</button>` +
    cats.map((c) => `<button class="tab" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  box.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    setCat(t.dataset.cat || '');
  });
}

function buildPills() {
  const box = document.querySelector('.js-pills');
  if (!box) return;
  const cats = allCats();
  if (cats.length < 2) { box.parentElement.style.display = 'none'; return; }
  box.innerHTML = cats.map((c) => `<button class="pill" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.pill');
    if (!b) return;
    setCat(b.dataset.cat || '');
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function buildSizeFilters() {
  const box = document.querySelector('.js-size-filters');
  const sizes = allSizes();
  box.innerHTML = sizes.length
    ? `<button class="chip active" data-size="">Talles</button>` +
      sizes.map((s) => `<button class="chip" data-size="${esc(s)}">${esc(s)}</button>`).join('')
    : '';
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    activeSize = chip.dataset.size || null;
    box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderGrid();
  });
}

function buildFooterCats() {
  const ul = document.querySelector('.js-footer-cats');
  if (!ul) return;
  const cats = allCats();
  ul.innerHTML = cats.length
    ? cats.map((c) => `<li><a href="#catalogo" data-footcat="${esc(c)}">${esc(c)}</a></li>`).join('')
    : '<li>Agregá categorías desde el panel</li>';
  ul.addEventListener('click', (e) => {
    const a = e.target.closest('[data-footcat]');
    if (!a) return;
    e.preventDefault();
    setCat(a.dataset.footcat);
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function buildNav() {
  const cats = allCats();
  const html = `<a href="#" class="nav-link active" data-cat="">Todo</a>` +
    cats.map((c) => `<a href="#" class="nav-link" data-cat="${esc(c)}">${esc(c)}</a>`).join('');
  ['.js-catnav', '.js-mobilenav'].forEach((sel) => {
    const nav = document.querySelector(sel);
    if (!nav) return;
    nav.innerHTML = html;
    nav.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link');
      if (!link) return;
      e.preventDefault();
      setCat(link.dataset.cat || '');
    });
  });
}

function setCat(cat) {
  activeCat = cat;
  document.querySelectorAll('.nav-link, .tab').forEach((el) => {
    el.classList.toggle('active', (el.dataset.cat || '') === cat);
  });
  document.querySelectorAll('.pill').forEach((el) => {
    el.classList.toggle('active', (el.dataset.cat || '') === cat);
  });
  renderGrid();
}

/* ---------- Grilla ---------- */
function filtered() {
  let list = PRODUCTS.slice();
  if (favOnly) list = list.filter((p) => Fav.has(p.id));
  if (activeCat) list = list.filter((p) => (p.category || '').trim() === activeCat);
  if (activeSize) list = list.filter((p) => (p.sizes || []).includes(activeSize));
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    list = list.filter((p) =>
      (p.name || '').toLowerCase().includes(t) ||
      (p.description || '').toLowerCase().includes(t) ||
      (p.category || '').toLowerCase().includes(t)
    );
  }
  if (sortMode === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (sortMode === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (sortMode === 'discount') list.sort((a, b) => discountPct(b) - discountPct(a));
  else if (sortMode === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return list;
}

function renderGrid() {
  const grid = document.querySelector('.js-grid');
  const list = filtered();

  const titleEl = document.querySelector('.js-section-title');
  if (titleEl) {
    let t = favOnly ? 'Tus favoritos' : 'Todo el catálogo';
    if (searchTerm) t = `Resultados para "${searchTerm}"`;
    else if (activeCat) t = activeCat;
    titleEl.textContent = `${t} (${list.length})`;
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">${
      favOnly ? 'Todavía no guardaste ningún producto. Tocá el corazón de una tarjeta.'
      : searchTerm ? 'No encontramos productos con esa búsqueda. Probá con otra palabra.'
      : 'No hay productos disponibles por ahora. Volvé pronto.'}</div>`;
    return;
  }

  grid.innerHTML = list.map((p, i) => cardHTML(p, i)).join('');
  initReveal(grid);
}

/* ---------- Acciones en tarjetas ---------- */
function bindCardActions(root) {
  root.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault();
      const id = Number(fav.dataset.fav);
      const added = Fav.toggle(id);
      fav.classList.toggle('faved', added);
      fav.querySelector('svg').setAttribute('fill', added ? 'currentColor' : 'none');
      toast(added ? 'Guardado en favoritos' : 'Quitado de favoritos');
      if (favOnly) renderGrid();
      return;
    }

    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault();
      const p = PRODUCTS.find((x) => x.id === Number(add.dataset.add));
      if (!p) return;
      if ((p.sizes || []).length) {
        toast('Elegí el talle en la página del producto');
        window.location.href = `/producto.html?id=${p.id}`;
        return;
      }
      Cart.add(p, '', 1);
      add.classList.add('added');
      add.textContent = 'Agregado';
      setTimeout(() => { add.classList.remove('added'); add.textContent = 'Agregar'; }, 1400);
    }
  });
}

/* ---------- Arranque ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadGlobalSettings();
  initReveal();
  initHeaderScroll();
  initRipple();

  // Buscador desplegable
  const bar = document.querySelector('.js-search-bar');
  const input = document.querySelector('.js-search');
  let timer;
  document.querySelector('.js-search-toggle')?.addEventListener('click', () => {
    bar.classList.toggle('open');
    if (bar.classList.contains('open')) input.focus();
  });
  document.querySelector('.js-search-close')?.addEventListener('click', () => bar.classList.remove('open'));
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { searchTerm = input.value.trim(); renderGrid(); }, 200);
  });

  // Favoritos (filtro)
  document.querySelector('.js-fav-toggle')?.addEventListener('click', () => {
    favOnly = !favOnly;
    document.querySelector('.js-fav-toggle').classList.toggle('faved', favOnly);
    renderGrid();
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Flechas del riel
  const rail = document.querySelector('.js-rail');
  const step = () => Math.max(240, (rail?.clientWidth || 600) * 0.7);
  document.querySelector('.js-rail-prev')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  document.querySelector('.js-rail-next')?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));

  // Orden
  document.querySelector('.js-sort')?.addEventListener('change', (e) => { sortMode = e.target.value; renderGrid(); });

  // Acciones de tarjeta (grilla y riel)
  bindCardActions(document.querySelector('.js-grid'));
  bindCardActions(document.querySelector('.js-rail'));

  loadCatalog();
});
