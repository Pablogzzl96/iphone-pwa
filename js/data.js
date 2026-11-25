// data.js — operaciones de la app sobre la base local (consultas y escrituras con reglas de negocio).
import * as db from './db.js';
import * as C from './calc.js';
import { FOODS, YIELDS, SEED_VERSION } from './seed.js';

export const COMIDAS = [
  { id: 'desayuno', nombre: 'Desayuno' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'snack', nombre: 'Snack' },
  { id: 'cena', nombre: 'Cena' },
];
export const PRECISIONES = [
  { id: 'pesado', nombre: 'Pesado' },
  { id: 'etiqueta', nombre: 'Etiqueta' },
  { id: 'estimado', nombre: 'A ojo' },
  { id: 'restaurante', nombre: 'Restaurante' },
];

export function comidaPorHora(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? 'desayuno' : h < 16 ? 'comida' : h < 19 ? 'snack' : 'cena';
}

// ---------- Inicio ----------
export async function sembrar() {
  const v = await db.getMeta('seedVersion', 0);
  if (v >= SEED_VERSION) return;
  const ahora = new Date().toISOString();
  for (const y of YIELDS) if (!(await db.get('yields', y.id))) await db.put('yields', y);
  for (const f of FOODS)
    if (!(await db.get('foods', f.id)))
      await db.put('foods', { ...f, favorito: 0, usos: 0, actualizadoEn: ahora });
  await db.setMeta('seedVersion', SEED_VERSION);
  if (!(await db.getMeta('schemaVersion'))) await db.setMeta('schemaVersion', db.SCHEMA_VERSION);
}

// Migra la «nota rápida» de la versión anterior (localStorage) a la nota del día
export async function migrarNotaAntigua() {
  try {
    if (await db.getMeta('notaMigrada')) return;
    const nota = localStorage.getItem('iphone-pwa:note');
    if (nota && nota.trim()) {
      const hoy = C.isoLocal();
      const dia = (await db.get('days', hoy)) ?? { fecha: hoy, modo: null, completo: false };
      dia.nota = [dia.nota, nota.trim()].filter(Boolean).join('\n');
      await db.put('days', dia);
    }
    await db.setMeta('notaMigrada', true);
  } catch (_) { /* sin localStorage: nada que migrar */ }
}

// ---------- Ajustes ----------
export const getSettings = () => db.get('settings', 'me');
export const saveSettings = (s) => db.put('settings', { ...s, id: 'me' });

// ---------- Días ----------
export async function getDia(fecha, settings) {
  const d = await db.get('days', fecha);
  return { fecha, completo: false, nota: '', ...d, modo: d?.modo || C.modoPorDefecto(settings, fecha) };
}
export async function guardarDia(dia) { await db.put('days', dia); }

// ---------- Entradas ----------
export async function entradasDe(fecha) {
  const xs = await db.getAllByIndex('entries', 'fecha', fecha);
  return xs.sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1));
}

export async function agregarEntrada(e) {
  const entrada = {
    id: db.uid(), hora: new Date().toTimeString().slice(0, 5), creadoEn: new Date().toISOString(),
    precision: 'pesado', ...e,
    kcal: Math.round(e.kcal || 0), prot: +(+e.prot || 0).toFixed(1),
  };
  await db.put('entries', entrada);
  if (entrada.foodId) {
    const f = await db.get('foods', entrada.foodId);
    if (f) {
      f.usos = (f.usos || 0) + 1;
      if (entrada.cantidadG) f.ultimaCantidadG = entrada.cantidadG;
      if (entrada.porciones) f.ultimasPorciones = entrada.porciones;
      f.actualizadoEn = entrada.creadoEn;
      await db.put('foods', f);
    }
  }
  return entrada;
}
export const actualizarEntrada = (e) => db.put('entries', e);
export const borrarEntrada = (id) => db.del('entries', id);

// Recientes: entradas distintas de los últimos 30 días (por nombre + kcal), la más nueva primero
export async function recientes(limite = 20) {
  const hasta = C.isoLocal();
  const desde = C.sumarDias(hasta, -30);
  const xs = await db.getAllByIndex('entries', 'fecha', IDBKeyRange.bound(desde, hasta));
  xs.sort((a, b) => (a.creadoEn > b.creadoEn ? -1 : 1));
  const vistos = new Set(), out = [];
  for (const e of xs) {
    const k = `${e.nombreSnapshot}|${e.kcal}`;
    if (vistos.has(k)) continue;
    vistos.add(k); out.push(e);
    if (out.length >= limite) break;
  }
  return out;
}

// Copia entradas de un día (o una comida) a otro día
export async function copiarEntradas(origen, destino, comida = null, comidaDestino = null) {
  const xs = (await entradasDe(origen)).filter((e) => !comida || e.comida === comida);
  for (const e of xs) {
    const { id, creadoEn, hora, fecha, ...resto } = e;
    await agregarEntrada({ ...resto, fecha: destino, comida: comidaDestino ?? e.comida });
  }
  return xs.length;
}

// ---------- Alimentos ----------
export async function alimentos() {
  const xs = await db.getAll('foods');
  return xs.sort((a, b) => (b.usos || 0) - (a.usos || 0) || a.nombre.localeCompare(b.nombre, 'es'));
}
export const guardarAlimento = (f) => db.put('foods', { ...f, id: f.id || db.uid(), actualizadoEn: new Date().toISOString() });
export const borrarAlimento = (id) => db.del('foods', id);
export const factores = async () => (await db.getAll('yields')).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
export const guardarFactor = (y) => db.put('yields', y);

// ---------- Plantillas (comidas guardadas) ----------
export const plantillas = async () => (await db.getAll('recipes')).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
export async function guardarComoPlantilla(nombre, entradas) {
  const items = entradas.map((e) => ({
    foodId: e.foodId ?? null, nombre: e.nombreSnapshot, cantidadG: e.cantidadG ?? null, porciones: e.porciones ?? null,
    kcal: e.kcal, prot: e.prot, grasa: e.grasa ?? null, carbs: e.carbs ?? null, precision: e.precision,
  }));
  const r = { id: db.uid(), nombre, items, favorito: 1, creadoEn: new Date().toISOString() };
  await db.put('recipes', r);
  return r;
}
export async function aplicarPlantilla(r, fecha, comida) {
  for (const it of r.items)
    await agregarEntrada({
      fecha, comida, foodId: it.foodId, nombreSnapshot: it.nombre, cantidadG: it.cantidadG, porciones: it.porciones,
      kcal: it.kcal, prot: it.prot, grasa: it.grasa, carbs: it.carbs, precision: it.precision,
    });
  return r.items.length;
}
export const borrarPlantilla = (id) => db.del('recipes', id);
export const guardarPlantilla = (r) => db.put('recipes', r);

// ---------- Peso y medidas ----------
export const pesos = async () => (await db.getAll('weights')).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
export const guardarPeso = (p) => db.put('weights', p);
export const borrarPeso = (fecha) => db.del('weights', fecha);
export const medidas = async () => (await db.getAll('measures')).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
export const guardarMedida = (m) => db.put('measures', m);
export const borrarMedida = (fecha) => db.del('measures', fecha);

// ---------- Resúmenes ----------
export async function resumenDia(fecha, settings, tdee = null) {
  const [dia, entradas] = await Promise.all([getDia(fecha, settings), entradasDe(fecha)]);
  const meta = C.metaDelDia(settings, dia, tdee);
  return { dia, entradas, meta, restante: C.restanteDelDia(meta, entradas), tot: C.totales(entradas) };
}

// Resumen por día de un rango [desde, hasta] (incluye días vacíos)
export async function resumenRango(desde, hasta, settings, tdee = null) {
  const [entradas, diasGuardados] = await Promise.all([
    db.getAllByIndex('entries', 'fecha', IDBKeyRange.bound(desde, hasta)),
    db.getRange('days', desde, hasta),
  ]);
  const porFecha = new Map();
  for (const e of entradas) {
    if (!porFecha.has(e.fecha)) porFecha.set(e.fecha, []);
    porFecha.get(e.fecha).push(e);
  }
  const diasMap = new Map(diasGuardados.map((d) => [d.fecha, d]));
  const out = [];
  for (let f = desde; f <= hasta; f = C.sumarDias(f, 1)) {
    const guardado = diasMap.get(f);
    const dia = { fecha: f, completo: false, ...guardado, modo: guardado?.modo || C.modoPorDefecto(settings, f) };
    const xs = porFecha.get(f) ?? [];
    const t = C.totales(xs);
    out.push({
      fecha: f, modo: dia.modo, completo: !!dia.completo, nEntradas: xs.length,
      metaKcal: C.metaDelDia(settings, dia, tdee).kcal, kcal: Math.round(t.kcal), prot: Math.round(t.prot),
      grasa: Math.round(t.grasa), carbs: Math.round(t.carbs),
    });
  }
  return out;
}

// Gasto adaptativo con los últimos 21 días (sin contar hoy, que suele estar incompleto)
export async function gastoAdaptativo(settings) {
  const ayer = C.sumarDias(C.isoLocal(), -1);
  const dias = await resumenRango(C.sumarDias(ayer, -20), ayer, settings);
  const ps = await pesos();
  const ventana = ps.filter((p) => p.fecha <= ayer && p.fecha >= C.sumarDias(ayer, -20));
  return {
    tdee: C.tdeeAdaptativo({ diasRegistro: dias, pesos: ventana }),
    diasCompletos: dias.filter((d) => d.completo && d.modo !== 'enfermo').length,
    pesajes: ventana.length,
  };
}

export async function semana(fechaRef, settings) {
  const lunes = C.lunesDe(fechaRef);
  const hasta = fechaRef;
  return C.balanceSemanal(await resumenRango(lunes, hasta, settings));
}
