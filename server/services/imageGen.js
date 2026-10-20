'use strict';
// Adaptador de IA: convierte la foto de una prenda en foto de modelo/maniqui.
// Proveedores soportados: gemini (gemini-2.5-flash-image) y openai (gpt-image-1).

const PROMPT = `Edita esta foto de una prenda de ropa plana y conviertela en una foto de catalogo de moda donde un maniqui viste exactamente la misma prenda.
Reglas estrictas:
- La prenda debe ser IDENTICA: mismo color, mismo estampado, misma textura, mismo corte y mismos detalles.
- Maniqui de estudio profesional, torso completo (de cuello a muslos), sin cabeza o con cabeza recortada fuera de cuadro.
- Fondo de estudio neutro gris claro, iluminacion de e-commerce, sombra suave.
- Sin texto, sin logos nuevos, sin accesorios extras, sin cambios de diseno.`;

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

async function generateWithGemini(key, buffer, mime) {
  const model = process.env.IA_MODEL || 'gemini-2.5-flash-image';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
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

async function generateWithOpenAI(key, buffer, mime) {
  const model = process.env.IA_MODEL || 'gpt-image-1';
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', PROMPT);
  form.append('image', new Blob([buffer], { type: mime }), 'prenda');
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

async function generateModelImage(buffer, mime) {
  const { provider, key } = requireKey();
  if (provider === 'gemini') return generateWithGemini(key, buffer, mime);
  if (provider === 'openai') return generateWithOpenAI(key, buffer, mime);
  throw new Error(`Proveedor IA desconocido: "${provider}". Usa gemini u openai.`);
}

module.exports = { generateModelImage };
