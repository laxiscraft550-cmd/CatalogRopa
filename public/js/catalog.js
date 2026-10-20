'use strict';

/* Catálogo: carga productos, filtros por talle, orden y animaciones de scroll */

let PRODUCTS = [];
let activeSize = null;
let sortMode = 'new';

async function loadCatalog() {
  const grid = document.querySelector('.js-grid');
  grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="product-card" style="pointer-events:none">
      <div class="card-img-wrap" style="background:linear-gradient(100deg,#eceae4 30%,#f6f5f1 50%,#eceae4 70%);background-size:200% 100%;animation:shimmer 1.4s infinite"></div>
      <div class="card-body"><div style="height:14px;width:60%;background:#eceae4;border-radius:6px;margin-bottom:8px"></div><div style="height:16px;width:35%;background:#eceae4;border-radius:6px"></div></div>
    </div>`).join('');

  try {
    PRODUCTS = await api('/api/products');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">No se pudo cargar el catálogo: ${esc(e.message)}</div>`;
    return;
  }
  buildSizeFilters();
  render();
}

function allSizes() {
  const set = new Set();
  PRODUCTS.forEach((p) => (p.sizes || []).forEach((s) => set.add(s)));
  return [...set];
}

function buildSizeFilters() {
  const box = document.querySelector('.js-size-filters');
  const sizes = allSizes();
  box.innerHTML = sizes.length
    ? `<button class="chip active" data-size="">Todos</button>` +
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

function render() {
  const grid = document.querySelector('.js-grid');
  let list = PRODUCTS.filter((p) => !activeSize || (p.sizes || []).includes(activeSize));

  if (sortMode === 'price-asc') list = list.sort((a, b) => a.price - b.price);
  else if (sortMode === 'price-desc') list = list.sort((a, b) => b.price - a.price);
  else if (sortMode === 'name') list = list.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state">No hay prendas disponibles por ahora. Volvé pronto.</div>';
    return;
  }

  grid.innerHTML = list.map((p, i) => `
    <a class="product-card reveal" href="/producto.html?id=${p.id}" style="transition-delay:${Math.min(i * 60, 400)}ms">
      <div class="card-img-wrap">
        <img class="card-img" src="${esc(p.main_image || placeholderImg())}" alt="${esc(p.name)}" loading="lazy" onerror="this.src=placeholderImg()">
        <span class="card-quick">Ver producto</span>
      </div>
      <div class="card-body">
        <h3>${esc(p.name)}</h3>
        <div class="card-price">${fmtMoney(p.price)}</div>
        ${(p.sizes || []).length ? `<div class="card-sizes">Talles: ${p.sizes.map(esc).join(' · ')}</div>` : ''}
        ${p.stock <= 0 ? '<span class="badge-soldout">Sin stock</span>' : ''}
      </div>
    </a>`).join('');

  initReveal(grid);
}

document.addEventListener('DOMContentLoaded', () => {
  loadGlobalSettings();
  initReveal();
  initHeaderScroll();
  initRipple();
  document.querySelector('.js-sort').addEventListener('change', (e) => {
    sortMode = e.target.value;
    render();
  });
  loadCatalog();
});
