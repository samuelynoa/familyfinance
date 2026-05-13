# FamilyFinance 💰

Sistema de gestión de finanzas familiares — PWA instalable en Android.

## Setup rápido

### 1. Clonar e instalar

```bash
git clone https://github.com/TU_USUARIO/familyfinance.git
cd familyfinance
npm install
```

### 2. Crear archivo `.env.local`

Copia `.env.example` como `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales reales de Firebase y Google Sheets.

### 3. Correr en desarrollo

```bash
npm run dev
```

Abre http://localhost:5173

### 4. Deploy a Vercel

```bash
npm install -g vercel
vercel
```

En el dashboard de Vercel, agrega estas variables de entorno:
- Todas las `VITE_*` del `.env.example`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_VISION_API_KEY`

### 5. Instalar en Android como PWA

1. Abre la URL de Vercel en Chrome para Android
2. Toca el banner "Agregar a pantalla de inicio" **o** menú ⋮ → "Instalar app"
3. La app aparece en tu pantalla de inicio como una app nativa

## Primer usuario (admin)

1. Ve a Firebase Console → Authentication → Agregar usuario manualmente
2. Pon tu email y una contraseña temporal
3. Inicia sesión en la app
4. Ve a Configuración → Usuarios → Agrega ese mismo email con rol "admin"
5. Repite para cada miembro de la familia (primero en Firebase Auth, luego en la app)

## Estructura del proyecto

```
familyfinance/
├── api/
│   └── sheets.js          # Serverless function — proxy a Google Sheets API
├── src/
│   ├── components/
│   │   └── layout/        # AppLayout, BottomNav
│   ├── context/
│   │   └── AuthContext.jsx # Firebase Auth + perfil de Sheets
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Usuarios.jsx
│   │   └── Placeholders.jsx  # Fases 2-5
│   ├── services/
│   │   ├── firebase.js    # Inicialización Firebase
│   │   └── sheets.js      # Todas las operaciones CRUD de Sheets
│   └── styles/
│       └── global.css
├── .env.example
├── vercel.json
└── vite.config.js
```

## Fases de desarrollo

- ✅ **Fase 1** — Infraestructura, Auth, Sheets API, PWA, Dashboard básico
- 🔄 **Fase 2** — Cuentas, gastos manuales, tarjetas, ahorros
- 🔄 **Fase 3** — OCR + clasificador IA (Google Vision + Claude)
- 🔄 **Fase 4** — Préstamos, presupuestos, alertas email
- 🔄 **Fase 5** — Dashboard completo, reportes, ingresos
