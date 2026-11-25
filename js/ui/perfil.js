// perfil.js — asistente inicial y edición de perfil y metas.
// Todo lo que se captura aquí se guarda solo en el dispositivo.
import { esc, num, leerForm } from './dom.js';
import * as D from '../data.js';

const DIAS = [
  { v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'M' }, { v: 4, l: 'J' }, { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' },
];

const campo = (name, label, valor, { tipo = 'decimal', sufijo = '', req = true, ph = '' } = {}) => `
  <label class="field">
    <span>${label}</span>
    <span class="input-wrap">
      <input name="${name}" inputmode="${tipo}" value="${valor ?? ''}" placeholder="${ph}" ${req ? 'required' : ''} autocomplete="off" />
      ${sufijo ? `<em>${sufijo}</em>` : ''}
    </span>
  </label>`;

export function formPerfil(s = {}) {
  const A = s.plantillas?.A ?? {}, B = s.plantillas?.B ?? {};
  const dias = s.diasEntreno ?? [];
  return `
  <form class="perfil" novalidate>
    <fieldset>
      <legend>Tú</legend>
      <div class="seg" role="radiogroup">
        <label><input type="radio" name="sexo" value="hombre" ${s.sexo !== 'mujer' ? 'checked' : ''}/><span>Hombre</span></label>
        <label><input type="radio" name="sexo" value="mujer" ${s.sexo === 'mujer' ? 'checked' : ''}/><span>Mujer</span></label>
      </div>
      ${campo('estaturaCm', 'Estatura', s.estaturaCm, { sufijo: 'cm' })}
      ${campo('mantenimientoEstimado', 'Mantenimiento estimado', s.mantenimientoEstimado, { tipo: 'numeric', sufijo: 'kcal' })}
      <p class="hint">Se usa en días de Mantenimiento o Enfermo hasta que la app calcule tu gasto real con tus datos.</p>
    </fieldset>

    <fieldset>
      <legend>Meta · Plantilla A (entreno)</legend>
      <div class="grid2">
        ${campo('A_kcal', 'Calorías', A.kcal, { tipo: 'numeric', sufijo: 'kcal' })}
        ${campo('A_prot', 'Proteína', A.prot, { tipo: 'numeric', sufijo: 'g' })}
        ${campo('A_grasa', 'Grasa', A.grasa, { tipo: 'numeric', sufijo: 'g', req: false, ph: 'opcional' })}
        ${campo('A_carbs', 'Carbohidratos', A.carbs, { tipo: 'numeric', sufijo: 'g', req: false, ph: 'opcional' })}
      </div>
    </fieldset>

    <fieldset>
      <legend>Meta · Plantilla B (descanso)</legend>
      <div class="grid2">
        ${campo('B_kcal', 'Calorías', B.kcal, { tipo: 'numeric', sufijo: 'kcal' })}
        ${campo('B_prot', 'Proteína', B.prot, { tipo: 'numeric', sufijo: 'g' })}
        ${campo('B_grasa', 'Grasa', B.grasa, { tipo: 'numeric', sufijo: 'g', req: false, ph: 'opcional' })}
        ${campo('B_carbs', 'Carbohidratos', B.carbs, { tipo: 'numeric', sufijo: 'g', req: false, ph: 'opcional' })}
      </div>
    </fieldset>

    <fieldset>
      <legend>Días de entreno</legend>
      <p class="hint">Esos días arrancan en Plantilla A; el resto en B. Puedes cambiar el modo de cualquier día.</p>
      <div class="dias">
        ${DIAS.map((d) => `<label><input type="checkbox" name="dia_${d.v}" ${dias.includes(d.v) ? 'checked' : ''}/><span>${d.l}</span></label>`).join('')}
      </div>
    </fieldset>

    <fieldset>
      <legend>Ritmo y meta</legend>
      <div class="grid2">
        ${campo('ritmoMin', 'Ritmo mínimo', s.ritmoObjetivoKgSem?.[0], { sufijo: 'kg/sem' })}
        ${campo('ritmoMax', 'Ritmo máximo', s.ritmoObjetivoKgSem?.[1], { sufijo: 'kg/sem' })}
        ${campo('grasaMin', 'Meta de grasa mín.', s.metaGrasaPct?.[0], { sufijo: '%', req: false, ph: 'opcional' })}
        ${campo('grasaMax', 'Meta de grasa máx.', s.metaGrasaPct?.[1], { sufijo: '%', req: false, ph: 'opcional' })}
      </div>
      <p class="hint">La meta de % de grasa solo se usa para la proyección en Progreso.</p>
    </fieldset>

    <p class="error" hidden></p>
    <button class="btn primary block" type="submit">Guardar</button>
  </form>`;
}

// Valida y convierte el formulario en settings. Devuelve { settings } o { error }.
export function leerPerfil(form, previo = {}) {
  const v = leerForm(form);
  const req = {
    estaturaCm: num(v.estaturaCm), mantenimientoEstimado: num(v.mantenimientoEstimado),
    A_kcal: num(v.A_kcal), A_prot: num(v.A_prot), B_kcal: num(v.B_kcal), B_prot: num(v.B_prot),
    ritmoMin: num(v.ritmoMin), ritmoMax: num(v.ritmoMax),
  };
  const faltan = Object.entries(req).filter(([, x]) => !(x > 0)).map(([k]) => k);
  if (faltan.length) return { error: 'Completa los campos obligatorios con números mayores que cero.', faltan };
  if (req.ritmoMin > req.ritmoMax) return { error: 'El ritmo mínimo no puede ser mayor que el máximo.', faltan: ['ritmoMin'] };
  if (req.estaturaCm < 100 || req.estaturaCm > 250) return { error: 'Escribe la estatura en centímetros.', faltan: ['estaturaCm'] };
  const gMin = num(v.grasaMin), gMax = num(v.grasaMax);
  const plant = (p) => ({ kcal: req[`${p}_kcal`], prot: req[`${p}_prot`], grasa: num(v[`${p}_grasa`]), carbs: num(v[`${p}_carbs`]) });
  return {
    settings: {
      ...previo,
      sexo: v.sexo === 'mujer' ? 'mujer' : 'hombre',
      estaturaCm: req.estaturaCm,
      mantenimientoEstimado: Math.round(req.mantenimientoEstimado),
      plantillas: { A: plant('A'), B: plant('B') },
      diasEntreno: [0, 1, 2, 3, 4, 5, 6].filter((d) => v[`dia_${d}`]),
      ritmoObjetivoKgSem: [req.ritmoMin, req.ritmoMax],
      metaGrasaPct: gMin > 0 && gMax > 0 ? [Math.min(gMin, gMax), Math.max(gMin, gMax)] : null,
      creadoEn: previo.creadoEn ?? new Date().toISOString(),
    },
  };
}

export function montarFormPerfil(root, previo, onGuardado) {
  const form = root.querySelector('form.perfil');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = leerPerfil(form, previo);
    const err = form.querySelector('.error');
    form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
    if (r.error) {
      err.textContent = r.error; err.hidden = false;
      for (const k of r.faltan ?? []) form.querySelector(`[name="${k}"]`)?.closest('.field')?.classList.add('invalid');
      form.querySelector('.invalid input')?.focus();
      return;
    }
    err.hidden = true;
    await D.saveSettings(r.settings);
    onGuardado(r.settings);
  });
}

export function renderOnboarding(view, onListo) {
  view.innerHTML = `
    <section class="screen onboarding">
      <header class="screen-head"><p class="eyebrow">Bienvenido</p><h1>Configura tu tracker</h1></header>
      <div class="card soft">
        <p>Tus datos se guardan <strong>solo en este iPhone</strong>. No hay cuentas ni servidores, y nada de esto se escribe en el repositorio público.</p>
        <p class="muted">Puedes cambiar todo después en Ajustes.</p>
      </div>
      ${formPerfil({})}
    </section>`;
  montarFormPerfil(view, {}, onListo);
}

export { esc };
