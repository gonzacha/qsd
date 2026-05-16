# Service Worker QA Guide (QSD)

Uso: evitar falsos positivos cuando se prueba local con `vercel dev`.

## Cuándo sospechar del Service Worker

- Browser muestra contenido viejo pero `curl` muestra otro resultado.
- Cambiaste `vercel.json` o APIs y la UI sigue igual.
- `/api/*` en browser parece cacheado pero en terminal responde distinto.

## Flujo de QA recomendado

1. **Primero terminal (fuente de verdad):**
   - `./scripts/dev-smoke.sh`
   - `curl -i http://localhost:3000/api/feeds`
2. **Luego browser:**
   - Solo para validación visual/UX.

## Limpiar SW en navegador (manual)

1. Abrir DevTools.
2. Ir a **Application** -> **Service Workers**.
3. Click en **Unregister** para el scope local.
4. Ir a **Storage** -> **Clear site data**.
5. Hard reload (`Ctrl+Shift+R`).

## Regla práctica

- Diagnóstico de routing/API: usar `curl` y scripts.
- Diagnóstico de UI/UX: usar browser luego de limpiar SW.
