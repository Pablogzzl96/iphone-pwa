// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);

// ¿Está abierta como app instalada (pantalla de inicio) o en el navegador?
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// iPhone / iPad (los iPad recientes se reportan como Mac con pantalla táctil)
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ---------- Saludo ----------
const hour = new Date().getHours();
$('greeting').textContent = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

// ---------- Modo: instalada vs navegador ----------
const modeChip = $('mode-chip');
modeChip.textContent = isStandalone ? 'Instalada' : 'Navegador';
modeChip.classList.toggle('on', isStandalone);
$('install-card').hidden = isStandalone || !isIOS;

// ---------- Conexión ----------
function renderNetwork() {
  const online = navigator.onLine;
  const chip = $('net-chip');
  chip.textContent = online ? 'En línea' : 'Sin conexión';
  chip.classList.toggle('off', !online);
}
window.addEventListener('online', renderNetwork);
window.addEventListener('offline', renderNetwork);
renderNetwork();

// ---------- Nota persistente (localStorage) ----------
const NOTE_KEY = 'iphone-pwa:note';
const note = $('note');
const noteStatus = $('note-status');
try {
  note.value = localStorage.getItem(NOTE_KEY) || '';
} catch (_) { /* almacenamiento no disponible */ }

let saveTimer;
note.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(NOTE_KEY, note.value);
      noteStatus.textContent = `Guardado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (_) {
      noteStatus.textContent = 'No se pudo guardar en este dispositivo.';
    }
  }, 400);
});

// ---------- Service worker (offline + actualizaciones) ----------
const swStatus = $('sw-status');
const toast = $('update-toast');

function showUpdate(worker) {
  toast.hidden = false;
  $('update-btn').onclick = () => worker.postMessage('SKIP_WAITING');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');

      // Si ya había una versión nueva esperando
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);

      // Cuando se descarga una versión nueva
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });

      const ready = await navigator.serviceWorker.ready;
      swStatus.textContent = 'Activo';

      // Pide la versión al service worker
      ready.active?.postMessage('GET_VERSION');
    } catch (err) {
      swStatus.textContent = 'No disponible';
      console.error('Service worker:', err);
    }
  });

  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.version) $('app-version').textContent = e.data.version;
  });

  // Al activarse una versión nueva, recarga una sola vez
  // (en la primera visita no hay versión previa, así que no recarga)
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
} else {
  swStatus.textContent = 'No soportado';
}
