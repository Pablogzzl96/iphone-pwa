// peso.js — peso diario con tendencia (EMA 10 %), promedio semanal, ritmo de 14 días,
// y medidas con % de grasa por el método de la Marina (con su banda de error).
import { esc, n1, n2, num, signo, abrirHoja, aviso, confirmar, fechaCorta, leerForm } from './dom.js';
import * as D from '../data.js';
import * as C from '../calc.js';

function grafica(serie) {
  // serie: [{ fecha, kg, tendencia }] (últimos 60 días)
  if (serie.length < 2) return `<p class="empty">La gráfica aparece con 2 pesajes o más.</p>`;
  const W = 340, H = 170, P = { l: 34, r: 10, t: 10, b: 22 };
  const xs = serie.map((p) => C.diaNum(p.fecha));
  const ys = serie.flatMap((p) => [p.kg, p.tendencia]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(0.3, (y1 - y0) * 0.15); y0 -= pad; y1 += pad;
  const X = (d) => P.l + ((d - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const linea = serie.map((p, i) => `${i ? 'L' : 'M'}${X(C.diaNum(p.fecha)).toFixed(1)},${Y(p.tendencia).toFixed(1)}`).join('');
  const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso diario y tendencia">
    ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/>
      <text x="${P.l - 6}" y="${Y(t) + 4}" class="tick" text-anchor="end">${n1(t)}</text>`).join('')}
    ${serie.map((p) => `<circle cx="${X(C.diaNum(p.fecha)).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.6" class="dot"/>`).join('')}
    <path d="${linea}" class="trend"/>
    <text x="${P.l}" y="${H - 4}" class="tick">${esc(fechaCorta(serie[0].fecha))}</text>
    <text x="${W - P.r}" y="${H - 4}" class="tick" text-anchor="end">${esc(fechaCorta(serie.at(-1).fecha))}</text>
  </svg>
  <p class="legend"><span class="sw dot"></span> pesaje diario <span class="sw line"></span> tendencia</p>`;
}

export async function renderPeso(view, ctx) {
  const { settings } = ctx;
  const hoy = C.isoLocal();
  const [ps, ms] = await Promise.all([D.pesos(), D.medidas()]);
  const conTend = C.tendenciaEMA(ps);
  const ultimo = conTend.at(-1);
  const pesoHoy = ps.find((p) => p.fecha === hoy);
  const sems = C.promediosSemanales(ps);
  const estaSem = sems.find((s) => s.semana === C.lunesDe(hoy));
  const semPasada = sems.find((s) => s.semana === C.sumarDias(C.lunesDe(hoy), -7));
  const ritmo = C.ritmoKgSemana(ps);
  const pesajes14 = ps.filter((p) => C.diaNum(hoy) - C.diaNum(p.fecha) < 14).length;
  const serie = conTend.filter((p) => C.diaNum(hoy) - C.diaNum(p.fecha) < 60);
  const mujer = settings.sexo === 'mujer';
  const ultimaMedida = ms.at(-1);

  const [rMin, rMax] = settings.ritmoObjetivoKgSem;
  const ritmoTxt = ritmo === null
    ? `Faltan pesajes: ${pesajes14} de 8 en los últimos 14 días`
    : `${signo(ritmo, n2)} kg/sem · objetivo −${n2(rMin)} a −${n2(rMax)}`;

  view.innerHTML = `
  <section class="screen peso">
    <header class="screen-head"><p class="eyebrow">Peso y medidas</p><h1>Tendencia</h1></header>

    <form class="card weigh">
      <label for="kg">${pesoHoy ? 'Peso de hoy (registrado)' : 'Peso de hoy'}</label>
      <div class="row gap">
        <span class="input-wrap grow"><input id="kg" name="kg" inputmode="decimal" value="${pesoHoy?.kg ?? ''}" placeholder="kg" autocomplete="off" /><em>kg</em></span>
        <button class="btn primary" type="submit">${pesoHoy ? 'Actualizar' : 'Guardar'}</button>
      </div>
      <label class="check"><input type="checkbox" name="ayunas" ${pesoHoy?.condicion === 'otra' ? '' : 'checked'}/><span>En ayunas, después del baño</span></label>
    </form>

    <div class="card stats">
      <div><span class="lbl">Tendencia</span><strong>${ultimo ? `${n1(ultimo.tendencia)} kg` : '—'}</strong></div>
      <div><span class="lbl">Promedio esta semana</span><strong>${estaSem ? `${n1(estaSem.promedio)} kg` : '—'}</strong>
        <small>${estaSem ? `${estaSem.n} pesajes${estaSem.valido ? '' : ' (faltan para 4)'}` : ''}</small></div>
      <div><span class="lbl">vs semana pasada</span><strong>${estaSem && semPasada ? `${signo(+(estaSem.promedio - semPasada.promedio).toFixed(2), n2)} kg` : '—'}</strong>
        <small>${semPasada ? `${n1(semPasada.promedio)} kg` : ''}</small></div>
      <div><span class="lbl">Ritmo 14 días</span><strong class="small-strong">${ritmoTxt}</strong></div>
    </div>

    <div class="card">${grafica(serie)}</div>

    <div class="card">
      <h2>Medidas y % de grasa</h2>
      <p class="hint">Cintura a la altura del ombligo, cuello justo debajo de la laringe${mujer ? ', cadera en su parte más ancha' : ''}. En ayunas, cada 2–4 semanas, siempre igual.</p>
      ${ultimaMedida ? `<p class="fat"><strong>${n1(ultimaMedida.grasaPct)} %</strong>
        <span class="muted">rango ${n1(ultimaMedida.grasaPct - 3.5)}–${n1(ultimaMedida.grasaPct + 3.5)} % · ${esc(fechaCorta(ultimaMedida.fecha))}</span></p>
        <p class="hint">Método de la Marina: úsalo para ver la dirección, no como cifra exacta (error típico ±3.5 puntos).</p>` : ''}
      <form class="stack medidas">
        <div class="grid2">
          <label class="field"><span>Cintura</span><span class="input-wrap"><input name="cintura" inputmode="decimal" autocomplete="off" /><em>cm</em></span></label>
          <label class="field"><span>Cuello</span><span class="input-wrap"><input name="cuello" inputmode="decimal" autocomplete="off" /><em>cm</em></span></label>
          ${mujer ? `<label class="field"><span>Cadera</span><span class="input-wrap"><input name="cadera" inputmode="decimal" autocomplete="off" /><em>cm</em></span></label>` : ''}
        </div>
        <button class="btn ghost block" type="submit">Guardar medidas de hoy</button>
      </form>
      ${ms.length ? `<ul class="list compact">${ms.slice(-6).reverse().map((m) => `
        <li><button class="item" data-m="${m.fecha}"><span class="item-main"><strong>${esc(fechaCorta(m.fecha))} · ${n1(m.grasaPct)} %</strong>
        <small>cintura ${n1(m.cinturaCm)} · cuello ${n1(m.cuelloCm)}${m.caderaCm ? ` · cadera ${n1(m.caderaCm)}` : ''} cm</small></span></button></li>`).join('')}</ul>` : ''}
    </div>

    ${ps.length ? `<div class="card"><h2>Pesajes recientes</h2>
      <ul class="list compact">${conTend.slice(-14).reverse().map((p) => `
        <li><button class="item" data-p="${p.fecha}"><span class="item-main"><strong>${esc(fechaCorta(p.fecha))} · ${n1(p.kg)} kg</strong>
        <small>tendencia ${n1(p.tendencia)}${p.condicion === 'otra' ? ' · no en ayunas' : ''}</small></span></button></li>`).join('')}</ul></div>` : ''}
  </section>`;

  view.querySelector('.weigh').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = leerForm(e.target);
    const kg = num(v.kg);
    if (!(kg > 20 && kg < 400)) { aviso('Escribe tu peso en kg'); return; }
    await D.guardarPeso({ fecha: hoy, kg, hora: new Date().toTimeString().slice(0, 5), condicion: v.ayunas ? 'ayunas' : 'otra' });
    aviso('Peso guardado');
    await ctx.refrescar();
  });

  view.querySelector('.medidas').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = leerForm(e.target);
    const m = { cinturaCm: num(v.cintura), cuelloCm: num(v.cuello), caderaCm: num(v.cadera), estaturaCm: settings.estaturaCm };
    const g = C.grasaMarina(settings.sexo, m);
    if (!g || !(m.cinturaCm > 30) || !(m.cuelloCm > 15) || (mujer && !(m.caderaCm > 30))) {
      aviso('Revisa las medidas en cm (la cintura debe ser mayor que el cuello)'); return;
    }
    await D.guardarMedida({ fecha: hoy, cinturaCm: m.cinturaCm, cuelloCm: m.cuelloCm, caderaCm: m.caderaCm ?? null, grasaPct: g.pct });
    aviso(`Grasa estimada ${n1(g.pct)} % (±3.5)`);
    await ctx.refrescar();
  });

  view.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', async () => {
    const p = ps.find((x) => x.fecha === b.dataset.p);
    if (await confirmar({ titulo: `¿Borrar el pesaje del ${fechaCorta(p.fecha)}?`, texto: `${n1(p.kg)} kg`, ok: 'Borrar' })) {
      await D.borrarPeso(p.fecha); await ctx.refrescar();
    }
  }));
  view.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', async () => {
    if (await confirmar({ titulo: `¿Borrar las medidas del ${fechaCorta(b.dataset.m)}?`, ok: 'Borrar' })) {
      await D.borrarMedida(b.dataset.m); await ctx.refrescar();
    }
  }));
}

export { abrirHoja };
