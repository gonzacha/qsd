# Qué Se Dice

**Portal informativo automático — Corrientes, Argentina y el Mundo**

Un proyecto de **Antonio & Gonzalo Haedo** — desde 2004.

---

## 🚀 Deploy en Vercel (2 minutos)

### Opción A: Deploy directo desde estos archivos

1. Andá a [vercel.com/new](https://vercel.com/new)
2. Elegí "Import from Git Repository" o arrastrá esta carpeta
3. Framework preset: **Other**
4. Click en **Deploy**
5. Una vez deployado, en Settings > Domains agregá: `quesedice.com.ar`

### Opción B: Desde GitHub

1. Creá un repo nuevo: `github.com/tu-usuario/quesedice`
2. Subí estos archivos
3. En Vercel, importá el repo
4. Deploy automático

### Configurar dominio personalizado

1. En el dashboard de Vercel > tu proyecto > Settings > Domains
2. Agregá `quesedice.com.ar` y `www.quesedice.com.ar`
3. Vercel te va a dar los registros DNS (generalmente un CNAME a `cname.vercel-dns.com`)
4. Configurá esos registros en tu proveedor de dominio

---

## 📁 Estructura

```
quesedice/
├── index.html          # Frontend completo (HTML + CSS + JS)
├── api/
│   └── feeds.js        # Edge function - agrega RSS de Google News
├── vercel.json          # Config de Vercel (cache, rewrites)
├── package.json         # Metadata del proyecto
└── README.md            # Este archivo
```

## ⚡ Cómo funciona

- **100% automático**: Las noticias se actualizan solas cada 10 minutos
- **Sin base de datos**: Todo viene de Google News RSS en tiempo real
- **Cache inteligente**: Vercel CDN cachea 10 min + stale-while-revalidate
- **8 categorías**: Portada, Argentina, Corrientes, Mundo, Deportes, Economía, Tecnología, Espectáculos
- **Tendencias**: Extrae keywords trending de los titulares automáticamente
- **Compartir**: WhatsApp, X/Twitter, Facebook, copiar enlace
- **Mobile-first**: Diseño responsive para todos los dispositivos
- **SEO ready**: Open Graph, Twitter Cards, JSON-LD

## 🛠 Desarrollo local

```bash
npx serve .
# Abrí http://localhost:3000
```

Nota: La API `/api/feeds` solo funciona en Vercel (edge function). 
Para desarrollo local, las noticias no van a cargar directamente.

## 📜 Historia

- **2004**: Taetanoticias — el comienzo
- **~2010s**: Corrientes Dice — la evolución  
- **2025**: Qué Se Dice — el portal automático

---

*Hecho con ❤️ en Corrientes, Argentina*
