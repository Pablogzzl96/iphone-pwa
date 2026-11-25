// ajustes.js — perfil y metas, plantillas, factores de cocción, respaldo, almacenamiento y versión.
import { esc, n0, n1, n2, num, abrirHoja, aviso, confirmar, fechaMes } from './dom.js';
import * as D from '../data.js';
import * as C from '../calc.js';
import * as db from '../db.js';
import * as B from '../backup.js';
import { formPerfil, montarFormPerfil } from './perfil.js';

const NOMBRES_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export async function renderAjustes(view, ctx) {
  const s = ctx.settings;
  const [ps, ys, ultimoRespaldo, alm] = await Promise.all([
    D.plantillas(), D.factores(), db.getMeta('ultimoRespaldo'), B.estadoAlmacenamiento(),
  ]);
  // Archivos de respaldo preparados de antemano (iOS exige compartir dentro del toque)
  const archivos = { json: B.prepararJSON(), comidas: B.prepararCSVComidas(), diario: B.prepararCSVDiario(s) };

  const dias = [1, 2, 3, 4, 5, 6, 0].filter((d) => s.diasEntreno.includes(d)).map((d) => NOMBRES_DIA[d]).join(', ') || 'ninguno';

  view.innerHTML = `
  <section class="screen ajustes">
    <header class="screen-head"><p class="eyebrow">Ajustes</p><h1>Tu configuración</h1></header>

    <div class="card">
      <div class="card-head"><h2>Perfil y metas</h2><button class="link" data-editar>Editar</button></div>
      <ul class="kv">
        <li><span>Plantilla A · entreno</span><strong>${n0(s.plantillas.A.kcal)} kcal · ${n0(s.plantillas.A.prot)} g</strong></li>
        <li><span>Plantilla B · descanso</span><strong>${n0(s.plantillas.B.kcal)} kcal · ${n0(s.plantillas.B.prot)} g</strong></li>
        <li><span>Mantenimiento estimado</span><strong>${n0(s.mantenimientoEstimado)} kcal</strong></li>
        <li><span>Días de entreno</span><strong>${esc(dias)}</strong></li>
        <li><span>Ritmo objetivo</span><strong>${n2(s.ritmoObjetivoKgSem[0])}–${n2(s.ritmoObjetivoKgSem[1])} kg/sem</strong></li>
        <li><span>Meta de grasa</span><strong>${s.metaGrasaPct ? `${n1(s.metaGrasaPct[0])}–${n1(s.metaGrasaPct[1])} %` : '—'}</strong></li>
      </ul>
    </div>

    <div class="card">
      <h2>Respaldo</h2>
      <p class="muted small">${ultimoRespaldo ? `Último: ${esc(fechaMes(ultimoRespaldo.slice(0, 10)))}` : 'Aún no has respaldado.'}</p>
      <p class="hint">Tus datos viven solo en este iPhone. Si borras el ícono o cambias de teléfono se pierden: exporta cada semana y elige «Guardar en Archivos» (iCloud Drive).</p>
      <button class="btn primary block" data-exp="json">Exportar respaldo (JSON)</button>
      <div class="row gap">
        <button class="btn ghost grow" data-exp="diario">CSV diario</button>
        <button class="btn ghost grow" data-exp="comidas">CSV de comidas</button>
      </div>
      <label class="btn ghost block file-btn">Importar respaldo…<input type="file" accept="application/json,.json" hidden data-import /></label>
    </div>

    <div class="card">
      <h2>Plantillas</h2>
      ${ps.length ? `<ul class="list compact">${ps.map((r) => {
        const t = C.totales(r.items);
        return `<li><button class="item" data-r="${esc(r.id)}"><span class="item-main"><strong>${esc(r.nombre)}</strong>
          <small>${r.items.length} elementos · ${n0(t.kcal)} kcal · ${n0(t.prot)} g</small></span><span class="plus">›</span></button></li>`;
      }).join('')}</ul>` : `<p class="muted small">Créalas desde Hoy con el botón ⋯ de cada comida.</p>`}
    </div>

    <div class="card">
      <h2>Factores crudo → cocido</h2>
      <p class="hint">Peso cocido ÷ peso crudo. Calibra el tuyo una vez: vale más que cualquier tabla.</p>
      <ul class="list compact">${ys.map((y) => `
        <li><button class="item" data-y="${esc(y.id)}"><span class="item-main"><strong>${esc(y.nombre)}</strong>
        <small>× ${n2(y.factor)} · ${y.fuente === 'calibrado' ? 'calibrado por ti' : 'referencia'}</small></span><span class="plus">›</span></button></li>`).join('')}
      </ul>
    </div>

    <div class="card">
      <h2>Almacenamiento</h2>
      <ul class="kv">
        <li><span>Persistente</span><strong>${alm.persisted === null ? 'no disponible' : alm.persisted ? 'sí' : 'no'}</strong></li>
        <li><span>Uso</span><strong>${alm.usoMB != null ? `${n1(alm.usoMB)} MB` : '—'}</strong></li>
        <li><span>Modo</span><strong>${ctx.standalone ? 'App instalada' : 'Navegador'}</strong></li>
        <li><span>Versión</span><strong data-version>${esc(ctx.version || '—')}</strong></li>
      </ul>
      ${alm.persisted === false ? `<button class="btn ghost block" data-persist>Pedir almacenamiento persistente</button>
        <p class="hint">iOS lo concede por heurística, sobre todo a apps abiertas desde la pantalla de inicio.</p>` : ''}
      ${!ctx.standalone ? `<p class="hint">Estás en el navegador: lo que registres aquí no aparece en la app instalada.</p>` : ''}
    </div>

    <div class="card danger-zone">
      <h2>Borrar datos</h2>
      <p class="hint">Exporta un respaldo antes. Esto no se puede deshacer.</p>
      <button class="btn ghost block" data-borrar-todo>Borrar todos los datos de este dispositivo</button>
    </div>
    <p class="muted small center"><a href="tests/calc.test.html">Pruebas de cálculo</a></p>
  </section>`;

  // ---------- Perfil ----------
  view.querySelector('[data-editar]').addEventListener('click', () => {
    abrirHoja(`<div class="sheet-head"><h2>Perfil y metas</h2><button class="link" data-cerrar>Cancelar</button></div>${formPerfil(s)}`, {
      clase: 'tall',
      onMount: (el, h) => montarFormPerfil(el, s, async (nuevo) => {
        ctx.settings = nuevo; h.cerrar(); aviso('Metas guardadas'); await ctx.refrescar();
      }),
    });
  });

  // ---------- Respaldo ----------
  view.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', async () => {
    const tipo = b.dataset.exp;
    const file = await archivos[tipo];
    const ok = await B.entregar(file, tipo === 'json' ? 'Respaldo del tracker' : 'Exportación CSV');
    if (ok && tipo === 'json') { await B.marcarRespaldo(); aviso('Respaldo exportado'); await ctx.refrescar(); }
  }));

  view.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(await confirmar({ titulo: `¿Importar ${file.name}?`, texto: 'Se fusiona con lo que ya tienes: los registros con la misma fecha o id se reemplazan por los del archivo.', ok: 'Importar' }))) return;
    try {
      const r = await B.importarJSON(file);
      ctx.settings = (await D.getSettings()) ?? ctx.settings;
      aviso(`Importado: ${r.entries} registros, ${r.weights} pesajes`);
      await ctx.refrescar();
    } catch (err) {
      aviso(err.message);
    }
  });

  // ---------- Plantillas ----------
  view.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
    const r = ps.find((x) => x.id === b.dataset.r);
    abrirHoja(`<div class="sheet-head"><h2>Plantilla</h2><button class="link" data-cerrar>Cancelar</button></div>
      <form class="stack">
        <label class="field"><span>Nombre</span><input name="nombre" value="${esc(r.nombre)}" autocomplete="off" /></label>
        <ul class="list compact">${r.items.map((it) => `<li class="item static"><span class="item-main"><strong>${esc(it.nombre)}</strong>
          <small>${it.cantidadG ? `${n0(it.cantidadG)} g · ` : ''}${n0(it.kcal)} kcal · ${n1(it.prot)} g</small></span></li>`).join('')}</ul>
        <button class="btn primary block" type="submit">Guardar nombre</button>
        <button type="button" class="btn ghost block" data-del>Borrar plantilla</button>
      </form>`, {
      onMount: (el, h) => {
        el.querySelector('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          await D.guardarPlantilla({ ...r, nombre: e.target.nombre.value.trim() || r.nombre });
          h.cerrar(); await ctx.refrescar();
        });
        el.querySelector('[data-del]').addEventListener('click', async () => {
          await D.borrarPlantilla(r.id); h.cerrar(); aviso('Plantilla borrada'); await ctx.refrescar();
        });
      },
    });
  }));

  // ---------- Factores de cocción: editar, calibrar, convertir ----------
  view.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => {
    const y = ys.find((x) => x.id === b.dataset.y);
    abrirHoja(`<div class="sheet-head"><h2>${esc(y.nombre)}</h2><button class="link" data-cerrar>Cerrar</button></div>
      <p class="hint">${esc(y.nota || '')}</p>
      <form class="stack calibrar">
        <h3 class="sub">Calibrar con tu cocina</h3>
        <div class="grid2">
          <label class="field"><span>Crudo / seco</span><span class="input-wrap"><input name="crudo" inputmode="decimal" /><em>g</em></span></label>
          <label class="field"><span>Ya cocido</span><span class="input-wrap"><input name="cocido" inputmode="decimal" /><em>g</em></span></label>
        </div>
        <p class="hint res"></p>
        <label class="field"><span>Factor actual</span><input name="factor" inputmode="decimal" value="${y.factor}" /></label>
        <button class="btn primary block" type="submit">Guardar factor</button>
      </form>
      <form class="stack convertir">
        <h3 class="sub">Conversor</h3>
        <div class="grid2">
          <label class="field"><span>Crudo / seco</span><span class="input-wrap"><input name="crudo" inputmode="decimal" /><em>g</em></span></label>
          <label class="field"><span>Cocido</span><span class="input-wrap"><input name="cocido" inputmode="decimal" /><em>g</em></span></label>
        </div>
      </form>`, {
      onMount: (el, h) => {
        const cal = el.querySelector('.calibrar');
        cal.addEventListener('input', (e) => {
          if (e.target.name === 'factor') return;
          const cr = num(cal.crudo.value), co = num(cal.cocido.value);
          if (cr > 0 && co > 0) {
            const f = C.calibrarFactor(cr, co);
            cal.factor.value = f;
            cal.querySelector('.res').textContent = `Tu factor: × ${f}`;
          }
        });
        cal.addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = num(cal.factor.value);
          if (!(f > 0)) return;
          const calibrado = num(cal.crudo.value) > 0 && num(cal.cocido.value) > 0;
          await D.guardarFactor({ ...y, factor: f, fuente: calibrado || f !== y.factor ? 'calibrado' : y.fuente });
          h.cerrar(); aviso('Factor guardado'); await ctx.refrescar();
        });
        const conv = el.querySelector('.convertir');
        conv.addEventListener('input', (e) => {
          const f = num(cal.factor.value) || y.factor;
          const v = num(e.target.value);
          if (!(v > 0)) return;
          if (e.target.name === 'crudo') conv.cocido.value = C.crudoACocido(v, f);
          else conv.crudo.value = C.cocidoACrudo(v, f);
        });
      },
    });
  }));

  // ---------- Almacenamiento ----------
  view.querySelector('[data-persist]')?.addEventListener('click', async () => {
    const r = await B.pedirPersistencia();
    aviso(r ? 'Almacenamiento persistente concedido' : 'iOS no lo concedió por ahora');
    await ctx.refrescar();
  });

  view.querySelector('[data-borrar-todo]').addEventListener('click', async () => {
    if (!(await confirmar({ titulo: '¿Borrar todos los datos?', texto: 'Se eliminan perfil, registros, pesos, medidas y plantillas de este dispositivo. No se puede deshacer.', ok: 'Borrar todo' }))) return;
    await db.borrarTodo();
    location.reload();
  });
}
