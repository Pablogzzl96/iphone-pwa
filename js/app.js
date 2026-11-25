// app.js — arranque, router por hash, guía de instalación y service worker.
import * as db from './db.js';
import * as C from './calc.js';
import * as D from './data.js';
import { pedirPersistencia } from './backup.js';
import { esc, cerrarTodas } from './ui/dom.js';
import { renderOnboarding } from './ui/perfil.js';
import { renderHoy } from './ui/hoy.js';
import { renderPeso } from './ui/peso.js';
import { renderProgreso } from './ui/progreso.js';
import { renderAjustes } from './ui/ajustes.js';

const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const RUTAS = { hoy: renderHoy, peso: renderPeso, progreso: renderProgreso, ajustes: renderAjustes };

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

const ctx = {
  settings: null,
  fecha: C.isoLocal(),
  standalone,
  version: null,
  async refrescar() { await pintar(); },
  setFecha(f) { ctx.fecha = f > C.isoLocal() ? C.isoLocal() : f; pintar(); },
  navegar(ruta) { location.hash = `#/${ruta}`; },
};

const rutaActual = () => {
  const r = location.hash.replace(/^#\//, '');
  return RUTAS[r] ? r : 'hoy';
};

let pintando = null;
async function pintar() {
  // Serializa repintados para no mezclar pantallas
  const anterior = pintando;
  let fin;
  pintando = new Promise((r) => { fin = r; });
  await anterior;
  try {
    const ruta = rutaActual();
    tabbar.hidden = false;
    tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.ruta === ruta));
    const y = window.scrollY;
    await RUTAS[ruta](view, ctx);
    window.scrollTo(0, y);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<section class="screen"><div class="card"><h2>Algo falló</h2><p class="muted">${esc(err.message)}</p></div></section>`;
  } finally {
    fin();
  }
}

// ---------- Guía de instalación (Safari y la app instalada guardan datos por separado) ----------
function navegadorPermitido() {
  try { return localStorage.getItem('tracker:usarNavegador') === '1'; } catch (_) { return false; }
}

function pintarGuia() {
  tabbar.hidden = true;
  view.innerHTML = `
  <section class="screen install">
    <header class="screen-head"><p class="eyebrow">Antes de empezar</p><h1>Instala Tracker en tu iPhone</h1></header>
    <div class="card">
      <ol class="steps">
        <li>Abre esta página en <strong>Safari</strong>.</li>
        <li>Toca <strong>Compartir</strong> (cuadro con flecha hacia arriba).</li>
        <li>Elige <strong>Agregar a pantalla de inicio</strong>.</li>
        <li>Deja activado <strong>Abrir como app web</strong> y toca <strong>Agregar</strong>.</li>
        <li>Abre Tracker desde su ícono y registra siempre ahí.</li>
      </ol>
    </div>
    <div class="card notice static">
      <strong>Importante</strong>
      <span>Lo que registres aquí en el navegador no aparece en la app instalada: iOS guarda los datos de cada una por separado.</span>
    </div>
    <button class="btn ghost block" data-navegador>${isIOS ? 'Usar en el navegador de todos modos' : 'Continuar en este navegador'}</button>
  </section>`;
  view.querySelector('[data-navegador]').addEventListener('click', () => {
    try { localStorage.setItem('tracker:usarNavegador', '1'); } catch (_) { /* sin almacenamiento */ }
    arrancarApp();
  });
}

async function arrancarApp() {
  ctx.settings = await D.getSettings();
  if (!ctx.settings) {
    tabbar.hidden = true;
    renderOnboarding(view, async (s) => {
      ctx.settings = s;
      await pedirPersistencia();
      location.hash = '#/hoy';
      pintar();
    });
    return;
  }
  pintar();
}

async function iniciar() {
  try {
    await db.open();
    await D.sembrar();
    await D.migrarNotaAntigua();
  } catch (err) {
    view.innerHTML = `<section class="screen"><div class="card"><h2>No se pudo abrir la base de datos</h2>
      <p class="muted">${esc(err.message)}</p><p class="hint">Si estás en navegación privada, ábrela en modo normal.</p></div></section>`;
    return;
  }
  if (standalone) pedirPersistencia();

  window.addEventListener('hashchange', () => { cerrarTodas(); if (ctx.settings) pintar(); });
  // Al volver a la app después de medianoche, «Hoy» debe ser hoy
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx.settings) {
      const hoy = C.isoLocal();
      if (ctx.fecha !== hoy && ctx._ultimoHoy !== hoy) { ctx.fecha = hoy; pintar(); }
      ctx._ultimoHoy = hoy;
    }
  });
  ctx._ultimoHoy = C.isoLocal();

  if (!standalone && !navegadorPermitido()) pintarGuia();
  else arrancarApp();
}

// ---------- Service worker: offline + aviso de actualización ----------
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  const toast = document.getElementById('update-toast');
  const mostrar = (w) => { toast.hidden = false; document.getElementById('update-btn').onclick = () => w.postMessage('SKIP_WAITING'); };
  const hadController = Boolean(navigator.serviceWorker.controller);
  let recargado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || recargado) return;
    recargado = true;
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.version) {
      ctx.version = e.data.version;
      const el = document.querySelector('[data-version]');
      if (el) el.textContent = ctx.version;
    }
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) mostrar(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) mostrar(w); });
      });
      const listo = await navigator.serviceWorker.ready;
      listo.active?.postMessage('GET_VERSION');
      // Busca versiones nuevas al volver a la app
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch (err) {
      console.error('Service worker:', err);
    }
  });
}

registrarSW();
iniciar();
