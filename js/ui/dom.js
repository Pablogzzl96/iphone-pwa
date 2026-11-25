// dom.js — utilidades de interfaz: escape, formato, hojas modales, avisos.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
export const n0 = (v) => (v == null || Number.isNaN(v) ? '—' : nf0.format(v));
export const n1 = (v) => (v == null || Number.isNaN(v) ? '—' : nf1.format(v));
export const n2 = (v) => (v == null || Number.isNaN(v) ? '—' : nf2.format(v));
export const signo = (v, f = n0) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));

export function fechaLarga(iso) {
  const d = new Date(iso + 'T12:00:00');
  const s = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function fechaCorta(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
export function fechaMes(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const num = (v) => {
  if (v == null) return null;
  const x = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};

// Lee los campos de un formulario como objeto { name: valor }
export function leerForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  }
  return o;
}

// ---------- Hojas modales (se pueden apilar) ----------
const pila = [];

export function abrirHoja(html, { onMount, onClose, clase = '' } = {}) {
  const raiz = document.getElementById('sheets');
  const fondo = document.createElement('div');
  fondo.className = 'sheet-backdrop';
  fondo.innerHTML = `<div class="sheet ${clase}" role="dialog" aria-modal="true">
      <div class="sheet-grabber" aria-hidden="true"></div>${html}</div>`;
  raiz.append(fondo);
  document.body.classList.add('no-scroll');
  const hoja = { el: fondo.querySelector('.sheet'), cerrar };
  function cerrar() {
    const i = pila.indexOf(hoja);
    if (i >= 0) pila.splice(i, 1);
    fondo.remove();
    if (!pila.length) document.body.classList.remove('no-scroll');
    onClose?.();
  }
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  hoja.el.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
  pila.push(hoja);
  requestAnimationFrame(() => fondo.classList.add('open'));
  onMount?.(hoja.el, hoja);
  return hoja;
}

export const cerrarTodas = () => { while (pila.length) pila.at(-1).cerrar(); };

// Confirmación propia (sin window.confirm)
export function confirmar({ titulo, texto = '', ok = 'Confirmar', cancelar = 'Cancelar' }) {
  return new Promise((resolve) => {
    let respondido = false;
    abrirHoja(
      `<h2>${esc(titulo)}</h2>${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
       <div class="row gap"><button class="btn ghost" data-cerrar>${esc(cancelar)}</button>
       <button class="btn primary" data-ok>${esc(ok)}</button></div>`,
      {
        onMount: (el, h) => el.querySelector('[data-ok]').addEventListener('click', () => { respondido = true; resolve(true); h.cerrar(); }),
        onClose: () => { if (!respondido) resolve(false); },
      }
    );
  });
}

// ---------- Aviso breve con acción opcional ----------
let toastTimer;
export function aviso(texto, accion) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button type="button">${esc(accion.label)}</button>` : ''}`;
  el.hidden = false;
  if (accion) el.querySelector('button').onclick = () => { el.hidden = true; accion.fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, accion ? 5000 : 2200);
}

// Normaliza para búsqueda: minúsculas y sin acentos
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
