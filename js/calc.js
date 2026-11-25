// calc.js — funciones puras, sin DOM y sin datos personales: todo llega por parámetros.
// Fuente de las fórmulas: especificación del tracker (Hacker's Diet, MacroFactor, Marina de EE. UU.).

export const KCAL_POR_KG = 7700; // aproximación para ventanas de 2–4 semanas (Hall et al., Lancet 2011)
// Margen de error por tipo de registro (regla de diseño propia, no de una guía)
export const MARGEN = { pesado: 0.05, etiqueta: 0.05, estimado: 0.20, restaurante: 0.30 };
export const MODOS = {
  deficitA: 'Déficit A · entreno',
  deficitB: 'Déficit B · descanso',
  mantenimiento: 'Mantenimiento',
  enfermo: 'Enfermo',
};

// ---------- Fechas (siempre en hora local, formato YYYY-MM-DD) ----------
export function isoLocal(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export const diaNum = (f) => Math.round(new Date(f + 'T12:00:00Z').getTime() / 86400000);
export function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function lunesDe(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const diaSemana = (fechaISO) => new Date(fechaISO + 'T12:00:00Z').getUTCDay(); // 0 = domingo

// ---------- Meta y restante del día ----------
export function modoPorDefecto(settings, fechaISO) {
  const dias = settings?.diasEntreno ?? [];
  return dias.includes(diaSemana(fechaISO)) ? 'deficitA' : 'deficitB';
}

export function metaDelDia(settings, dia, tdeeAdaptativo = null) {
  const A = settings.plantillas.A;
  if (dia.modo === 'mantenimiento' || dia.modo === 'enfermo') {
    const kcal = tdeeAdaptativo ?? settings.mantenimientoEstimado;
    return { kcal, prot: A.prot }; // la proteína se conserva
  }
  const p = dia.modo === 'deficitA' ? A : settings.plantillas.B;
  return { kcal: p.kcal, prot: p.prot };
}

export function totales(entradas) {
  return entradas.reduce(
    (t, e) => ({
      kcal: t.kcal + (e.kcal || 0),
      prot: t.prot + (e.prot || 0),
      grasa: t.grasa + (e.grasa || 0),
      carbs: t.carbs + (e.carbs || 0),
    }),
    { kcal: 0, prot: 0, grasa: 0, carbs: 0 }
  );
}

export function restanteDelDia(meta, entradas) {
  let kcal = 0, prot = 0, kMin = 0, kMax = 0;
  for (const e of entradas) {
    const m = MARGEN[e.precision] ?? 0.1;
    kcal += e.kcal; prot += e.prot;
    kMin += e.kcal * (1 - m); kMax += e.kcal * (1 + m);
  }
  return {
    kcal: Math.round(meta.kcal - kcal),
    kcalRango: [Math.round(meta.kcal - kMax), Math.round(meta.kcal - kMin)],
    prot: Math.round(meta.prot - prot),
    consumido: { kcal: Math.round(kcal), prot: Math.round(prot) },
  };
}

// Balance de la semana (lunes a hoy): suma de (meta − consumido) en días de déficit con registros.
// Positivo = por debajo de la meta acumulada. Mantenimiento y Enfermo no cuentan.
export function balanceSemanal(dias) {
  // dias: [{ fecha, modo, metaKcal, kcal, nEntradas }]
  let balance = 0, n = 0;
  for (const d of dias) {
    if (!d.nEntradas || d.modo === 'enfermo' || d.modo === 'mantenimiento') continue;
    balance += d.metaKcal - d.kcal;
    n++;
  }
  return { balance: Math.round(balance), diasContados: n };
}

// ---------- Peso: tendencia, promedio semanal, ritmo ----------
export function tendenciaEMA(pesos, alfa = 0.1) { // pesos ordenados por fecha
  let T = null;
  return pesos.map((p) => {
    T = T === null ? p.kg : T + alfa * (p.kg - T); // días sin pesaje: la tendencia no cambia
    return { ...p, tendencia: +T.toFixed(2) };
  });
}

export function promediosSemanales(pesos, minPesajes = 4) {
  const g = new Map();
  for (const p of pesos) {
    const k = lunesDe(p.fecha);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(p.kg);
  }
  return [...g].map(([semana, xs]) => ({
    semana, n: xs.length, valido: xs.length >= minPesajes,
    promedio: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2),
  }));
}

export function regresion(puntos) { // puntos: [{ x: díaNumérico, y }]
  const n = puntos.length;
  if (n < 2) return null;
  const sx = puntos.reduce((a, p) => a + p.x, 0), sy = puntos.reduce((a, p) => a + p.y, 0);
  const sxx = puntos.reduce((a, p) => a + p.x * p.x, 0), sxy = puntos.reduce((a, p) => a + p.x * p.y, 0);
  const den = n * sxx - sx * sx;
  return den === 0 ? null : { pendiente: (n * sxy - sx * sy) / den };
}

export function ritmoKgSemana(pesos, dias = 14, minPesajes = 8) {
  if (!pesos.length) return null;
  const fin = diaNum(pesos.at(-1).fecha);
  const ventana = pesos
    .filter((p) => fin - diaNum(p.fecha) < dias)
    .map((p) => ({ x: diaNum(p.fecha), y: p.kg }));
  if (ventana.length < minPesajes) return null; // exige ≥8 pesajes en la ventana
  const r = regresion(ventana);
  return r ? +(r.pendiente * 7).toFixed(2) : null; // negativo = pérdida
}

// ---------- % de grasa, método de la Marina (cm) ----------
export function grasaMarinaHombre({ cinturaCm, cuelloCm, estaturaCm }, errorPts = 3.5) {
  const d = cinturaCm - cuelloCm;
  if (!(d > 0) || !(estaturaCm > 0)) return null;
  const den = 1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(estaturaCm);
  const pct = 495 / den - 450;
  return { pct: +pct.toFixed(1), rango: [+(pct - errorPts).toFixed(1), +(pct + errorPts).toFixed(1)] };
}

export function grasaMarinaMujer({ cinturaCm, cuelloCm, caderaCm, estaturaCm }, errorPts = 3.5) {
  const d = cinturaCm + caderaCm - cuelloCm;
  if (!(d > 0) || !(estaturaCm > 0)) return null;
  const den = 1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(estaturaCm);
  const pct = 495 / den - 450;
  return { pct: +pct.toFixed(1), rango: [+(pct - errorPts).toFixed(1), +(pct + errorPts).toFixed(1)] };
}

export function grasaMarina(sexo, medidas) {
  return sexo === 'mujer' ? grasaMarinaMujer(medidas) : grasaMarinaHombre(medidas);
}

// ---------- Gasto adaptativo (estilo MacroFactor) ----------
export function tdeeAdaptativo({ diasRegistro, pesos, ventanaDias = 21 }) {
  // diasRegistro: [{ fecha, kcal, completo, modo }] ordenados por fecha
  const validos = diasRegistro.filter((d) => d.completo && d.modo !== 'enfermo').slice(-ventanaDias);
  if (validos.length < Math.ceil((ventanaDias * 6) / 7)) return null; // ≥6 de 7 días
  const ingesta = validos.reduce((a, d) => a + d.kcal, 0) / validos.length;
  const ritmo = ritmoKgSemana(pesos, ventanaDias);
  if (ritmo === null) return null;
  return Math.round(ingesta - (ritmo / 7) * KCAL_POR_KG); // perder peso => gasto > ingesta
}

// ---------- Regla de ajuste quincenal (propuesta, nunca automática) ----------
export function ajusteQuincenal({ ritmo, pesoTendencia, kcalMeta, tdee, objetivo = [0.4, 0.5],
                                  diasValidos, diasEnfermo, paso = 150 }) {
  if (ritmo === null || diasValidos < 12)
    return { accion: 'mantener', delta: 0, nuevaMeta: kcalMeta, sugeridaPorTdee: null,
             motivo: 'Faltan datos: registra 12 de 14 días y pésate al menos 8 veces.' };
  if (diasEnfermo >= 3)
    return { accion: 'mantener', delta: 0, nuevaMeta: kcalMeta, sugeridaPorTdee: null,
             motivo: 'Quincena con días de enfermedad: no se evalúa.' };
  const perdida = -ritmo, pct = (perdida / pesoTendencia) * 100;
  const [min, max] = objetivo;
  let delta = 0, motivo = `Ritmo ${perdida.toFixed(2)} kg/sem, dentro de lo esperado.`;
  if (perdida < min - 0.1) {
    delta = -paso; motivo = `Ritmo ${perdida.toFixed(2)} kg/sem, por debajo del objetivo.`;
  } else if (perdida > max + 0.25 || pct > 1.0) {
    delta = +paso; motivo = `Ritmo rápido (${pct.toFixed(2)} %/sem): sube kcal para cuidar músculo.`;
  }
  const centro = (min + max) / 2;
  const sugeridaPorTdee = tdee ? Math.round((tdee - (centro * KCAL_POR_KG) / 7) / 25) * 25 : null;
  return { accion: delta ? (delta < 0 ? 'bajar' : 'subir') : 'mantener', delta,
           nuevaMeta: kcalMeta + delta, sugeridaPorTdee, motivo };
}

// ---------- Proyección a meta (rango, nunca un día exacto) ----------
export function proyeccion({ pesoTendencia, grasaPct, errorPts = 3.5, metaPct = [14, 15],
                             ritmoKgSem = [0.4, 0.5], desde = new Date() }) {
  const pesoMeta = (g, meta) => (pesoTendencia * (1 - g / 100)) / (1 - meta / 100);
  const kgMin = Math.max(0, pesoTendencia - pesoMeta(grasaPct - errorPts, metaPct[1]));
  const kgMax = Math.max(0, pesoTendencia - pesoMeta(grasaPct + errorPts, metaPct[0]));
  const semMin = kgMin / ritmoKgSem[1], semMax = kgMax / ritmoKgSem[0];
  const fecha = (s) => isoLocal(new Date(desde.getTime() + s * 7 * 86400000));
  return {
    kgPorPerder: [+kgMin.toFixed(1), +kgMax.toFixed(1)],
    semanas: [Math.round(semMin), Math.round(semMax)],
    fechas: [fecha(semMin), fecha(semMax)],
    supuestos: `Conserva masa magra; ritmo constante; error de la Marina ±${errorPts} pts.`,
  };
}

// ---------- Conversor crudo ↔ cocido ----------
// factor = peso cocido / peso crudo (pollo ~0.72–0.77; arroz ~2.5–3.0; pasta ~2.2–2.5; calibra el tuyo)
export const crudoACocido = (g, factor) => Math.round(g * factor);
export const cocidoACrudo = (g, factor) => Math.round(g / factor);
export function macrosDesdeCocido(gCocidos, alimentoCrudoPor100, factor) {
  const gCrudos = gCocidos / factor;
  const k = gCrudos / 100;
  return { gCrudos: Math.round(gCrudos), kcal: Math.round(alimentoCrudoPor100.kcal * k),
           prot: +(alimentoCrudoPor100.prot * k).toFixed(1) };
}
export const calibrarFactor = (gCrudo, gCocido) => +(gCocido / gCrudo).toFixed(2);

// ---------- Macros de un alimento según cantidad ----------
// food.base = '100g' (valores por 100 g) o 'porcion' (valores por porción; porcionG opcional)
export function macrosDeAlimento(food, { gramos = null, porciones = null } = {}) {
  let k;
  if (food.base === 'porcion') {
    if (porciones != null) k = porciones;
    else if (gramos != null && food.porcionG) k = gramos / food.porcionG;
    else k = 1;
  } else {
    k = (gramos ?? 100) / 100;
  }
  const r = (v) => (v == null ? undefined : +(v * k).toFixed(1));
  return { kcal: Math.round(food.kcal * k), prot: r(food.prot), grasa: r(food.grasa), carbs: r(food.carbs) };
}
