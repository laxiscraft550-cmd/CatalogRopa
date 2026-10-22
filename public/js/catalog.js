'use strict';

/* Catálogo: búsqueda, categorías, filtros de talle, orden y descuentos */

let PRODUCTS = [];
let activeSize = null;
let activeCat = '';
let searchTerm = '';
let sortMode = 'new';

async function loadCatalog() {
  const grid = document.querySelector('.js-grid');
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="product-card" style="pointer-events:none">
      <div class="card-img-wrap" style="background:linear-gradient(100deg,#eceae4 30%,#f6f5f1 50%,#eceae4 70%);background-size:200% 100%;animation:shimmer 1.4s infinite"></div>
      <div class="card-body"><div style="height:13px;width:35%;background:#eceae4;border-radius:6px;margin-bottom:9px"></div><div style="height:14px;width:65%;background:#eceae4;border-radius:6px;margin-bottom:8px"></div><div style="height:18px;width:40%;background:#eceae4;border-radius:6px"></div></div>
    </div>`).join('');

  try {
    PRODUCTS = await api('/api/products');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">No se pudo cargar el catálogo: ${esc(e.message)}</div>`;
    return;
  }
  buildCatNav();
  buildSizeFilters();
  buildFooterCats();
  render();
}

function allSizes() {
  const set = new Set();
  PRODUCTS.forEach((p) => (p.sizes || []).forEach((s) => set.add(s)));
  return [...set];
}

function allCats() {
  const set = new Set();
  PRODUCTS.forEach((p) => { const c = (p.category || '').trim(); if (c) set.add(c); });
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

// Navegación de categorías (estilo almacén por departamentos)
function buildCatNav() {
  const nav = document.querySelector('.js-catnav');
  const cats = allCats();
  nav.innerHTML = `<a href="#" class="catnav-link active" data-cat="">Todo</a>` +
    cats.map((c) => `<a href="#" class="catnav-link" data-cat="${esc(c)}">${esc(c)}</a>`).join('');
  nav.addEventListener('click', (e) => {
    const link = e.target.closest('.catnav-link');
    if (!link) return;
    e.preventDefault();
    activeCat = link.dataset.cat || '';
    nav.querySelectorAll('.catnav-link').forEach((l) => l.classList.toggle('active', l === link));
    render();
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Categorías en el footer
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
    const cat = a.dataset.footcat;
    activeCat = cat;
    document.querySelectorAll('.catnav-link').forEach((l) => l.classList.toggle('active', l.dataset.cat === cat));
    render();
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
    render();
  });
}

function discountPct(p) {
  const list = Number(p.list_price) || 0;
  if (list <= 0 || list <= p.price) return 0;
  return Math.round(((list - p.price) / list) * 100);
}

function render() {
  const grid = document.querySelector('.js-grid');
  let list = PRODUCTS.slice();

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

  // Título de la sección
  const titleEl = document.querySelector('.js-section-title');
  if (titleEl) {
    let t = 'Todo el catálogo';
    if (searchTerm) t = `Resultados para "${searchTerm}"`;
    else if (activeCat) t = activeCat;
    titleEl.textContent = `${t} (${list.length})`;
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">${searchTerm
      ? 'No encontramos productos con esa búsqueda. Probá con otra palabra.'
      : 'No hay productos disponibles por ahora. Volvé pronto.'}</div>`;
    return;
  }

  grid.innerHTML = list.map((p, i) => {
    const off = discountPct(p);
    const listPrice = Number(p.list_price) || 0;
    const showList = off > 0 ? `<span class="card-list">${fmtMoney(listPrice)}</span><span class="card-off">-${off}%</span>` : '';
    return `
    <a class="product-card reveal" href="/producto.html?id=${p.id}" style="transition-delay:${Math.min(i * 50, 400)}ms">
      <div class="card-img-wrap">
        ${off > 0 ? `<span class="badge-off">-${off}%</span>` : ''}
        <img class="card-img" src="${esc(p.main_image || placeholderImg())}" alt="${esc(p.name)}" loading="lazy" onerror="this.src=placeholderImg()">
        <span class="card-quick">Ver producto</span>
      </div>
      <div class="card-body">
        ${(p.category || '') ? `<div class="card-cat">${esc(p.category)}</div>` : ''}
        <h3>${esc(p.name)}</h3>
        <div class="card-prices">
          <span class="card-price">${fmtMoney(p.price)}</span>
          ${showList}
        </div>
        ${(p.sizes || []).length ? `<div class="card-sizes">Talles: ${p.sizes.map(esc).join(' · ')}</div>` : ''}
        ${p.stock <= 0 ? '<span class="badge-soldout">Sin stock</span>' : ''}
      </div>
    </a>`;
  }).join('');

  initReveal(grid);
}

document.addEventListener('DOMContentLoaded', () => {
  loadGlobalSettings();
  initReveal();
  initHeaderScroll();
  initRipple();

  // Buscador
  const searchInput = document.querySelector('.js-search');
  const searchForm = document.querySelector('.js-search-form');
  let searchTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTerm = searchInput.value.trim();
      render();
    }, 220);
  });
  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    searchTerm = searchInput.value.trim();
    render();
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelector('.js-sort')?.addEventListener('change', (e) => {
    sortMode = e.target.value;
    render();
  });

  loadCatalog();
});
