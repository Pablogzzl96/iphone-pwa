// registrar.js — hojas para registrar comida: recientes, favoritos, plantillas, búsqueda,
// entrada rápida (kcal + proteína), cantidad con crudo/cocido y edición de entradas.
import { esc, n0, n1, num, abrirHoja, aviso, confirmar, norm, leerForm } from './dom.js';
import * as D from '../data.js';
import * as C from '../calc.js';

const segComidas = (sel) => `
  <div class="seg small" role="radiogroup">
    ${D.COMIDAS.map((c) => `<label><input type="radio" name="comida" value="${c.id}" ${c.id === sel ? 'checked' : ''}/><span>${c.nombre}</span></label>`).join('')}
  </div>`;

const segPrecision = (sel) => `
  <div class="seg small" role="radiogroup">
    ${D.PRECISIONES.map((p) => `<label><input type="radio" name="precision" value="${p.id}" ${p.id === sel ? 'checked' : ''}/><span>${p.nombre}</span></label>`).join('')}
  </div>`;

const macrosTxt = (k, p) => `${n0(k)} kcal · ${n1(p)} g prot`;

function baseTxt(f) {
  if (f.base === 'porcion') return `por ${esc(f.porcionNombre || 'porción')}${f.porcionG ? ` (${f.porcionG} g)` : ''}`;
  return 'por 100 g';
}

// ---------- Hoja principal ----------
export function abrirRegistrar(ctx, { fecha, comida }) {
  let tab = 'recientes';
  let comidaSel = comida ?? D.comidaPorHora();
  let filtro = '';

  const hoja = abrirHoja(
    `<div class="sheet-head"><h2>Agregar</h2><button class="link" data-cerrar>Listo</button></div>
     <form class="comida-sel">${segComidas(comidaSel)}</form>
     <button class="btn quick block" data-accion="rapido">⚡ Rápido · kcal + proteína</button>
     <div class="tabs" role="tablist">
       <button data-tab="recientes" class="on">Recientes</button>
       <button data-tab="favoritos">Favoritos</button>
       <button data-tab="plantillas">Plantillas</button>
       <button data-tab="buscar">Buscar</button>
     </div>
     <div class="tab-body"></div>`,
    { clase: 'tall' }
  );
  const el = hoja.el;
  const body = el.querySelector('.tab-body');

  el.querySelector('.comida-sel').addEventListener('change', (e) => { comidaSel = e.target.value; });
  el.querySelector('[data-accion="rapido"]').addEventListener('click', () =>
    abrirRapido(ctx, { fecha, comida: comidaSel, onListo: pintar }));
  el.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    el.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    pintar();
  });

  async function agregado(texto, entradasNuevas) {
    await ctx.refrescar();
    aviso(texto, entradasNuevas?.length ? {
      label: 'Deshacer',
      fn: async () => { for (const e of entradasNuevas) await D.borrarEntrada(e.id); await ctx.refrescar(); },
    } : null);
  }

  async function pintar() {
    if (tab === 'recientes') {
      const xs = await D.recientes();
      body.innerHTML = xs.length
        ? `<ul class="list">${xs.map((e, i) => `
            <li><button class="item" data-i="${i}">
              <span class="item-main"><strong>${esc(e.nombreSnapshot)}</strong>
              <small>${e.cantidadG ? `${n0(e.cantidadG)} g · ` : ''}${macrosTxt(e.kcal, e.prot)}</small></span>
              <span class="plus">+</span></button></li>`).join('')}</ul>`
        : `<p class="empty">Aquí aparecerá lo que registres. Empieza con «Rápido» o «Buscar».</p>`;
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', async () => {
        const e = xs[+b.dataset.i];
        const { id, creadoEn, hora, ...resto } = e;
        const nueva = await D.agregarEntrada({ ...resto, fecha, comida: comidaSel });
        await agregado(`${e.nombreSnapshot} agregado`, [nueva]);
      }));
    } else if (tab === 'favoritos' || tab === 'buscar') {
      const todos = await D.alimentos();
      const lista = () => {
        if (tab === 'favoritos') return todos.filter((f) => f.favorito);
        const q = norm(filtro);
        let xs = todos;
        if (q) xs = xs.filter((f) => norm(f.nombre).includes(q));
        return xs;
      };
      body.innerHTML = `
        ${tab === 'buscar' ? `<input class="search" type="search" placeholder="Buscar alimento…" value="${esc(filtro)}" />` : ''}
        <ul class="list foods"></ul>
        ${tab === 'buscar' ? `<button class="btn ghost block" data-accion="crear">+ Crear alimento</button>` : ''}`;
      const ul = body.querySelector('.foods');
      const pintarLista = () => {
        const xs = lista();
        ul.innerHTML = xs.length
          ? xs.map((f) => `<li><button class="item" data-id="${esc(f.id)}">
              <span class="item-main"><strong>${f.favorito ? '★ ' : ''}${esc(f.nombre)}</strong>
              <small>${macrosTxt(f.kcal, f.prot)} ${baseTxt(f)}</small></span><span class="plus">›</span></button></li>`).join('')
          : `<li class="empty">${tab === 'favoritos' ? 'Marca alimentos con ★ o guarda entradas rápidas como favoritas.' : 'Sin resultados. Crea el alimento con su etiqueta.'}</li>`;
        ul.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
          const f = todos.find((x) => x.id === b.dataset.id);
          abrirCantidad(ctx, {
            food: f, fecha, comida: comidaSel, onEditado: pintar,
            onListo: async (nuevas) => { await agregado(`${f.nombre} agregado`, nuevas); pintar(); },
          });
        }));
      };
      pintarLista();
      body.querySelector('.search')?.addEventListener('input', (e) => { filtro = e.target.value; pintarLista(); });
      body.querySelector('[data-accion="crear"]')?.addEventListener('click', () =>
        abrirAlimento(ctx, { food: { nombre: filtro }, onListo: pintar }));
    } else if (tab === 'plantillas') {
      const [ps, ayer] = await Promise.all([D.plantillas(), D.entradasDe(C.sumarDias(fecha, -1))]);
      const comidasAyer = D.COMIDAS.map((c) => ({ ...c, xs: ayer.filter((e) => e.comida === c.id) })).filter((c) => c.xs.length);
      body.innerHTML = `
        ${ps.length ? `<ul class="list">${ps.map((r) => {
          const t = C.totales(r.items);
          return `<li><button class="item" data-r="${esc(r.id)}"><span class="item-main"><strong>${esc(r.nombre)}</strong>
            <small>${r.items.length} elementos · ${macrosTxt(t.kcal, t.prot)}</small></span><span class="plus">+</span></button></li>`;
        }).join('')}</ul>` : `<p class="empty">Guarda una comida como plantilla desde la pantalla Hoy (botón ⋯ de cada comida).</p>`}
        ${comidasAyer.length ? `<h3 class="sub">Repetir de ayer</h3><ul class="list">${comidasAyer.map((c) => {
          const t = C.totales(c.xs);
          return `<li><button class="item" data-ayer="${c.id}"><span class="item-main"><strong>${c.nombre} de ayer</strong>
            <small>${c.xs.length} elementos · ${macrosTxt(t.kcal, t.prot)}</small></span><span class="plus">+</span></button></li>`;
        }).join('')}</ul>` : ''}`;
      body.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
        const r = ps.find((x) => x.id === b.dataset.r);
        const antes = new Set((await D.entradasDe(fecha)).map((e) => e.id));
        await D.aplicarPlantilla(r, fecha, comidaSel);
        const nuevas = (await D.entradasDe(fecha)).filter((e) => !antes.has(e.id));
        await agregado(`${r.nombre} agregado`, nuevas);
      }));
      body.querySelectorAll('[data-ayer]').forEach((b) => b.addEventListener('click', async () => {
        const antes = new Set((await D.entradasDe(fecha)).map((e) => e.id));
        await D.copiarEntradas(C.sumarDias(fecha, -1), fecha, b.dataset.ayer, comidaSel);
        const nuevas = (await D.entradasDe(fecha)).filter((e) => !antes.has(e.id));
        await agregado('Copiado de ayer', nuevas);
      }));
    }
  }
  pintar();
  return hoja;
}

// ---------- Entrada rápida ----------
export function abrirRapido(ctx, { fecha, comida, onListo }) {
  abrirHoja(
    `<div class="sheet-head"><h2>Entrada rápida</h2><button class="link" data-cerrar>Cancelar</button></div>
     <form class="stack">
       <label class="field"><span>Nombre</span><input name="nombre" placeholder="Ej. Sándwich de pollo 15 cm" autocomplete="off" /></label>
       <div class="grid2">
         <label class="field"><span>Calorías</span><span class="input-wrap"><input name="kcal" inputmode="numeric" required /><em>kcal</em></span></label>
         <label class="field"><span>Proteína</span><span class="input-wrap"><input name="prot" inputmode="decimal" /><em>g</em></span></label>
       </div>
       <details><summary>Grasa y carbohidratos (opcional)</summary>
         <div class="grid2">
           <label class="field"><span>Grasa</span><span class="input-wrap"><input name="grasa" inputmode="decimal" /><em>g</em></span></label>
           <label class="field"><span>Carbohidratos</span><span class="input-wrap"><input name="carbs" inputmode="decimal" /><em>g</em></span></label>
         </div>
       </details>
       <span class="label">Comida</span>${segComidas(comida)}
       <span class="label">Precisión</span>${segPrecision('restaurante')}
       <label class="check"><input type="checkbox" name="favorito" /><span>★ Guardar como favorito</span></label>
       <p class="error" hidden></p>
       <button class="btn primary block" type="submit">Agregar</button>
     </form>`,
    {
      onMount: (el, h) => {
        const form = el.querySelector('form');
        setTimeout(() => form.kcal.focus(), 250);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const v = leerForm(form);
          const kcal = num(v.kcal), prot = num(v.prot) ?? 0;
          if (!(kcal >= 0) || v.kcal === '') {
            const err = form.querySelector('.error'); err.textContent = 'Escribe las calorías.'; err.hidden = false; return;
          }
          const nombre = v.nombre || 'Entrada rápida';
          let foodId = null;
          if (v.favorito) {
            const f = await D.guardarAlimento({
              nombre, base: 'porcion', porcionNombre: 'porción', kcal, prot,
              grasa: num(v.grasa), carbs: num(v.carbs), estado: 'listo', fuente: 'estimado', favorito: 1, usos: 0,
            });
            foodId = f;
          }
          const nueva = await D.agregarEntrada({
            fecha, comida: v.comida, foodId, nombreSnapshot: nombre, porciones: 1,
            kcal, prot, grasa: num(v.grasa), carbs: num(v.carbs), precision: v.precision,
          });
          h.cerrar();
          await ctx.refrescar();
          aviso(`${nombre} agregado`, { label: 'Deshacer', fn: async () => { await D.borrarEntrada(nueva.id); await ctx.refrescar(); } });
          onListo?.();
        });
      },
    }
  );
}

// ---------- Cantidad de un alimento (con crudo / cocido) ----------
export async function abrirCantidad(ctx, { food, fecha, comida, onListo, onEditado }) {
  const ys = await D.factores();
  const y = food.yieldId ? ys.find((x) => x.id === food.yieldId) : null;
  const porPorcion = food.base === 'porcion';
  const tienePorcion = !porPorcion && food.porcionG;
  const gIni = food.ultimaCantidadG ?? (porPorcion ? null : food.porcionG ?? 100);
  const crudoLbl = food.estado === 'seco' ? 'Seco' : 'Crudo';

  abrirHoja(
    `<div class="sheet-head"><h2>${esc(food.nombre)}</h2><button class="link" data-cerrar>Cancelar</button></div>
     <p class="muted small">${macrosTxt(food.kcal, food.prot)} ${baseTxt(food)} · fuente: ${esc(food.fuente || '—')}${food.nota ? ` · ${esc(food.nota)}` : ''}</p>
     <form class="stack">
       ${porPorcion
         ? `<label class="field"><span>Porciones</span><span class="input-wrap"><input name="porciones" inputmode="decimal" value="${food.ultimasPorciones ?? 1}" /><em>${esc(food.porcionNombre || 'porción')}</em></span></label>`
         : `${tienePorcion ? `<div class="seg small"><label><input type="radio" name="unidad" value="g" checked/><span>Gramos</span></label>
              <label><input type="radio" name="unidad" value="p"/><span>${esc(food.porcionNombre || 'Porciones')}</span></label></div>` : ''}
            <label class="field"><span class="lbl-cant">Cantidad</span><span class="input-wrap"><input name="cantidad" inputmode="decimal" value="${gIni ?? ''}" /><em class="unidad">g</em></span></label>`}
       ${y ? `<span class="label">¿Cómo lo pesaste?</span>
         <div class="seg small"><label><input type="radio" name="estadoPesado" value="crudo" checked/><span>${crudoLbl}</span></label>
         <label><input type="radio" name="estadoPesado" value="cocido"/><span>Cocido</span></label></div>
         <p class="hint conv"></p>` : ''}
       <span class="label">Precisión</span>${segPrecision(porPorcion ? 'etiqueta' : 'pesado')}
       <span class="label">Comida</span>${segComidas(comida)}
       <div class="preview"></div>
       <div class="row gap">
         <button type="button" class="btn ghost" data-fav>${food.favorito ? '★ Favorito' : '☆ Favorito'}</button>
         <button type="button" class="btn ghost" data-editar>Editar alimento</button>
       </div>
       <button class="btn primary block" type="submit">Agregar</button>
     </form>`,
    {
      onMount: (el, h) => {
        const form = el.querySelector('form');
        const prev = el.querySelector('.preview');
        const conv = el.querySelector('.conv');

        function calcular() {
          const v = leerForm(form);
          if (porPorcion) {
            const p = num(v.porciones) ?? 0;
            return { porciones: p, ...C.macrosDeAlimento(food, { porciones: p }) };
          }
          let g = num(v.cantidad) ?? 0;
          if (v.unidad === 'p') g = g * food.porcionG;
          let gCrudos = g, nota = '';
          if (y && v.estadoPesado === 'cocido') {
            gCrudos = C.cocidoACrudo(g, y.factor);
            nota = `≈ ${n0(gCrudos)} g ${crudoLbl.toLowerCase()}s (factor ${y.factor} · ${y.fuente === 'calibrado' ? 'calibrado' : 'referencia'}; cámbialo en Ajustes)`;
          } else if (y) {
            nota = `≈ ${n0(C.crudoACocido(g, y.factor))} g ya cocido`;
          }
          if (conv) conv.textContent = nota;
          return { cantidadG: Math.round(gCrudos), pesadoCocido: y && v.estadoPesado === 'cocido' ? Math.round(g) : null,
                   ...C.macrosDeAlimento(food, { gramos: gCrudos }) };
        }
        function pintar() {
          const r = calcular();
          prev.innerHTML = `<strong>${n0(r.kcal)}</strong> kcal · <strong>${n1(r.prot)}</strong> g proteína`;
        }
        form.addEventListener('input', pintar);
        form.addEventListener('change', (e) => {
          if (e.target.name === 'unidad') {
            const inp = form.cantidad;
            const g = num(inp.value) ?? 0;
            inp.value = e.target.value === 'p' ? +(g / food.porcionG).toFixed(2) : Math.round(g * food.porcionG);
            el.querySelector('.unidad').textContent = e.target.value === 'p' ? (food.porcionNombre || 'porción') : 'g';
          }
          pintar();
        });
        pintar();

        el.querySelector('[data-fav]').addEventListener('click', async (e) => {
          food.favorito = food.favorito ? 0 : 1;
          await D.guardarAlimento(food);
          e.target.textContent = food.favorito ? '★ Favorito' : '☆ Favorito';
        });
        el.querySelector('[data-editar]').addEventListener('click', () =>
          abrirAlimento(ctx, { food, onListo: () => { h.cerrar(); onEditado?.(); } }));

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const r = calcular();
          const v = leerForm(form);
          if (!(r.kcal >= 0) || (!porPorcion && !(r.cantidadG > 0)) || (porPorcion && !(r.porciones > 0))) return;
          const etiqueta = porPorcion ? '' : r.pesadoCocido ? ` · pesado cocido ${r.pesadoCocido} g` : '';
          const nueva = await D.agregarEntrada({
            fecha, comida: v.comida, foodId: food.id, nombreSnapshot: food.nombre + etiqueta,
            cantidadG: porPorcion ? null : r.cantidadG, porciones: porPorcion ? r.porciones : null,
            kcal: r.kcal, prot: r.prot, grasa: r.grasa, carbs: r.carbs, precision: v.precision,
          });
          h.cerrar();
          onListo?.([nueva]);
        });
      },
    }
  );
}

// ---------- Crear / editar alimento ----------
export async function abrirAlimento(ctx, { food = {}, onListo }) {
  const ys = await D.factores();
  const f = { base: '100g', estado: 'listo', fuente: 'etiqueta', ...food };
  const opt = (v, l, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`;
  abrirHoja(
    `<div class="sheet-head"><h2>${f.id ? 'Editar alimento' : 'Nuevo alimento'}</h2><button class="link" data-cerrar>Cancelar</button></div>
     <form class="stack">
       <label class="field"><span>Nombre</span><input name="nombre" value="${esc(f.nombre ?? '')}" required autocomplete="off" /></label>
       <label class="field"><span>Los valores son</span>
         <select name="base">${opt('100g', 'Por 100 g', f.base)}${opt('porcion', 'Por porción', f.base)}</select></label>
       <div class="grid2">
         <label class="field"><span>Porción (nombre)</span><input name="porcionNombre" value="${esc(f.porcionNombre ?? '')}" placeholder="scoop, pieza…" /></label>
         <label class="field"><span>Porción (g)</span><span class="input-wrap"><input name="porcionG" inputmode="decimal" value="${f.porcionG ?? ''}" placeholder="opcional" /><em>g</em></span></label>
         <label class="field"><span>Calorías</span><span class="input-wrap"><input name="kcal" inputmode="decimal" value="${f.kcal ?? ''}" required /><em>kcal</em></span></label>
         <label class="field"><span>Proteína</span><span class="input-wrap"><input name="prot" inputmode="decimal" value="${f.prot ?? ''}" /><em>g</em></span></label>
         <label class="field"><span>Grasa</span><span class="input-wrap"><input name="grasa" inputmode="decimal" value="${f.grasa ?? ''}" /><em>g</em></span></label>
         <label class="field"><span>Carbohidratos</span><span class="input-wrap"><input name="carbs" inputmode="decimal" value="${f.carbs ?? ''}" /><em>g</em></span></label>
       </div>
       <div class="grid2">
         <label class="field"><span>Estado</span><select name="estado">
           ${opt('crudo', 'Crudo', f.estado)}${opt('seco', 'Seco', f.estado)}${opt('cocido', 'Cocido', f.estado)}${opt('listo', 'Listo para comer', f.estado)}</select></label>
         <label class="field"><span>Fuente</span><select name="fuente">
           ${opt('etiqueta', 'Etiqueta', f.fuente)}${opt('usda', 'USDA', f.fuente)}${opt('estimado', 'Estimado', f.fuente)}${opt('off', 'Open Food Facts', f.fuente)}</select></label>
       </div>
       <label class="field"><span>Factor crudo→cocido (si lo pesas cocido)</span><select name="yieldId">
         ${opt('', 'Ninguno', f.yieldId ?? '')}${ys.map((y) => opt(y.id, `${esc(y.nombre)} · ${y.factor}`, f.yieldId ?? '')).join('')}</select></label>
       <p class="error" hidden></p>
       <button class="btn primary block" type="submit">Guardar</button>
       ${f.id && !f.seed ? `<button type="button" class="btn ghost block" data-borrar>Borrar alimento</button>` : ''}
     </form>`,
    {
      onMount: (el, h) => {
        const form = el.querySelector('form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const v = leerForm(form);
          const kcal = num(v.kcal);
          if (!v.nombre || !(kcal >= 0)) {
            const err = form.querySelector('.error'); err.textContent = 'Nombre y calorías son obligatorios.'; err.hidden = false; return;
          }
          await D.guardarAlimento({
            ...f, nombre: v.nombre, base: v.base, porcionNombre: v.porcionNombre || null, porcionG: num(v.porcionG),
            kcal, prot: num(v.prot) ?? 0, grasa: num(v.grasa), carbs: num(v.carbs),
            estado: v.estado, fuente: v.fuente, yieldId: v.yieldId || null,
            favorito: f.favorito ?? 0, usos: f.usos ?? 0,
          });
          h.cerrar();
          aviso('Alimento guardado');
          onListo?.();
        });
        el.querySelector('[data-borrar]')?.addEventListener('click', async () => {
          if (!(await confirmar({ titulo: `¿Borrar «${f.nombre}»?`, texto: 'Tus registros anteriores no cambian.', ok: 'Borrar' }))) return;
          await D.borrarAlimento(f.id);
          h.cerrar();
          onListo?.();
        });
      },
    }
  );
}

// ---------- Editar una entrada ----------
export function abrirEntrada(ctx, e) {
  abrirHoja(
    `<div class="sheet-head"><h2>Editar registro</h2><button class="link" data-cerrar>Cancelar</button></div>
     <form class="stack">
       <label class="field"><span>Nombre</span><input name="nombre" value="${esc(e.nombreSnapshot)}" autocomplete="off" /></label>
       <div class="grid2">
         <label class="field"><span>Calorías</span><span class="input-wrap"><input name="kcal" inputmode="numeric" value="${e.kcal}" /><em>kcal</em></span></label>
         <label class="field"><span>Proteína</span><span class="input-wrap"><input name="prot" inputmode="decimal" value="${e.prot}" /><em>g</em></span></label>
       </div>
       <span class="label">Comida</span>${segComidas(e.comida)}
       <span class="label">Precisión</span>${segPrecision(e.precision)}
       <button class="btn primary block" type="submit">Guardar</button>
       <button type="button" class="btn ghost block" data-borrar>Borrar registro</button>
     </form>`,
    {
      onMount: (el, h) => {
        const form = el.querySelector('form');
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const v = leerForm(form);
          await D.actualizarEntrada({ ...e, nombreSnapshot: v.nombre || e.nombreSnapshot, kcal: Math.round(num(v.kcal) ?? e.kcal),
            prot: num(v.prot) ?? e.prot, comida: v.comida, precision: v.precision });
          h.cerrar();
          await ctx.refrescar();
        });
        el.querySelector('[data-borrar]').addEventListener('click', async () => {
          await D.borrarEntrada(e.id);
          h.cerrar();
          await ctx.refrescar();
          aviso('Registro borrado', { label: 'Deshacer', fn: async () => { await D.actualizarEntrada(e); await ctx.refrescar(); } });
        });
      },
    }
  );
}
