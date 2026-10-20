'use strict';

/* Carrito con localStorage + mensaje de pedido por WhatsApp */

const CART_KEY = 'cart_ropa_v1';

const Cart = {
  getItems() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  },
  save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    Cart.updateBadge();
    document.dispatchEvent(new CustomEvent('cart:change'));
  },
  getCount() {
    return Cart.getItems().reduce((s, i) => s + i.qty, 0);
  },
  add(product, size, qty) {
    const items = Cart.getItems();
    const key = `${product.id}|${size}`;
    const found = items.find((i) => `${i.id}|${i.size}` === key);
    if (found) found.qty += qty;
    else items.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.main_image || '',
      size,
      qty
    });
    Cart.save(items);
  },
  setQty(id, size, qty) {
    let items = Cart.getItems();
    items = items.map((i) => (i.id === id && i.size === size ? { ...i, qty } : i)).filter((i) => i.qty > 0);
    Cart.save(items);
  },
  remove(id, size) {
    Cart.save(Cart.getItems().filter((i) => !(i.id === id && i.size === size)));
  },
  clear() { Cart.save([]); },
  total() {
    return Cart.getItems().reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0);
  },
  updateBadge() {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;
    const n = Cart.getCount();
    badge.textContent = n;
    badge.style.display = n > 0 ? 'flex' : 'none';
    if (n > 0) { badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = ''; }
  },
  buildMessage() {
    const items = Cart.getItems();
    const lines = items.map((i) =>
      `• ${i.qty}x ${i.name}${i.size ? ` (Talle ${i.size})` : ''} — ${fmtMoney(i.price * i.qty)}`
    );
    return [
      `Hola, quiero hacer un pedido de ${STORE_NAME}:`,
      '',
      ...lines,
      '',
      `Total: ${fmtMoney(Cart.total())}`,
      '',
      '¿Me confirman disponibilidad y envío? ¡Gracias!'
    ].join('\n');
  },
  openWhatsApp() {
    const items = Cart.getItems();
    if (!items.length) return;
    const number = (window.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    const text = encodeURIComponent(Cart.buildMessage());
    const url = number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }
};

/* ---- Drawer del carrito ---- */
function mountCartDrawer() {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.innerHTML = `
    <aside class="drawer" role="dialog" aria-label="Carrito">
      <div class="drawer-head">
        <h2>Tu pedido</h2>
        <button class="close-x" aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="drawer-body js-cart-items"></div>
      <div class="drawer-foot">
        <div class="drawer-total"><span>Total</span><span class="js-cart-total">$ 0</span></div>
        <button class="btn btn-green btn-block js-cart-wa">
          <span class="ico" style="width:19px;height:19px"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></span>
          Enviar pedido por WhatsApp
        </button>
      </div>
    </aside>`;
  document.body.appendChild(overlay);

  const open = () => { renderCart(); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { overlay.classList.remove('open'); document.body.style.overflow = ''; };

  document.querySelector('.js-open-cart')?.addEventListener('click', open);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.close-x')) close();
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const { id, size, delta, remove } = qtyBtn.dataset;
      const item = Cart.getItems().find((i) => i.id === Number(id) && i.size === (size || ''));
      if (remove) Cart.remove(Number(id), size || '');
      else if (item) Cart.setQty(Number(id), size || '', item.qty + Number(delta));
      renderCart();
    }
  });
  overlay.querySelector('.js-cart-wa').addEventListener('click', () => {
    if (!Cart.getItems().length) return toast('Tu pedido está vacío', 'error');
    Cart.openWhatsApp();
  });

  function renderCart() {
    const items = Cart.getItems();
    const box = overlay.querySelector('.js-cart-items');
    if (!items.length) {
      box.innerHTML = '<div class="cart-empty">Tu pedido está vacío.<br>Explorá el catálogo y agregá prendas.</div>';
    } else {
      box.innerHTML = items.map((i) => `
        <div class="cart-item">
          <img src="${esc(i.image || placeholderImg())}" alt="${esc(i.name)}" onerror="this.src=placeholderImg()">
          <div class="cart-item-info">
            <h4>${esc(i.name)}</h4>
            <div class="cart-item-meta">${i.size ? 'Talle ' + esc(i.size) : 'Sin talle'}</div>
            <div class="cart-item-row">
              <div class="mini-qty">
                <button data-id="${i.id}" data-size="${esc(i.size)}" data-delta="-1" aria-label="Quitar uno"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <span>${i.qty}</span>
                <button data-id="${i.id}" data-size="${esc(i.size)}" data-delta="1" aria-label="Agregar uno"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="cart-item-price">${fmtMoney(i.price * i.qty)}</span>
                <button class="close-x" style="width:28px;height:28px" data-id="${i.id}" data-size="${esc(i.size)}" data-remove="1" title="Quitar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
          </div>
        </div>`).join('');
    }
    overlay.querySelector('.js-cart-total').textContent = fmtMoney(Cart.total());
  }

  return { open, close };
}

let _drawer = null;
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();
  _drawer = mountCartDrawer();
  loadGlobalSettings().then((s) => {
    window.WHATSAPP_NUMBER = s.whatsapp_number || '';
    document.querySelectorAll('.js-wa-number').forEach((el) => {
      el.textContent = s.whatsapp_number ? '+' + s.whatsapp_number : '';
    });
  });
});
