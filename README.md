# iPhone PWA

Plantilla de Progressive Web App lista para instalarse en iPhone desde Safari: se abre a pantalla completa, funciona sin conexión y avisa cuando hay una versión nueva.

**App publicada:** https://pablogzzl96.github.io/iphone-pwa/

## Instalar en el iPhone

1. Abre la URL de arriba en **Safari**.
2. Toca **Compartir** (cuadro con flecha hacia arriba).
3. Elige **Agregar a pantalla de inicio** → **Agregar**.

## Estructura

```
index.html             Pantalla principal + meta tags de iOS
manifest.webmanifest   Nombre, colores, íconos y modo standalone
sw.js                  Service worker: caché offline y actualizaciones
app.js                 Lógica de la app (estado, nota guardada, aviso de actualización)
styles.css             Estilos (respeta notch, Dynamic Island y barra de inicio)
icons/                 apple-touch-icon (180 px), 192, 512 y maskable
.nojekyll              Indica a GitHub Pages que publique los archivos tal cual
```

## Publicar cambios

1. Edita los archivos y haz push a `main`; GitHub Pages publica en ~1 minuto.
2. **Sube `CACHE_VERSION` en `sw.js`** (`v1` → `v2`) en cada publicación. Así el iPhone detecta la versión nueva y muestra el botón *Actualizar*.
3. Si agregas archivos nuevos (páginas, imágenes), súmalos a `APP_SHELL` en `sw.js` para que funcionen offline.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

El service worker funciona en `localhost` y en HTTPS (GitHub Pages ya es HTTPS).

## Notas de iOS

- La instalación en iPhone es siempre manual (Compartir → Agregar a pantalla de inicio); iOS no muestra un botón automático de "Instalar".
- Los datos de la app instalada (localStorage, caché) viven separados de los de Safari.
- Las notificaciones push web funcionan en iOS 16.4+ solo cuando la app está instalada en la pantalla de inicio.
