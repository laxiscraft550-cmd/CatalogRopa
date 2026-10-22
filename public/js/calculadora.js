'use strict';

/* ============================================================
   Calculadora de precios para revender ropa.
   Reglas por defecto pensadas para reventa de ropa (nacional e
   importada), ajustables por la persona.
   ============================================================ */

const CalcDefaults = {
  // Markup sobre costo (multiplicador). Ej: 2.5 = vender a 2.5x lo que costó
  markupNacional: 2.5,
  markupImportado: 3.0,
  // Descuento habitual de "precio tachado" (precio de etiqueta inflado)
  markupEtiqueta: 2.0,
  // Comisiones/gastos típicos en % sobre el precio de venta
  gastos: { envio: 8, comision: 5, otros: 5 }, // % del precio de venta
  // Redondeo de precio final
  redondeo: 1 // 1 = al entero más cercano
};

function calcPrecio({
  costo,
  origen = 'nacional',          // nacional | importado | marca
  precioEtiqueta = 0,           // precio "tachado" / de etiqueta (opcional)
  gastosEnvio = 0,              // soles por unidad (no %)
  gastosPlataforma = 0,         // % comision marketplace
  margenObjetivo = 0,           // margen neto deseado sobre precio (0-1). Si >0, manda él
  redondeo = 1
} = {}) {
  costo = Number(costo) || 0;
  if (costo <= 0) return null;

  // Base multiplicadora según origen
  let markup;
  if (origen === 'marca') markup = CalcDefaults.markupImportado;
  else if (origen === 'importado') markup = CalcDefaults.markupImportado;
  else markup = CalcDefaults.markupNacional;

  // Precio "sin gastos" (antes de considerar envío/comisión)
  let precioBase = costo * markup;

  // Si hay precio de etiqueta, nunca lo superamos (se usa como tope de referencia)
  // y lo mostramos como precio tachado.
  let precioEtiquetaMostrar = 0;
  if (precioEtiqueta > 0) {
    precioEtiquetaMostrar = Math.max(precioEtiqueta, precioBase * 1.3);
    // objetivo: dejar el precio base "con descuento" respecto a la etiqueta
  }

  // Gastos sobre el precio de venta: envío fijo en soles + % comisión
  // Precio final P satisface: P = precioBase + gastosEnvio + P*(gastosPlataforma/100)
  const pct = (Number(gastosPlataforma) || 0) / 100;
  let precio = (precioBase + (Number(gastosEnvio) || 0)) / (1 - pct);

  // Si se define un margen neto objetivo (sobre el precio final), úsalo:
  // margen = (P - costoTotal) / P  =>  P = costoTotal / (1 - margen)
  const costoTotal = costo + (Number(gastosEnvio) || 0);
  if (margenObjetivo > 0 && margenObjetivo < 1) {
    precio = costoTotal / (1 - margenObjetivo);
  }

  // Redondeo "bonito" de venta (psicológico): terminado en 9 o 0
  precio = redondearPrecio(precio, redondeo);

  // Métricas
  const ganancia = precio - costoTotal;
  const margenNeto = precio > 0 ? ganancia / precio : 0;
  const markupReal = costoTotal > 0 ? precio / costoTotal : 0;
  const descuentoEtiqueta = precioEtiquetaMostrar > 0
    ? (precioEtiquetaMostrar - precio) / precioEtiquetaMostrar
    : 0;

  return {
    costo,
    costoTotal: round2(costoTotal),
    precio: round2(precio),
    precioEtiquetaMostrar: round2(precioEtiquetaMostrar),
    ganancia: round2(ganancia),
    margenNeto: round2(margenNeto * 100), // en %
    markupReal: round2(markupReal),         // "veces"
    descuentoEtiqueta: round2(descuentoEtiqueta * 100) // en %
  };
}

function redondearPrecio(p, modo) {
  if (!modo || modo === 1) {
    // al entero, pero preferimos terminar en 9 o 5 (psicológico)
    const entero = Math.round(p);
    // si está muy cerca de un número "redondo", bajamos a x9
    if (entero % 10 === 0) return entero - 1;
    return entero;
  }
  if (modo === 10) return Math.round(p / 10) * 10 - 1; // decenas en 9
  return Math.round(p);
}

function round2(n) { return Math.round(n * 100) / 100; }

/* ---------- UI ---------- */
function initCalc() {
  const form = document.getElementById('calc-form');
  if (!form) return;

  const out = document.getElementById('calc-out');

  function leer() {
    return {
      costo: parseFloat(form.costo.value) || 0,
      origen: form.origen.value,
      precioEtiqueta: parseFloat(form.precioEtiqueta.value) || 0,
      gastosEnvio: parseFloat(form.gastosEnvio.value) || 0,
      gastosPlataforma: parseFloat(form.gastosPlataforma.value) || 0,
      margenObjetivo: (parseFloat(form.margenObjetivo.value) || 0) / 100,
      redondeo: parseInt(form.redondeo.value, 10) || 1
    };
  }

  function render() {
    const d = leer();
    if (d.costo <= 0) {
      out.innerHTML = '<p class="muted">Ingresá el precio que pagaste por el producto para ver la sugerencia.</p>';
      return;
    }
    const r = calcPrecio(d);
    const margenClass = r.margenNeto >= 40 ? 'calc-good' : r.margenNeto >= 20 ? 'calc-mid' : 'calc-low';

    // Escenarios rápidos
    const escenarios = [
      { n: 'Conservador (2x)', m: 2 },
      { n: 'Recomendado (2.5x)', m: 2.5 },
      { n: 'Premium (3x)', m: 3 }
    ].map((e) => {
      const p = redondearPrecio(d.costo * e.m, 1);
      const g = p - d.costo;
      const mg = p > 0 ? Math.round((g / p) * 100) : 0;
      return `<tr><td>${e.n}</td><td>${fmtMoney(p)}</td><td>${fmtMoney(g)}</td><td>${mg}%</td></tr>`;
    }).join('');

    out.innerHTML = `
      <div class="calc-hero">
        <div class="calc-hero-label">Precio sugerido de venta</div>
        <div class="calc-hero-price">${fmtMoney(r.precio)}</div>
        ${r.precioEtiquetaMostrar > 0 ? `<div class="calc-etiqueta">Precio de etiqueta: <s>${fmtMoney(r.precioEtiquetaMostrar)}</s> <span class="calc-off">${Math.round(r.descuentoEtiqueta)}% menos</span></div>` : ''}
      </div>

      <div class="calc-grid">
        <div class="calc-metric"><span>Ganancia por unidad</span><b>${fmtMoney(r.ganancia)}</b></div>
        <div class="calc-metric"><span>Margen neto</span><b class="${margenClass}">${r.margenNeto}%</b></div>
        <div class="calc-metric"><span>Multiplicador real</span><b>${r.markupReal}x</b></div>
        <div class="calc-metric"><span>Costo total (con gastos)</span><b>${fmtMoney(r.costoTotal)}</b></div>
      </div>

      <h4 class="calc-sub">Si vendieras a precio fijo</h4>
      <table class="calc-table">
        <thead><tr><th>Estrategia</th><th>Precio</th><th>Ganancia</th><th>Margen</th></tr></thead>
        <tbody>${escenarios}</tbody>
      </table>

      <p class="calc-tip"><b>Consejo:</b> En Perú, la reventa de ropa nacional suele ir entre <b>2x y 2.5x</b> el costo, y la ropa importada/marca entre <b>2.5x y 3x</b>. Ajustá con las herramientas de arriba si tenés gastos de envío o comisión de plataforma.</p>
    `;
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
}
