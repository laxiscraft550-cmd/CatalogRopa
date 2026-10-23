'use strict';

/* ============================================================
   Catálogo por secciones de categoría.
   Cada categoría es su propia sección con scroll suave desde
   el menú, resaltado al hacer scroll, favoritos, buscador y
   compra directa por WhatsApp.
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

/* ---------- Utilidades de categoría ---------- */
const CAT_FALLBACK = 'Otros';

function catOf(p) {
  return (p.category || '').trim() || CAT_FALLBACK;
}

function catSlug(cat) {
  return String(cat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-categoria';
}

function allCats() {
  const set = new Set();
  PRODUCTS.forEach((p) => set.add(catOf(p)));
  return [...set].sort((a, b) => {
    if (a === CAT_FALLBACK) return 1;
    if (b === CAT_FALLBACK) return -1;
    return a.localeCompare(b, 'es');
  });
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

/* ---------- Carga ---------- */
async function loadCatalog() {
  const box = document.querySelector('.js-sections');
  box.innerHTML = Array.from({ length: 8 }, () => `
    <div class="product-card" style="pointer-events:none">
      <div class="card-img-wrap" style="background:linear-gradient(100deg,#e5e7eb 30%,#f6f6f6 50%,#e5e7eb 70%);background-size:200% 100%;animation:shimmer 1.4s infinite"></div>
      <div class="card-body"><div style="height:11px;width:35%;background:#e5e7eb;border-radius:2px;margin-bottom:9px"></div><div style="height:12px;width:65%;background:#e5e7eb;border-radius:2px;margin-bottom:8px"></div><div style="height:15px;width:40%;background:#e5e7eb;border-radius:2px"></div></div>
    </div>`).join('');

  try {
    PRODUCTS = await api('/api/products');
  } catch (e) {
    box.innerHTML = `<div class="container"><div class="empty-state">No se pudo cargar el catálogo: ${esc(e.message)}</div></div>`;
    return;
  }

  buildNav();
  buildSizeFilters();
  buildFooterCats();
  renderSections();
  updateFavCount();
  initScrollSpy();
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
      ${out ? '' : `
      <div class="card-actions">
        <button class="quick-add" data-add="${p.id}">Agregar</button>
        <button class="quick-wa" data-wa="${p.id}" aria-label="Pedir por WhatsApp" title="Pedir por WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>
      </div>`}
    </div>
    <div class="card-body">
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

/* ---------- Filtrado ---------- */
function filtered() {
  let list = PRODUCTS.slice();
  if (favOnly) list = list.filter((p) => Fav.has(p.id));
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

/* ---------- Render de secciones ---------- */
function renderSections() {
  const box = document.querySelector('.js-sections');
  const list = filtered();

  // Estado especial: buscando o viendo favoritos → una sola sección de resultados
  const especial = favOnly || searchTerm;
  if (especial) {
    const titulo = favOnly ? 'Tus favoritos' : `Resultados para "${searchTerm}"`;
    box.innerHTML = `
      <section class="cat-section reveal reveal-on" id="cat-resultados">
        <div class="container">
          <div class="cat-head">
            <span class="kicker">${esc(titulo)}</span>
            <div class="cat-title-row">
              <h2>${list.length} producto${list.length === 1 ? '' : 's'}</h2>
              <button class="clear-filter js-clear-filter">Limpiar filtros</button>
            </div>
          </div>
          <div class="product-grid js-grid">${
            list.length ? list.map((p, i) => cardHTML(p, i)).join('')
            : `<div class="empty-state">${
                favOnly ? 'Todavía no guardaste ningún producto. Tocá el corazón de una tarjeta.'
                : 'No encontramos productos con esa búsqueda. Probá con otra palabra.'}</div>`
          }</div>
        </div>
      </section>`;
    bindSectionActions(box);
    box.querySelector('.js-clear-filter')?.addEventListener('click', clearFilters);
    return;
  }

  // Estado normal: una sección por categoría
  if (activeCat) list = list.filter((p) => catOf(p) === activeCat);

  const cats = allCats();
  if (!cats.length) {
    box.innerHTML = `<div class="container"><div class="empty-state">No hay productos disponibles por ahora. Volvé pronto.</div></div>`;
    return;
  }

  box.innerHTML = cats.map((cat, ci) => {
    const items = list.filter((p) => catOf(p) === cat);
    if (!items.length) return '';
    return `
    <section class="cat-section reveal" id="cat-${catSlug(cat)}" data-cat="${esc(cat)}">
      <div class="container">
        <div class="cat-head">
          <span class="kicker">Categoría ${String(ci + 1).padStart(2, '0')}</span>
          <div class="cat-title-row">
            <h2>${esc(cat)}</h2>
            <a class="cat-count" href="#cat-${catSlug(cat)}">${items.length} producto${items.length === 1 ? '' : 's'}</a>
          </div>
        </div>
        <div class="product-grid js-grid">${items.map((p, i) => cardHTML(p, i)).join('')}</div>
      </div>
    </section>`;
  }).join('');

  bindSectionActions(box);
  initReveal(box);
}

/* ---------- Filtros y navegación ---------- */
function buildNav() {
  const cats = allCats();
  const html = `<a href="#secciones" class="nav-link active" data-cat="">Todo</a>` +
    cats.map((c) => `<a href="#cat-${catSlug(c)}" class="nav-link" data-cat="${esc(c)}">${esc(c)}</a>`).join('');
  ['.js-catnav', '.js-mobilenav'].forEach((sel) => {
    const nav = document.querySelector(sel);
    if (!nav) return;
    nav.innerHTML = html;
    nav.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link');
      if (!link) return;
      e.preventDefault();
      setCat(link.dataset.cat || '');
      const target = link.dataset.cat
        ? document.getElementById('cat-' + catSlug(link.dataset.cat))
        : document.getElementById('secciones');
      // scroll suave con compensación de cabecera fija
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

function buildSizeFilters() {
  const box = document.querySelector('.js-size-filters');
  const sizes = allSizes();
  if (!box) return;
  if (!sizes.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<button class="chip active" data-size="">Talles</button>` +
    sizes.map((s) => `<button class="chip" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    activeSize = chip.dataset.size || null;
    box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderSections();
  });
}

function buildFooterCats() {
  const ul = document.querySelector('.js-footer-cats');
  if (!ul) return;
  const cats = allCats();
  ul.innerHTML = cats.length
    ? cats.map((c) => `<li><a href="#cat-${catSlug(c)}" data-footcat="${esc(c)}">${esc(c)}</a></li>`).join('')
    : '<li>Agregá categorías desde el panel</li>';
  ul.addEventListener('click', (e) => {
    const a = e.target.closest('[data-footcat]');
    if (!a) return;
    e.preventDefault();
    setCat(a.dataset.footcat);
    const target = document.getElementById('cat-' + catSlug(a.dataset.footcat));
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  });
}

function setCat(cat) {
  activeCat = cat;
  document.querySelectorAll('.nav-link').forEach((el) => {
    el.classList.toggle('active', (el.dataset.cat || '') === cat);
  });
  // salir de modo especial para volver a las secciones
  if (favOnly || searchTerm) { favOnly = false; searchTerm = ''; const s = document.querySelector('.js-search'); if (s) s.value = ''; document.querySelector('.js-fav-toggle')?.classList.remove('faved'); }
  renderSections();
}

function clearFilters() {
  favOnly = false;
  searchTerm = '';
  activeSize = null;
  const s = document.querySelector('.js-search');
  if (s) s.value = '';
  document.querySelector('.js-fav-toggle')?.classList.remove('faved');
  document.querySelectorAll('.js-size-filters .chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  renderSections();
}

/* ---------- Acciones en tarjetas ---------- */
function bindSectionActions(root) {
  root.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault();
      const id = Number(fav.dataset.fav);
      const added = Fav.toggle(id);
      fav.classList.toggle('faved', added);
      fav.querySelector('svg').setAttribute('fill', added ? 'currentColor' : 'none');
      toast(added ? 'Guardado en favoritos' : 'Quitado de favoritos');
      if (favOnly) renderSections();
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
      return;
    }

    const wa = e.target.closest('[data-wa]');
    if (wa) {
      e.preventDefault();
      const p = PRODUCTS.find((x) => x.id === Number(wa.dataset.wa));
      if (p) Cart.orderOne(p);
    }
  });
}

/* ---------- Resaltado de navegación al hacer scroll ---------- */
let spyObserver = null;
function initScrollSpy() {
  const links = document.querySelectorAll('.js-catnav .nav-link, .js-mobilenav .nav-link');
  if (!links.length || !('IntersectionObserver' in window)) return;
  if (spyObserver) spyObserver.disconnect();

  const byId = {};
  links.forEach((l) => {
    const cat = l.dataset.cat || '';
    byId[cat ? 'cat-' + catSlug(cat) : 'secciones'] = l;
  });

  spyObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      // "Todo" se marca mientras no esté ninguna otra categoría en vista
      links.forEach((l) => l.classList.remove('active'));
      (byId[id] || byId['secciones'])?.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  Object.keys(byId).forEach((id) => {
    const el = document.getElementById(id);
    if (el) spyObserver.observe(el);
  });
}

/* ---------- Arranque ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadGlobalSettings();
  initReveal();
  initHeaderScroll();
  initRipple();
  initScrollProgress();

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
    timer = setTimeout(() => {
      searchTerm = input.value.trim();
      if (searchTerm) { favOnly = false; document.querySelector('.js-fav-toggle')?.classList.remove('faved'); }
      renderSections();
    }, 200);
  });

  // Favoritos (filtro)
  document.querySelector('.js-fav-toggle')?.addEventListener('click', () => {
    favOnly = !favOnly;
    document.querySelector('.js-fav-toggle').classList.toggle('faved', favOnly);
    if (favOnly) { searchTerm = ''; const s = document.querySelector('.js-search'); if (s) s.value = ''; }
    renderSections();
    window.scrollTo({ top: document.getElementById('secciones').getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  });

  // Orden
  document.querySelector('.js-sort')?.addEventListener('change', (e) => { sortMode = e.target.value; renderSections(); });

  // Botón del hero que abre WhatsApp con saludo
  document.querySelector('.js-hero-wa')?.addEventListener('click', (e) => {
    e.preventDefault();
    Cart.openChat();
  });

  loadCatalog();
});
