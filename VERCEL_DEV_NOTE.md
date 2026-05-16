# Vercel Redirect Note (Local Dev Safety)

El bloque `redirects` de `vercel.json` fue removido temporalmente para entorno local.

Motivo tecnico:
- En `vercel dev`, la condicion `has` por `host` no se respeta de forma consistente.
- Eso puede disparar redirects tambien en localhost y terminar en `NOT_FOUND` para `/`.

Alcance del cambio:
- Solo se removio `redirects`.
- Se mantienen `headers`, `rewrites` y todas las rutas de APIs.
- El rewrite `"/" -> "/index.html"` sigue vigente.

Pendiente para produccion:
- Reintroducir el canonical redirect `quesedice.com.ar -> www.quesedice.com.ar`
  con una estrategia compatible con local/dev (por ejemplo, capa de edge/middleware
  o configuracion separada por entorno).
