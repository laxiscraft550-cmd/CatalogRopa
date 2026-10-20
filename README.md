# 🛍️ Catálogo de Ropa — Tienda con WhatsApp

Tienda de ropa tipo catálogo con panel de administración y pedidos por WhatsApp.

## ✨ Qué hace

- **Catálogo público**: tus clientes ven las prendas, eligen talle y cantidad.
- **Pedidos por WhatsApp**: el cliente arma su pedido y te lo envía armado con ítems, talles, cantidades y total.
- **Panel de admin** (`/admin/login.html`): creás y editás productos con fotos, precio, descripción, cantidad y talles.
- **🤖 Foto de modelo con IA**: subís la foto de la prenda (plana o en maniquí) y el botón "Foto de modelo" la convierte en una imagen de un modelo/maniquí vistiendo esa prenda.

## 🚀 Cómo iniciarlo

Doble clic en **`Iniciar Tienda.bat`** (o en una terminal: `npm start`).

| Página | URL |
|---|---|
| Tienda (clientes) | http://localhost:3000 |
| Panel de admin | http://localhost:3000/admin/login.html |

**Usuario y contraseña por defecto:** `admin` / `cambia123`
⚠️ Cambialos en el archivo `.env` antes de publicar.

## ⚙️ Configuración (archivo `.env`)

```
PORT=3000
ADMIN_USER=admin
ADMIN_PASSWORD=cambia123
JWT_SECRET=pon-aqui-un-texto-largo-y-aleatorio
IA_PROVIDER=              # gemini | openai  (vacío = IA desactivada)
IA_API_KEY=               # tu clave de API
WHATSAPP_NUMBER=5491122334455   # con código de país, solo dígitos
STORE_NAME=Mi Tienda de Ropa
CURRENCY=$
```

También podés cambiar **nombre de tienda, WhatsApp y moneda** desde el panel → Ajustes.

## 🤖 Activar la foto de modelo con IA

1. Conseguí una clave de API de **Google Gemini** (aistudio.google.com) o **OpenAI**.
2. En `.env` completá:
   - `IA_PROVIDER=gemini` + `IA_API_KEY=tu-clave`, o
   - `IA_PROVIDER=openai` + `IA_API_KEY=tu-clave`
3. Reiniciá el servidor.
4. En el panel, al editar un producto, en cada foto de prenda aparece el botón **"🤖 Foto de modelo"**. Tarda unos segundos y la imagen generada se agrega a la galería (podés hacerla principal).

> Es un servicio de pago por imagen (centavos por foto). Sin clave, el botón se avisa y podés subir vos las fotos de modelo manualmente.

## 📁 Estructura

```
CatalogoRopa/
├── Iniciar Tienda.bat      ← doble clic para arrancar
├── package.json
├── .env                    ← configuración (no compartir)
├── server/                 ← backend (Node.js + Express + SQLite)
│   ├── index.js
│   ├── db.js               ← base de datos (data/app.db)
│   ├── auth.js             ← login del admin
│   ├── routes/             ← API de productos, fotos, IA, ajustes
│   └── services/imageGen.js
├── public/                 ← frontend (lo que ve el cliente)
│   ├── index.html          ← catálogo
│   ├── producto.html       ← detalle de producto
│   ├── admin/              ← login y panel de admin
│   ├── css/styles.css
│   └── js/
├── data/app.db             ← base de datos (se crea sola)
└── uploads/                ← fotos de productos
```

## 🧪 Flujo del admin

1. Entrá al panel → **＋ Nuevo producto** → nombre, precio, cantidad, descripción y talles → Guardar.
2. Con el producto abierto, **subí la foto de la prenda** (arrastrar y soltar o clic).
3. Opcional: **🤖 Foto de modelo** para convertir la foto en imagen de modelo/maniquí.
4. Elegí la **foto principal** (★) y publicá.
5. El producto aparece en la tienda y el cliente puede pedirlo por WhatsApp.

## 🔧 Solución de problemas

- **"No se encontró node"**: instalá Node.js LTS desde nodejs.org y volvé a ejecutar el `.bat`.
- **Puerto ocupado**: cambiá `PORT=3001` en `.env`.
- **La IA no genera foto**: revisá que `IA_PROVIDER` e `IA_API_KEY` estén completos en `.env` y reiniciá.
- **Contraseña olvidada**: borrá `data/app.db` (perdés los productos) o cambiala con un script; mejor: recordá guardarla.
