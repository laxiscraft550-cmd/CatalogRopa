# Mi Tienda — Catalogo de productos con pedidos por WhatsApp

Tienda de catalogo con panel de administracion y pedidos por WhatsApp.
Venta de productos variados: ropa, tecnologia, cosas del hogar, perfumes,
accesorios y demas.

## Que hace

- **Catalogo publico**: tus clientes ven los productos, filtran por categoria,
  buscan por nombre y eligen talle (solo si aplica) y cantidad.
- **Pedidos por WhatsApp**: el cliente arma su pedido y te lo envia armado con
  items, talles, cantidades y total.
- **Panel de admin** (`/admin/login.html`): creas y editas productos con fotos,
  categoria, precio de venta, precio de lista (tachado), precio de compra,
  cantidad y talles.
- **Ganancia visible**: con el precio de compra cargado, el panel te muestra la
  ganancia potencial de cada producto y el total.
- **Calculadora de precios**: te dice a cuánto vender segun lo que pagaste,
  con escenarios (1.5x, 2.5x, 3x), margen neto y redondeo psicologico.
- **Fotos con IA**: subis la foto del producto y el boton "Generar foto" la
  convierte en una imagen de catalogo. Si es ropa la muestra con maniqui; si es
  tecnologia, perfume u otro producto, la muestra en set de estudio.

## Como iniciarlo

Doble clic en **`Iniciar Tienda.bat`** (o en una terminal: `npm start`).

| Pagina | URL |
|---|---|
| Tienda (clientes) | http://localhost:3000 |
| Panel de admin | http://localhost:3000/admin/login.html |

**Usuario y contrasena por defecto:** `admin` / `cambia123`
Cambialos en el archivo `.env` antes de publicar.

## Configuracion (archivo `.env`)

```
PORT=3000
ADMIN_USER=admin
ADMIN_PASSWORD=cambia123
JWT_SECRET=pon-aqui-un-texto-largo-y-aleatorio
IA_PROVIDER=              # gemini | openai  (vacio = IA desactivada)
IA_API_KEY=               # tu clave de API
WHATSAPP_NUMBER=51987654321   # con codigo de pais, solo digitos
STORE_NAME=Mi Tienda
CURRENCY=S/
```

Tambien podes cambiar **nombre de tienda, logo, WhatsApp y moneda** desde el
panel, pestana Ajustes.

## Activar las fotos con IA

1. Conseguí una clave de API de **Google Gemini** (aistudio.google.com) o **OpenAI**.
2. En `.env` completa:
   - `IA_PROVIDER=gemini` + `IA_API_KEY=tu-clave`, o
   - `IA_PROVIDER=openai` + `IA_API_KEY=tu-clave`
3. Reinicia el servidor.
4. En el panel, al editar un producto, en cada foto aparece el boton
   **"Generar foto"**. Tarda unos segundos y la imagen generada se agrega a la
   galeria (podes hacerla principal).

Es un servicio de pago por imagen (centavos por foto). Sin clave, el boton lo
avisa y podes subir vos las fotos manualmente.

## Campos de precio

| Campo | Para que sirve |
|---|---|
| Precio de compra / costo | Lo que pagaste. De ahi sale tu ganancia y la calculadora. |
| Precio de venta | Lo que cobra el cliente. |
| Precio de lista / tachado | Opcional. Si es mayor que el de venta, aparece tachado con su badge de descuento. |

El costo **nunca se muestra al cliente**: solo se expone en el panel.

## Talles

Solo ropa. Hay letras (XS, S, M, L, XL...), numericas de pantalon en pulgadas
(26 a 44) y "Unico". Un producto sin talles (tecnologia, perfume, hogar) se
vende normalmente: el selector de talle no aparece.

## Estructura

```
CatalogoRopa/
├── Iniciar Tienda.bat      ← doble clic para arrancar
├── package.json
├── .env                    ← configuracion (no compartir)
├── server/                 ← backend (Node.js + Express + SQLite)
│   ├── index.js
│   ├── db.js               ← base de datos (data/app.db)
│   ├── auth.js             ← login del admin
│   ├── routes/             ← API de productos, fotos, IA, ajustes
│   └── services/imageGen.js
├── public/                 ← frontend (lo que ve el cliente)
│   ├── index.html          ← catalogo
│   ├── producto.html       ← detalle de producto
│   ├── admin/              ← login y panel de admin
│   ├── css/styles.css
│   └── js/
├── data/app.db             ← base de datos (se crea sola)
└── uploads/                ← fotos de productos
```

## Flujo del admin

1. Entra al panel → **Nuevo producto** → nombre, categoria, precios, cantidad,
   descripcion y talles (si aplica) → Guardar.
2. Con el producto abierto, **subi la foto** (arrastrar y soltar o clic).
   Acepta JPG, PNG, WEBP, HEIC y mas; podes recortar, zoom y rotar antes de subir.
3. Opcional: **Generar foto** para crear la version de catalogo con IA.
4. Elegi la **foto principal** (estrella) y publica.
5. El producto aparece en la tienda y el cliente puede pedirlo por WhatsApp.

## Solucion de problemas

- **"No se encontro node"**: instala Node.js LTS desde nodejs.org y vuelve a
  ejecutar el `.bat`.
- **Puerto ocupado**: cambia `PORT=3001` en `.env`.
- **La IA no genera foto**: revisa que `IA_PROVIDER` e `IA_API_KEY` esten
  completos en `.env` y reinicia.
- **La foto no se ve**: usa el ajustador al subirla; recorta y exporta en JPG.
- **Contrasena olvidada**: borra `data/app.db` (perdes los productos) o cambiala
  con un script; mejor: guardala.
