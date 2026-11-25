# Tracker · PWA para iPhone

Tracker personal de nutrición y pérdida de grasa: responde «¿cuánto me queda hoy?» en kcal y proteína, sigue la tendencia del peso y estima el % de grasa. Funciona offline, sin cuentas ni servidor.

**App publicada:** https://pablogzzl96.github.io/iphone-pwa/

## Privacidad

- **Los datos viven solo en el dispositivo** (IndexedDB). Nada se envía a ningún servidor.
- Este repositorio es público y **no contiene datos personales**: ni metas, ni estatura, ni pesos, ni medidas. Todo se captura en el asistente inicial y se guarda en el teléfono.
- Los respaldos (`tracker-*.json`, `*.csv`) están en `.gitignore`. No los subas al repo.

## Instalar en el iPhone

1. Abre la URL en **Safari**.
2. **Compartir** → **Agregar a pantalla de inicio**.
3. Deja activado **Abrir como app web** y toca **Agregar**.
4. Registra siempre desde el ícono: Safari y la app instalada guardan datos **por separado**.

## Respaldo (hazlo cada semana)

Si borras el ícono, cambias de iPhone o borras los datos de Safari, los datos se pierden. Para evitarlo:

- **Ajustes → Exportar respaldo (JSON)** → **Guardar en Archivos** (una carpeta de iCloud Drive).
- La pantalla Hoy avisa cuando pasan 7 días sin respaldo.
- Para restaurar: **Ajustes → Importar respaldo…** Se fusiona por fecha/id; no borra lo que ya tienes.
- **CSV diario** y **CSV de comidas** sirven para Power BI o Python.

## Qué hace

- **Hoy:** restante del día como rango (según la precisión de cada registro), proteína por cubrir, balance semanal, modo del día (Déficit A, Déficit B, Mantenimiento, Enfermo), nota del día.
- **Registrar:** recientes, favoritos, plantillas, búsqueda, entrada rápida (kcal + proteína), copiar ayer, y alimentos por gramos con conversión **crudo ↔ cocido**.
- **Peso:** tendencia (media móvil exponencial 10 %), promedio semanal, ritmo de 14 días por regresión, gráfica; medidas con % de grasa (método de la Marina, ±3.5 pts).
- **Progreso:** balance de esta semana y la pasada, gasto adaptativo (estilo MacroFactor), check-in quincenal que **propone** un ajuste (nunca lo aplica solo) y proyección a la meta como **rango de fechas**.
- **Ajustes:** perfil y metas, plantillas, factores de cocción calibrables, respaldo, estado del almacenamiento.

## Estructura

```
index.html              Contenedor de la app + meta tags de iOS
manifest.webmanifest    Nombre, colores, íconos, modo standalone
sw.js                   Service worker: caché offline (nunca toca IndexedDB)
css/app.css             Estilos (paleta neutra, sin rojos, safe areas de iOS)
js/app.js               Arranque, router por hash, guía de instalación, service worker
js/db.js                Envoltorio de IndexedDB con migraciones por versión
js/calc.js              Fórmulas puras (sin DOM, sin datos personales)
js/data.js              Consultas y reglas de negocio sobre la base local
js/seed.js              Alimentos genéricos de referencia y factores de cocción
js/backup.js            Exportar JSON/CSV, importar, almacenamiento persistente
js/ui/*.js              Una pantalla por archivo
tests/calc.test.js      Pruebas de calc.js (Node o navegador)
```

## Publicar cambios

1. Haz los cambios y **sube `CACHE_VERSION` en `sw.js`** (`v1` → `v2`). Sin eso, el iPhone sigue usando la versión en caché.
2. Si agregas un archivo JS o CSS, súmalo a `APP_SHELL` en `sw.js`.
3. Si cambias el esquema de datos, sube `SCHEMA_VERSION` en `js/db.js` y agrega un bloque `if (ev.oldVersion < N)` que **solo agregue** (nunca borre). Exporta un respaldo antes de publicar.
4. Push a `main`; GitHub Pages publica en ~1 minuto y la app muestra **Actualizar**.

## Probar

```bash
node tests/calc.test.js          # pruebas de fórmulas
python3 -m http.server 8000      # abre http://localhost:8000
```

En el navegador de escritorio aparece la guía de instalación; usa «Continuar en este navegador».

## Límites de una PWA en iOS

- No puede leer ni escribir en Apple Health.
- No hay recordatorios programados sin servidor: usa Atajos o Recordatorios de iOS («Pésate y abre Tracker»).
- Sin escáner de código de barras nativo (fase 2, con librería WASM).
- Sin sincronización entre dispositivos: el respaldo es manual.

## Notas sobre los números

- Los alimentos precargados son referencias USDA de uso común; verifícalos contra la etiqueta mexicana o FoodData Central y edítalos en la app.
- Los márgenes por tipo de registro (5/20/30 %), los umbrales del check-in y el paso de 150 kcal son reglas de diseño propias, no valores de una guía.
- 7,700 kcal/kg es una aproximación válida para ventanas de 2–4 semanas.
