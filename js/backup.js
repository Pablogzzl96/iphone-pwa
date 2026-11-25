// backup.js — respaldo sin backend: exportar JSON (formato maestro) y CSV (Power BI / Python),
// importar con validación y fusión, y pedir almacenamiento persistente.
import * as db from './db.js';
import * as C from './calc.js';
import * as D from './data.js';

const hoy = () => C.isoLocal();

// Construye los archivos por adelantado: en iOS, navigator.share() debe llamarse dentro del toque
// del usuario, así que el archivo ya debe existir cuando se toca el botón.
export async function prepararJSON() {
  const data = { app: 'tracker', schemaVersion: db.SCHEMA_VERSION, exportadoEn: new Date().toISOString(), ...(await db.dumpAll()) };
  data.meta = data.meta.filter((m) => m.clave !== 'respaldoPrevioImport'); // no anidar respaldos
  return new File([JSON.stringify(data)], `tracker-${hoy()}.json`, { type: 'application/json' });
}

const csvCelda = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (filas, cols) => '﻿' + [cols.join(','), ...filas.map((f) => cols.map((c) => csvCelda(f[c])).join(','))].join('\n');

export async function prepararCSVComidas() {
  const xs = (await db.getAll('entries')).sort((a, b) => (a.fecha + a.creadoEn < b.fecha + b.creadoEn ? -1 : 1));
  const filas = xs.map((e) => ({
    fecha: e.fecha, hora: e.hora, comida: e.comida, nombre: e.nombreSnapshot, cantidad_g: e.cantidadG, porciones: e.porciones,
    kcal: e.kcal, prot: e.prot, grasa: e.grasa, carbs: e.carbs, precision: e.precision,
  }));
  const cols = ['fecha', 'hora', 'comida', 'nombre', 'cantidad_g', 'porciones', 'kcal', 'prot', 'grasa', 'carbs', 'precision'];
  return new File([csv(filas, cols)], `tracker-comidas-${hoy()}.csv`, { type: 'text/csv' });
}

export async function prepararCSVDiario(settings) {
  const [entries, ps, ms] = await Promise.all([db.getAll('entries'), D.pesos(), D.medidas()]);
  const fechas = [...entries.map((e) => e.fecha), ...ps.map((p) => p.fecha), ...ms.map((m) => m.fecha)].sort();
  const cols = ['fecha', 'modo', 'completo', 'meta_kcal', 'kcal', 'prot', 'grasa', 'carbs', 'n_registros',
                'peso_kg', 'tendencia_kg', 'cintura_cm', 'cuello_cm', 'grasa_pct'];
  if (!fechas.length) return new File([csv([], cols)], `tracker-diario-${hoy()}.csv`, { type: 'text/csv' });
  const dias = await D.resumenRango(fechas[0], hoy(), settings);
  const tend = new Map(C.tendenciaEMA(ps).map((p) => [p.fecha, p]));
  const med = new Map(ms.map((m) => [m.fecha, m]));
  const filas = dias.map((d) => ({
    fecha: d.fecha, modo: d.modo, completo: d.completo ? 1 : 0, meta_kcal: d.metaKcal, kcal: d.kcal, prot: d.prot,
    grasa: d.grasa, carbs: d.carbs, n_registros: d.nEntradas,
    peso_kg: tend.get(d.fecha)?.kg, tendencia_kg: tend.get(d.fecha)?.tendencia,
    cintura_cm: med.get(d.fecha)?.cinturaCm, cuello_cm: med.get(d.fecha)?.cuelloCm, grasa_pct: med.get(d.fecha)?.grasaPct,
  }));
  return new File([csv(filas, cols)], `tracker-diario-${hoy()}.csv`, { type: 'text/csv' });
}

// Comparte (hoja de iOS → Guardar en Archivos) o descarga. Devuelve true si se entregó.
export async function entregar(file, titulo) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // el usuario canceló
      // otro error (p. ej. permiso): cae a descarga
    }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

export async function marcarRespaldo() {
  await db.setMeta('ultimoRespaldo', new Date().toISOString());
}

// Importa un respaldo JSON fusionando por id / fecha / clave
export async function importarJSON(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (_) { throw new Error('El archivo no es un JSON válido.'); }
  if (data?.app !== 'tracker') throw new Error('Este archivo no es un respaldo del tracker.');
  if (!(data.schemaVersion <= db.SCHEMA_VERSION)) throw new Error('El respaldo es de una versión más nueva de la app. Actualízala primero.');
  // Respaldo automático del estado actual antes de fusionar
  await db.setMeta('respaldoPrevioImport', { fecha: new Date().toISOString(), datos: await db.dumpAll() });
  const { meta, ...resto } = data;
  const metaUtil = (meta ?? []).filter((m) => !['respaldoPrevioImport'].includes(m.clave));
  return db.restore({ ...resto, meta: metaUtil });
}

export async function pedirPersistencia() {
  if (!navigator.storage?.persisted) return null;
  const ya = await navigator.storage.persisted();
  const r = ya || (await navigator.storage.persist?.()) || false;
  await db.setMeta('persisted', r);
  return r;
}

export async function estadoAlmacenamiento() {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  return { persisted, usoMB: est ? est.usage / 1048576 : null, cuotaMB: est ? est.quota / 1048576 : null };
}
