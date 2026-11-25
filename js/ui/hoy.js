// hoy.js — pantalla principal: restante del día (como rango), balance semanal, comidas y peso de hoy.
import { esc, n0, n1, num, abrirHoja, aviso, fechaLarga } from './dom.js';
import * as D from '../data.js';
import * as C from '../calc.js';
import * as db from '../db.js';
import { abrirRegistrar, abrirEntrada } from './registrar.js';

const PREC_ICON = { pesado: '', etiqueta: '', estimado: '≈ ', restaurante: '≈ ' };

function barra(valor, meta, { piso = false } = {}) {
  const pct = meta > 0 ? Math.min(100, (valor / meta) * 100) : 0;
  const sobre = !piso && valor > meta;
  return `<div class="bar ${sobre ? 'over' : ''}"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

export async function renderHoy(view, ctx) {
  const { settings } = ctx;
  const fecha = ctx.fecha;
  const hoyISO = C.isoLocal();
  const esHoy = fecha === hoyISO;

  const gasto = await D.gastoAdaptativo(settings);
  const [res, sem, pesoHoy, ayer, ultimoRespaldo, nEntradas] = await Promise.all([
    D.resumenDia(fecha, settings, gasto.tdee),
    D.semana(fecha, settings),
    db.get('weights', fecha),
    D.entradasDe(C.sumarDias(fecha, -1)),
    db.getMeta('ultimoRespaldo'),
    db.count('entries'),
  ]);
  const { dia, entradas, meta, restante: r, tot } = res;

  // Texto principal sin tono punitivo
  const principal = r.kcal >= 0
    ? `<p class="big">Te quedan <strong>${n0(r.kcal)}</strong> kcal</p>`
    : `<p class="big over-txt">Vas <strong>${n0(-r.kcal)}</strong> kcal sobre la meta de hoy</p>`;
  const rango = entradas.length ? `<p class="muted small">Rango por precisión: ${n0(r.kcalRango[0])} a ${n0(r.kcalRango[1])} kcal</p>` : '';
  const protTxt = r.prot > 0
    ? `<strong>${n0(r.prot)} g</strong> de proteína por cubrir`
    : `Proteína cubierta <strong>(+${n0(-r.prot)} g)</strong>`;

  const balanceTxt = sem.diasContados
    ? sem.balance >= 0
      ? `Semana: <strong>${n0(sem.balance)} kcal</strong> por debajo de tu meta acumulada (${sem.diasContados} ${sem.diasContados === 1 ? 'día' : 'días'})`
      : `Semana: <strong>${n0(-sem.balance)} kcal</strong> sobre tu meta acumulada (${sem.diasContados} ${sem.diasContados === 1 ? 'día' : 'días'})`
    : 'Semana: aún sin días de déficit registrados';

  // Respaldo pendiente
  const diasSinRespaldo = ultimoRespaldo ? Math.floor((Date.now() - new Date(ultimoRespaldo)) / 86400000) : null;
  const pideRespaldo = nEntradas > 0 && (diasSinRespaldo === null || diasSinRespaldo >= 7);

  const grupos = D.COMIDAS.map((c) => ({ ...c, xs: entradas.filter((e) => e.comida === c.id) }));

  view.innerHTML = `
  <section class="screen hoy">
    <header class="screen-head date-nav">
      <button class="icon" data-dia="-1" aria-label="Día anterior">‹</button>
      <div><p class="eyebrow">${esHoy ? 'Hoy' : fecha < hoyISO ? 'Día pasado' : 'Día futuro'}</p><h1>${esc(fechaLarga(fecha))}</h1></div>
      <button class="icon" data-dia="1" aria-label="Día siguiente" ${esHoy ? 'disabled' : ''}>›</button>
    </header>

    <button class="chip mode" data-modo>${esc(C.MODOS[dia.modo])} ▾</button>

    <div class="card hero">
      ${principal}
      ${rango}
      <p class="prot">${protTxt}</p>
      <div class="bars">
        <div><span class="lbl">Calorías</span>${barra(tot.kcal, meta.kcal)}<span class="val">${n0(tot.kcal)} / ${n0(meta.kcal)}</span></div>
        <div><span class="lbl">Proteína</span>${barra(tot.prot, meta.prot, { piso: true })}<span class="val">${n0(tot.prot)} / ${n0(meta.prot)} g</span></div>
      </div>
      ${entradas.length && entradas.every((e) => e.grasa != null && e.carbs != null)
        ? `<p class="muted small">Grasa ${n0(tot.grasa)} g · Carbohidratos ${n0(tot.carbs)} g</p>` : ''}
      ${dia.modo === 'enfermo' ? `<p class="muted small">Día de enfermedad: comes a mantenimiento y no cuenta para el déficit.</p>` : ''}
    </div>

    <p class="week">${balanceTxt}</p>

    ${esHoy && !pesoHoy ? `
    <form class="card inline-weight">
      <label for="peso-hoy">Peso de hoy</label>
      <span class="input-wrap"><input id="peso-hoy" name="kg" inputmode="decimal" placeholder="kg" autocomplete="off" /><em>kg</em></span>
      <button class="btn primary" type="submit">Guardar</button>
    </form>` : ''}

    ${pideRespaldo ? `
    <button class="card notice" data-ir="ajustes">
      <strong>${diasSinRespaldo === null ? 'Aún no has respaldado tus datos' : `Último respaldo hace ${diasSinRespaldo} días`}</strong>
      <span>Exporta tu JSON y guárdalo en Archivos ›</span>
    </button>` : ''}

    ${grupos.map((g) => `
      <div class="meal">
        <div class="meal-head">
          <h2>${g.nombre}</h2>
          <span class="muted small">${g.xs.length ? `${n0(C.totales(g.xs).kcal)} kcal · ${n0(C.totales(g.xs).prot)} g` : ''}</span>
          ${g.xs.length ? `<button class="icon small" data-menu="${g.id}" aria-label="Opciones de ${g.nombre}">⋯</button>` : ''}
        </div>
        ${g.xs.length ? `<ul class="list">${g.xs.map((e) => `
          <li><button class="item" data-e="${esc(e.id)}">
            <span class="item-main"><strong>${PREC_ICON[e.precision] ?? ''}${esc(e.nombreSnapshot)}</strong>
            <small>${e.cantidadG ? `${n0(e.cantidadG)} g · ` : e.porciones && e.porciones !== 1 ? `${n1(e.porciones)} porc. · ` : ''}${n0(e.kcal)} kcal · ${n1(e.prot)} g</small></span>
          </button></li>`).join('')}</ul>` : ''}
        <button class="add-meal" data-add="${g.id}">+ Agregar a ${g.nombre.toLowerCase()}</button>
      </div>`).join('')}

    ${!entradas.length && ayer.length ? `<button class="btn ghost block" data-copiar-ayer>Copiar todo lo de ayer (${ayer.length})</button>` : ''}

    <div class="card soft day-foot">
      <label class="check"><input type="checkbox" data-completo ${dia.completo ? 'checked' : ''}/><span>Registré todo este día</span></label>
      <p class="hint">Marca los días completos: con ellos la app calcula tu gasto real.</p>
      <label class="field"><span>Nota del día</span><textarea rows="2" data-nota placeholder="Cómo te sentiste, entrenamiento, antojos…">${esc(dia.nota || '')}</textarea></label>
    </div>
  </section>
  <button class="fab" data-add="" aria-label="Agregar comida">+</button>`;

  // ---------- Eventos ----------
  view.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => ctx.setFecha(C.sumarDias(fecha, +b.dataset.dia))));
  view.querySelector('[data-ir]')?.addEventListener('click', () => ctx.navegar('ajustes'));

  view.querySelectorAll('[data-add]').forEach((b) =>
    b.addEventListener('click', () => abrirRegistrar(ctx, { fecha, comida: b.dataset.add || undefined })));

  view.querySelectorAll('[data-e]').forEach((b) =>
    b.addEventListener('click', () => abrirEntrada(ctx, entradas.find((e) => e.id === b.dataset.e))));

  view.querySelector('[data-modo]').addEventListener('click', () => {
    abrirHoja(`<h2>Modo del día</h2>
      <ul class="list">${Object.entries(C.MODOS).map(([k, v]) => `
        <li><button class="item ${k === dia.modo ? 'sel' : ''}" data-m="${k}"><span class="item-main"><strong>${v}</strong>
        <small>${k === 'deficitA' ? `${n0(settings.plantillas.A.kcal)} kcal · ${n0(settings.plantillas.A.prot)} g`
          : k === 'deficitB' ? `${n0(settings.plantillas.B.kcal)} kcal · ${n0(settings.plantillas.B.prot)} g`
          : k === 'mantenimiento' ? `${n0(gasto.tdee ?? settings.mantenimientoEstimado)} kcal · no cuenta para el déficit`
          : 'Comes a mantenimiento, sin culpa: no cuenta como fallo'}</small></span></button></li>`).join('')}</ul>`, {
      onMount: (el, h) => el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', async () => {
        await D.guardarDia({ ...dia, completo: chkCompleto.checked, nota: txtNota.value, modo: b.dataset.m });
        h.cerrar();
        await ctx.refrescar();
      })),
    });
  });

  view.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => {
    const g = grupos.find((x) => x.id === b.dataset.menu);
    abrirHoja(`<h2>${g.nombre}</h2>
      <ul class="list">
        <li><button class="item" data-a="plantilla"><span class="item-main"><strong>Guardar como plantilla</strong><small>Para registrarla completa con un toque</small></span></button></li>
        <li><button class="item" data-a="manana"><span class="item-main"><strong>Copiar a mañana</strong><small>${g.xs.length} elementos</small></span></button></li>
      </ul>`, {
      onMount: (el, h) => {
        el.querySelector('[data-a="plantilla"]').addEventListener('click', () => {
          h.cerrar();
          abrirHoja(`<h2>Nombre de la plantilla</h2>
            <form class="stack"><input name="nombre" value="${esc(g.nombre)} habitual" autocomplete="off" />
            <button class="btn primary block" type="submit">Guardar</button></form>`, {
            onMount: (el2, h2) => el2.querySelector('form').addEventListener('submit', async (e) => {
              e.preventDefault();
              await D.guardarComoPlantilla(e.target.nombre.value.trim() || g.nombre, g.xs);
              h2.cerrar();
              aviso('Plantilla guardada');
            }),
          });
        });
        el.querySelector('[data-a="manana"]').addEventListener('click', async () => {
          await D.copiarEntradas(fecha, C.sumarDias(fecha, 1), g.id);
          h.cerrar();
          aviso(`${g.nombre} copiado a mañana`);
        });
      },
    });
  }));

  view.querySelector('[data-copiar-ayer]')?.addEventListener('click', async () => {
    const n = await D.copiarEntradas(C.sumarDias(fecha, -1), fecha);
    await ctx.refrescar();
    aviso(`${n} registros copiados de ayer`);
  });

  const chkCompleto = view.querySelector('[data-completo]');
  const txtNota = view.querySelector('[data-nota]');
  const guardarPie = () => D.guardarDia({ ...dia, completo: chkCompleto.checked, nota: txtNota.value });
  chkCompleto.addEventListener('change', guardarPie);
  let notaTimer;
  txtNota.addEventListener('input', () => { clearTimeout(notaTimer); notaTimer = setTimeout(guardarPie, 500); });

  view.querySelector('.inline-weight')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kg = num(e.target.kg.value);
    if (!(kg > 20 && kg < 400)) { aviso('Escribe tu peso en kg'); return; }
    await D.guardarPeso({ fecha, kg, hora: new Date().toTimeString().slice(0, 5), condicion: 'ayunas' });
    aviso('Peso guardado');
    await ctx.refrescar();
  });
}
