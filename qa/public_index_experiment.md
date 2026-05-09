# QSD — Experimento controlado: `public/index.html` vs raíz

**Generado (UTC):** 2026-05-09T15:32Z  
**Alcance:** Solo se añadió `public/index.html` como copia byte-a-byte de `./index.html`. No se movió ni borró el `index.html` raíz. Sin cambios de frontend, APIs ni `vercel.json`.

---

## Hipótesis

1. **`vercel dev` prioriza el árbol `public/`** para estáticos y resuelve la entrada SPA contra `public/index.html` cuando existe.
2. Con **`./index.html` aún en la raíz**, el runtime puede seguir registrando un build match genérico `"index.html"`, pero la **petición `GET /`** puede materializarse contra **`public/index.html`** (ver evidencia en logs de debug).
3. Tras copiar el archivo, **`/` y `/index.html`** deben responder **200** con **`Content-Type: text/html; charset=utf-8`** y cuerpo de tamaño coherente con el artefacto (≈103 773 bytes en este repo).

---

## Cambios aplicados

| Acción | Detalle |
|--------|---------|
| Directorio | `public/` creado si no existía |
| Archivo | `public/index.html` |
| Origen | Copia con `cp -a` desde `./index.html` |
| Verificación binaria | `cmp -s ./index.html public/index.html` → **OK** (103 773 bytes) |
| `index.html` raíz | **Intacto** (no movido, no eliminado) |

---

## Procedimiento de runtime

1. `./scripts/runtime-clean.sh` — diagnóstico previo (había un `vercel dev` ocupando `:3000`).
2. Se liberó el puerto **3000** terminando el proceso `node …/vc dev` que escuchaba ahí (**necesario** para cumplir `--listen 3000`; de lo contrario Vercel reporta `EADDRINUSE`).
3. Arranque del dev server:

   ```bash
   nohup npx vercel dev --listen 3000 --debug > /tmp/qsd-vercel-experiment-full.log 2>&1 &
   ```

   Nota operativa: en este entorno, el arranque en background vía herramienta dejó log vacío; **`nohup` + log en `/tmp`** permitió capturar salida completa. El comando sigue siendo **`npx vercel dev`** como pediste.

---

## Build matches y trazas relevantes (log real)

Archivo: `/tmp/qsd-vercel-experiment-full.log` (máquina local del experimento).

- **Listo:**

  ```text
  > Ready! Available at http://localhost:3000
  ```

- **Build match estático (nombre genérico `index.html`):**

  ```text
  > [debug] … Adding build match for "index.html" with "@vercel/static"
  ```

- **Evidencia directa de resolución para `GET /` (hipótesis 1):**

  ```text
  > [debug] … Building asset "public/index.html-" for "GET /"
  > [debug] … Built asset public/index.html-
  ```

  Esto **no es inferencia visual**: el CLI registra explícitamente el asset `public/index.html` al atender `/`.

---

## Verificación HTTP manual (`curl`, no navegador)

Base: `http://127.0.0.1:3000`

| Ruta | HTTP | Content-Type | Content-Length | Notas |
|------|------|--------------|----------------|--------|
| `/` | 200 | `text/html; charset=utf-8` | 103 773 | `Content-Disposition: inline; filename="index.html"` |
| `/index.html` | 200 | `text/html; charset=utf-8` | 103 773 | Cuerpo **idéntico** al de `/` (`cmp` entre respuestas: OK) |

Referencias locales: `./index.html` y `public/index.html` miden **103 773** bytes cada uno (contenido igual por construcción del experimento).

---

## Smoke (`scripts/runtime-audit.sh`)

Comando:

```bash
./scripts/runtime-audit.sh --smoke http://localhost:3000
```

**Salida observada:**

```text
RUNTIME_SMOKE=PASS
```

**Condiciones:** Dev server activo en **3000**; mediciones vía `curl` (incl. `Content-Type` y tamaño). El reporte detallado quedó en `qa/runtime_report.txt` (modo smoke: `failures: 0`, `warnings: 0` en el resumen del run capturado).

**Advertencia del propio audit (entorno):** en el snapshot de procesos apareció más de una línea relacionada con `vercel dev` por el contexto del shell que lanzó `nohup`; el listener en **3000** era uno solo (`node` → `npm exec vercel dev`). Para QA limpio, conviene un solo `vercel dev` y revisar `runtime-clean.sh` antes del run.

---

## Conclusiones (determinísticas)

1. **Con `public/index.html` presente**, el debug de Vercel CLI muestra **`Building asset "public/index.html-" for "GET /"`**: en esta corrida, **`/` se resolvió contra `public/index.html`**, no solo “algún index abstracto”.
2. **`/` y `/index.html`** devolvieron **200**, **HTML real**, mismo tamaño y cuerpos idénticos entre sí.
3. El smoke **PASS** es **consistente** con esas mediciones; **no** se asumió éxito por navegador.
4. El experimento es **reversible**: eliminar `public/index.html` y reiniciar `vercel dev` revierte el comportamiento a la configuración previa (el `index.html` raíz **no** fue tocado).

---

## Riesgos / límites

- **No se contrastó** el mismo run **sin** `public/index.html` en esta sesión (AB inmediato); la conclusión fuerte viene del **log** que nombra `public/index.html` en `GET /`.
- **Producción vs `vercel dev`:** este informe es sobre **dev local** con CLI 53.x instalada vía `npx`.
- **Puerto ocupado:** si **3000** está en uso, el experimento falla o se desvía; hay que un solo listener o elegir otro puerto y ajustar el smoke.

---

## Reversión sugerida (cuando cierre el experimento)

```bash
rm -rf public/index.html   # o rm public/index.html si public solo contenía esto
# reiniciar un único: npx vercel dev --listen 3000
```

(Dejar `public/` vacío o eliminarlo según preferencia del repo; no tocar `./index.html` salvo decisión editorial aparte.)
