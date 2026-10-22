'use strict';
// Adaptador de IA: mejora la foto de un producto para el catalogo.
// - Modo "maniqui" (ropa): convierte la foto plana en foto con maniqui.
// - Modo "producto" (tecnologia, hogar, perfumes, accesorios, etc.):
//   foto de catalogo profesional del mismo producto.
// Proveedores soportados: gemini (gemini-2.5-flash-image) y openai (gpt-image-1).

const REGLAS = `Reglas estrictas:
- El producto debe ser IDENTICO: mismo color, mismo material, mismas texturas, mismos detalles y misma marca.
- Fondo de estudio neutro gris claro, iluminacion de e-commerce, sombra suave.
- Sin texto, sin logos nuevos, sin accesorios extras, sin cambios de diseno.`;

const PROMPTS = {
  maniqui: `Edita esta foto de una prenda de ropa plana y conviertela en una foto de catalogo de moda donde un maniqui viste exactamente la misma prenda.
- Maniqui de estudio profesional, torso completo (de cuello a muslos), sin cabeza o con cabeza recortada fuera de cuadro.
${REGLAS}`,

  producto: `Edita esta foto y conviertela en una foto de catalogo profesional de e-commerce del MISMO producto.
- El producto deve quedar protagonico, centrado y completo, en angulo de venta (3/4 o frontal).
- Estilo: fondo de estudio liso, sombra de contacto suave, nitidez de catalogo.
- Si es un producto que se usa o se muestra (perfume, accesorio, electrodomestico), presentalo en un set minimalista de estudio sin personas.
${REGLAS}`
};

// Decide el prompt segun la categoria/nombre del producto
function modoPara(category = '', name = '') {
  const t = `${category} ${name}`.toLowerCase();
  const ropa = /ropa|pantal|pantalon|camis|remer|remera|polo|vestid|buzo|sudadera|jean|short|falda|abrigo|chaqueta|calcet|ropa/.test(t);
  return ropa ? 'maniqui' : 'producto';
}

function requireKey() {
  const provider = (process.env.IA_PROVIDER || '').toLowerCase();
  const key = process.env.IA_API_KEY || '';
  if (!provider || !key) {
    const err = new Error('IA no configurada: define IA_PROVIDER (gemini|openai) e IA_API_KEY en el archivo .env');
    err.code = 'IA_NOT_CONFIGURED';
    throw err;
  }
  return { provider, key };
}

async function generateWithGemini(key, buffer, mime, prompt) {
  const model = process.env.IA_MODEL || 'gemini-2.5-flash-image';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: buffer.toString('base64') } }
          ]
        }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini: ${data?.error?.message || res.status}`);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!img) {
    const text = parts.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(`Gemini no devolvio imagen. ${text}`.trim());
  }
  return { buffer: Buffer.from(img.inlineData.data, 'base64'), mime: img.inlineData.mimeType || 'image/png' };
}

async function generateWithOpenAI(key, buffer, mime, prompt) {
  const model = process.env.IA_MODEL || 'gpt-image-1';
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image', new Blob([buffer], { type: mime }), 'producto');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI: ${data?.error?.message || res.status}`);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI no devolvio imagen.');
  return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
}

async function generateModelImage(buffer, mime, { category = '', name = '' } = {}) {
  const { provider, key } = requireKey();
  const prompt = PROMPTS[modoPara(category, name)] || PROMPTS.producto;
  if (provider === 'gemini') return generateWithGemini(key, buffer, mime, prompt);
  if (provider === 'openai') return generateWithOpenAI(key, buffer, mime, prompt);
  throw new Error(`Proveedor IA desconocido: "${provider}". Usa gemini u openai.`);
}

module.exports = { generateModelImage, modoPara };
