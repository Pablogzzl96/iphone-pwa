// progreso.js — balance semanal, gasto adaptativo, check-in quincenal (propuesta, nunca automática)
// y proyección a la meta como rango de fechas.
import { esc, n0, n1, n2, signo, aviso, fechaCorta, fechaMes } from './dom.js';
import * as D from '../data.js';
import * as C from '../calc.js';
import * as db from '../db.js';

function barras14(dias) {
  const W = 340, H = 130, P = { l: 6, r: 6, t: 8, b: 18 };
  const max = Math.max(1, ...dias.map((d) => Math.max(d.kcal, d.metaKcal))) * 1.08;
  const bw = (W - P.l - P.r) / dias.length;
  const Y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorías de los últimos 14 días">
    ${dias.map((d, i) => {
      const x = P.l + i * bw;
      const fuera = d.modo === 'enfermo' || d.modo === 'mantenimiento';
      // Tolerancia de 5 %: dentro del error normal de registro no se marca como «sobre»
      const cls = !d.nEntradas ? 'empty' : fuera ? 'off' : d.kcal > d.metaKcal * 1.05 ? 'over' : 'ok';
      return `<rect x="${(x + 2).toFixed(1)}" y="${Y(d.kcal).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(H - P.b - Y(d.kcal)).toFixed(1)}" class="b ${cls}"/>
        <line x1="${(x + 1).toFixed(1)}" x2="${(x + bw - 1).toFixed(1)}" y1="${Y(d.metaKcal).toFixed(1)}" y2="${Y(d.metaKcal).toFixed(1)}" class="goal"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" class="tick" text-anchor="middle">${'DLMMJVS'[C.diaSemana(d.fecha)]}</text>`;
    }).join('')}
  </svg>
  <p class="legend"><span class="sw bar"></span> consumido <span class="sw goal"></span> meta del día</p>`;
}

export async function renderProgreso(view, ctx) {
  const { settings } = ctx;
  const hoy = C.isoLocal();
  const ayer = C.sumarDias(hoy, -1);
  const lunes = C.lunesDe(hoy);

  const gasto = await D.gastoAdaptativo(settings);
  const [estaSem, semPasada, ult14, ps, ms, ultimoCheckin, historial] = await Promise.all([
    D.resumenRango(lunes, hoy, settings, gasto.tdee),
    D.resumenRango(C.sumarDias(lunes, -7), C.sumarDias(lunes, -1), settings, gasto.tdee),
    D.resumenRango(C.sumarDias(ayer, -13), ayer, settings, gasto.tdee),
    D.pesos(),
    D.medidas(),
    db.getMeta('ultimoCheckin'),
    db.getMeta('historialCheckins', []),
  ]);
  const bEsta = C.balanceSemanal(estaSem), bPasada = C.balanceSemanal(semPasada);
  const tend = C.tendenciaEMA(ps).at(-1);
  const ritmo = C.ritmoKgSemana(ps);
  const [rMin, rMax] = settings.ritmoObjetivoKgSem;

  // ---------- Check-in quincenal ----------
  const diasValidos = ult14.filter((d) => d.completo && d.modo !== 'enfermo').length;
  const diasEnfermo = ult14.filter((d) => d.modo === 'enfermo').length;
  const A = settings.plantillas.A, B = settings.plantillas.B;
  const kcalMeta = Math.round((A.kcal + B.kcal) / 2);
  const aj = tend
    ? C.ajusteQuincenal({ ritmo, pesoTendencia: tend.tendencia, kcalMeta, tdee: gasto.tdee,
                          objetivo: [rMin, rMax], diasValidos, diasEnfermo })
    : { accion: 'mantener', delta: 0, motivo: 'Registra tu peso para empezar.', sugeridaPorTdee: null };
  const diasDesde = ultimoCheckin ? C.diaNum(hoy) - C.diaNum(ultimoCheckin) : null;
  const toca = diasDesde === null || diasDesde >= 14;

  // ---------- Proyección ----------
  const ultimaMedida = ms.at(-1);
  let proy = null, proyMsg = '';
  const metaPct = settings.metaGrasaPct;
  if (!tend) proyMsg = 'Necesita al menos un pesaje.';
  else if (!ultimaMedida) proyMsg = 'Necesita tus medidas de cintura y cuello (pestaña Peso).';
  else if (!metaPct) proyMsg = 'Define tu meta de % de grasa en Ajustes → Perfil y metas.';
  else {
    const spanDias = ps.length ? C.diaNum(ps.at(-1).fecha) - C.diaNum(ps[0].fecha) : 0;
    const observado = ritmo !== null && ritmo < 0 && spanDias >= 21 ? -ritmo : null;
    const rango = observado ? [+(observado * 0.85).toFixed(2), +(observado * 1.15).toFixed(2)] : [rMin, rMax];
    proy = { ...C.proyeccion({ pesoTendencia: tend.tendencia, grasaPct: ultimaMedida.grasaPct, metaPct, ritmoKgSem: rango }),
             fuenteRitmo: observado ? 'tu ritmo real' : 'tu ritmo objetivo', rango };
  }

  const balTxt = (b) => !b.diasContados ? 'Sin días de déficit registrados'
    : b.balance >= 0 ? `${n0(b.balance)} kcal por debajo de la meta acumulada`
    : `${n0(-b.balance)} kcal sobre la meta acumulada`;

  view.innerHTML = `
  <section class="screen progreso">
    <header class="screen-head"><p class="eyebrow">Progreso</p><h1>Cómo va el plan</h1></header>

    <div class="card">
      <h2>Balance semanal</h2>
      <p class="hint">Lo que importa es la semana, no el día perfecto. Mantenimiento y Enfermo no cuentan.</p>
      <div class="stats two">
        <div><span class="lbl">Esta semana</span><strong class="small-strong">${balTxt(bEsta)}</strong><small>${bEsta.diasContados} días</small></div>
        <div><span class="lbl">Semana pasada</span><strong class="small-strong">${balTxt(bPasada)}</strong><small>${bPasada.diasContados} días</small></div>
      </div>
      ${barras14(ult14)}
    </div>

    <div class="card">
      <h2>Ritmo y gasto</h2>
      <div class="stats two">
        <div><span class="lbl">Ritmo real (14 días)</span>
          <strong>${ritmo === null ? '—' : `${signo(ritmo, n2)} kg/sem`}</strong>
          <small>objetivo −${n2(rMin)} a −${n2(rMax)}</small></div>
        <div><span class="lbl">Gasto estimado</span>
          <strong>${gasto.tdee ? `${n0(gasto.tdee)} kcal` : '—'}</strong>
          <small>${gasto.tdee ? `tu estimado inicial: ${n0(settings.mantenimientoEstimado)}` : `${gasto.diasCompletos}/18 días completos · ${gasto.pesajes}/8 pesajes (21 días)`}</small></div>
      </div>
      <p class="hint">El gasto se calcula como ingesta registrada menos el cambio en tu peso de tendencia (aprox. 7,700 kcal por kg). Importa más registrar con consistencia que con precisión.</p>
    </div>

    <div class="card checkin ${toca ? 'due' : ''}">
      <h2>Check-in quincenal</h2>
      <p class="muted small">${ultimoCheckin ? `Último: ${esc(fechaCorta(ultimoCheckin))}${toca ? '' : ` · próximo en ${14 - diasDesde} días`}` : 'Aún no haces el primero'}
        · ${diasValidos}/14 días completos${diasEnfermo ? ` · ${diasEnfermo} enfermo` : ''}</p>
      <p class="proposal"><strong>${aj.accion === 'mantener' ? 'Propuesta: mantener' : aj.accion === 'bajar' ? `Propuesta: bajar ${n0(-aj.delta)} kcal` : `Propuesta: subir ${n0(aj.delta)} kcal`}</strong></p>
      <p>${esc(aj.motivo)}</p>
      ${aj.delta ? `<p class="muted small">A: ${n0(A.kcal)} → ${n0(A.kcal + aj.delta)} kcal · B: ${n0(B.kcal)} → ${n0(B.kcal + aj.delta)} kcal. La proteína no cambia.</p>` : ''}
      ${aj.sugeridaPorTdee ? `<p class="muted small">Referencia: con tu gasto estimado, ~${n0(aj.sugeridaPorTdee)} kcal promedio darían el centro de tu ritmo objetivo.</p>` : ''}
      ${toca ? `<div class="row gap">
        ${aj.delta ? `<button class="btn primary" data-aplicar>Aplicar</button>` : ''}
        <button class="btn ${aj.delta ? 'ghost' : 'primary'}" data-mantener>${aj.delta ? 'Mantener' : 'Registrar check-in'}</button>
      </div>` : ''}
      ${historial.length ? `<p class="muted small">Historial: ${historial.slice(-4).map((h) => `${esc(fechaCorta(h.fecha))} ${h.delta ? signo(h.delta) : '='}`).join(' · ')}</p>` : ''}
    </div>

    <div class="card">
      <h2>Proyección a tu meta</h2>
      ${proy ? `
        <p class="big-range"><strong>${esc(fechaMes(proy.fechas[0]))}</strong> a <strong>${esc(fechaMes(proy.fechas[1]))}</strong></p>
        <p>${n1(proy.kgPorPerder[0])}–${n1(proy.kgPorPerder[1])} kg por perder · ${proy.semanas[0]}–${proy.semanas[1]} semanas con ${proy.fuenteRitmo} (${n2(proy.rango[0])}–${n2(proy.rango[1])} kg/sem).</p>
        <p class="hint">Supuestos: ${esc(proy.supuestos)} Es un rango a propósito: se estrecha conforme acumulas medidas y semanas de datos.</p>`
      : `<p class="muted">${esc(proyMsg)}</p>`}
    </div>
  </section>`;

  async function registrar(delta) {
    if (delta) {
      const s = structuredClone(settings);
      s.plantillas.A.kcal += delta;
      s.plantillas.B.kcal += delta;
      await D.saveSettings(s);
      ctx.settings = s;
    }
    await db.setMeta('ultimoCheckin', hoy);
    await db.setMeta('historialCheckins', [...historial, { fecha: hoy, delta, motivo: aj.motivo }]);
    aviso(delta ? `Metas ajustadas ${signo(delta)} kcal` : 'Check-in registrado');
    await ctx.refrescar();
  }
  view.querySelector('[data-aplicar]')?.addEventListener('click', () => registrar(aj.delta));
  view.querySelector('[data-mantener]')?.addEventListener('click', () => registrar(0));
}
