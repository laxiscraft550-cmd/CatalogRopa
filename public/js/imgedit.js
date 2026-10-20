'use strict';

/* ============================================================
   Editor de imagen del navegador: recorte, rotación y zoom.
   Devuelve un Blob listo para subir (JPEG/PNG de calidad).
   Uso:  const blob = await editImage(file, { aspect: 3/4 })
   ============================================================ */

function editImage(file, { aspect = 3 / 4, title = 'Ajustar foto' } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); openEditor(img, aspect, title, resolve, reject); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen. Probá con JPG o PNG.')); };
    img.src = url;
  });
}

function openEditor(img, aspect, title, resolve, reject) {
  const overlay = document.createElement('div');
  overlay.className = 'imgedit-overlay';
  overlay.innerHTML = `
    <div class="imgedit">
      <div class="imgedit-head">
        <strong>${esc(title)}</strong>
        <button class="close-x" data-x aria-label="Cerrar">${ICONS.close}</button>
      </div>
      <div class="imgedit-stage">
        <canvas class="imgedit-canvas"></canvas>
      </div>
      <div class="imgedit-tools">
        <div class="imgedit-zoom">
          <span>Zoom</span>
          <input type="range" min="1" max="3" step="0.01" value="1" data-zoom>
        </div>
        <button class="btn btn-sm btn-ghost" data-rot>${icon('rotate', 15)} Girar</button>
        <button class="btn btn-sm btn-ghost" data-center>Centrar</button>
      </div>
      <div class="imgedit-foot">
        <button class="btn btn-ghost" data-x>Cancelar</button>
        <button class="btn btn-primary" data-ok>Usar foto</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const canvas = overlay.querySelector('.imgedit-canvas');
  const ctx = canvas.getContext('2d');
  const zoomInput = overlay.querySelector('[data-zoom]');

  let rot = 0;           // 0, 90, 180, 270
  let zoom = 1;
  let ox = 0, oy = 0;    // desplazamiento
  let dragging = false, lx = 0, ly = 0;

  function natural() {
    return rot % 180 === 0 ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.naturalHeight, h: img.naturalWidth };
  }

  function draw() {
    const stage = overlay.querySelector('.imgedit-stage');
    const maxW = Math.min(stage.clientWidth - 8, 520);
    const maxH = Math.min(window.innerHeight * 0.48, 420);
    let cw = maxW, ch = maxW / aspect;
    if (ch > maxH) { ch = maxH; cw = maxH * aspect; }
    canvas.width = Math.round(cw * 2);
    canvas.height = Math.round(ch * 2);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';

    const n = natural();
    const base = Math.max(canvas.width / n.w, canvas.height / n.h) * zoom;
    const dw = n.w * base, dh = n.h * base;
    const maxOx = Math.max(0, (dw - canvas.width) / 2);
    const maxOy = Math.max(0, (dh - canvas.height) / 2);
    ox = Math.max(-maxOx, Math.min(maxOx, ox));
    oy = Math.max(-maxOy, Math.min(maxOy, oy));

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + ox, canvas.height / 2 + oy);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // Arrastrar para recorrer
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const k = canvas.width / canvas.clientWidth;
    ox += (e.clientX - lx) * k;
    oy += (e.clientY - ly) * k;
    lx = e.clientX; ly = e.clientY;
    draw();
  });
  canvas.addEventListener('pointerup', () => { dragging = false; canvas.style.cursor = 'grab'; });
  canvas.style.cursor = 'grab';

  zoomInput.addEventListener('input', () => { zoom = Number(zoomInput.value); draw(); });
  overlay.querySelector('[data-rot]').addEventListener('click', () => {
    rot = (rot + 90) % 360;
    ox = oy = 0;
    zoom = 1; zoomInput.value = 1;
    draw();
  });
  overlay.querySelector('[data-center]').addEventListener('click', () => { ox = oy = 0; draw(); });

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
    window.removeEventListener('resize', draw);
  }

  overlay.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { close(); reject(new Error('cancelado')); }));

  overlay.querySelector('[data-ok]').addEventListener('click', () => {
    // Recortar al tamaño final (máx 1600px de ancho)
    const outW = Math.min(1600, canvas.width);
    const outH = Math.round(outW / aspect);
    const out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(canvas, 0, 0, outW, outH);
    out.toBlob((blob) => {
      close();
      if (blob) resolve(blob);
      else reject(new Error('No se pudo procesar la imagen'));
    }, 'image/jpeg', 0.9);
  });

  window.addEventListener('resize', draw);
  requestAnimationFrame(draw);
}
