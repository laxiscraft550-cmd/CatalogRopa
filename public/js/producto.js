'use strict';

/* Detalle de producto: galería, talle, cantidad y compra */

let PRODUCT = null;
let selectedSize = null;
let qty = 1;

async function loadProduct() {
  const id = new URLSearchParams(location.search).get('id');
  const detail = document.querySelector('.js-detail');
  if (!id) {
    document.querySelector('.js-notfound').style.display = 'block';
    return;
  }
  try {
    PRODUCT = await api(`/api/products/${id}`);
  } catch {
    document.querySelector('.js-notfound').style.display = 'block';
    return;
  }

  document.title = `${PRODUCT.name} — ${STORE_NAME}`;
  detail.style.display = 'grid';

  // Galería
  const imgs = (PRODUCT.images || []).length ? PRODUCT.images.map((i) => i.url) : [placeholderImg()];
  const main = document.querySelector('.js-main-img');
  main.src = imgs[0];
  main.alt = PRODUCT.name;
  const thumbs = document.querySelector('.js-thumbs');
  if (imgs.length > 1) {
    thumbs.innerHTML = imgs.map((u, idx) =>
      `<img src="${esc(u)}" alt="Foto ${idx + 1}" class="${idx === 0 ? 'selected' : ''}" onerror="this.src=placeholderImg()">`
    ).join('');
    thumbs.addEventListener('click', (e) => {
      const t = e.target.closest('img');
      if (!t) return;
      main.src = t.src;
      thumbs.querySelectorAll('img').forEach((x) => x.classList.toggle('selected', x === t));
    });
  }

  // Info
  document.querySelector('.js-name').textContent = PRODUCT.name;
  document.querySelector('.js-price').textContent = fmtMoney(PRODUCT.price);
  document.querySelector('.js-desc').textContent = PRODUCT.description || '';

  const stockEl = document.querySelector('.js-stock');
  if (PRODUCT.stock <= 0) {
    stockEl.textContent = 'Sin stock — volvé pronto';
    stockEl.className = 'stock-note out';
  } else if (PRODUCT.stock <= 3) {
    stockEl.textContent = `¡Últimas ${PRODUCT.stock} unidades!`;
    stockEl.className = 'stock-note low';
  } else {
    stockEl.textContent = 'Disponible en stock';
    stockEl.className = 'stock-note';
  }

  // Talles
  const sizes = PRODUCT.sizes || [];
  const sizeBox = document.querySelector('.js-sizes');
  if (!sizes.length) {
    document.querySelector('.js-size-block').style.display = 'none';
  } else {
    sizeBox.innerHTML = sizes.map((s) => `<button class="size-opt" data-size="${esc(s)}">${esc(s)}</button>`).join('');
    sizeBox.addEventListener('click', (e) => {
      const btn = e.target.closest('.size-opt');
      if (!btn) return;
      selectedSize = btn.dataset.size;
      sizeBox.querySelectorAll('.size-opt').forEach((b) => b.classList.toggle('active', b === btn));
      updateAddBtn();
    });
  }

  updateAddBtn();
}

function updateAddBtn() {
  const addBtn = document.querySelector('.js-add');
  const buyBtn = document.querySelector('.js-buy');
  if (PRODUCT.stock <= 0) {
    addBtn.disabled = true;
    buyBtn.disabled = true;
    addBtn.textContent = 'Sin stock';
    return;
  }
  const hasSizes = (PRODUCT.sizes || []).length > 0;
  const ok = !hasSizes || !!selectedSize;
  addBtn.disabled = !ok;
  buyBtn.disabled = !ok;
  addBtn.textContent = ok ? 'Agregar al pedido' : 'Elegí un talle para continuar';
  if (ok) qty = Math.min(qty, PRODUCT.stock);
  document.querySelector('.js-qty').textContent = qty;
}

document.addEventListener('DOMContentLoaded', () => {
  loadGlobalSettings();
  initReveal();
  initHeaderScroll();
  initRipple();
  document.querySelector('.js-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); updateAddBtn(); });
  document.querySelector('.js-plus').addEventListener('click', () => {
    qty = Math.min(PRODUCT ? Math.max(1, PRODUCT.stock) : 99, qty + 1);
    updateAddBtn();
  });
  document.querySelector('.js-add').addEventListener('click', () => {
    if (!selectedSize && (PRODUCT.sizes || []).length) return toast('Elegí un talle', 'error');
    Cart.add(PRODUCT, selectedSize || '', qty);
    toast(`${PRODUCT.name} agregado al pedido`);
    _drawer?.open();
  });
  document.querySelector('.js-buy').addEventListener('click', () => {
    if (!selectedSize && (PRODUCT.sizes || []).length) return toast('Elegí un talle', 'error');
    Cart.add(PRODUCT, selectedSize || '', qty);
    Cart.openWhatsApp();
  });
  loadProduct();
});
