// db.js — envoltorio mínimo de IndexedDB, sin dependencias.
// Todos los datos personales viven aquí, dentro del dispositivo. Nada se envía a ningún servidor.

export const DB_NAME = 'tracker';
export const SCHEMA_VERSION = 1;

// store -> { keyPath, indices }
const STORES = {
  settings: { keyPath: 'id' },                       // un solo registro, id = 'me'
  foods: { keyPath: 'id', indices: ['nombre', 'favorito'] },
  recipes: { keyPath: 'id' },                        // comidas guardadas / plantillas
  entries: { keyPath: 'id', indices: ['fecha'] },
  days: { keyPath: 'fecha' },
  weights: { keyPath: 'fecha' },
  measures: { keyPath: 'fecha' },
  yields: { keyPath: 'id' },                         // factores de cocción
  meta: { keyPath: 'clave' },
};
export const STORE_NAMES = Object.keys(STORES);

let dbPromise = null;

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // Migraciones por versión: cada bloque solo agrega, nunca borra datos.
      if (ev.oldVersion < 1) {
        for (const [name, def] of Object.entries(STORES)) {
          const s = db.createObjectStore(name, { keyPath: def.keyPath });
          for (const idx of def.indices ?? []) s.createIndex(idx, idx);
        }
      }
      // if (ev.oldVersion < 2) { ... futuras migraciones ... }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('La base de datos está abierta en otra pestaña.'));
  });
  return dbPromise;
}

const prom = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let out;
    Promise.resolve(fn(t.objectStore(store))).then((v) => { out = v; }, reject);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const get = (store, key) => tx(store, 'readonly', (s) => prom(s.get(key)));
export const getAll = (store) => tx(store, 'readonly', (s) => prom(s.getAll()));
export const put = (store, value) => tx(store, 'readwrite', (s) => prom(s.put(value)));
export const del = (store, key) => tx(store, 'readwrite', (s) => prom(s.delete(key)));
export const count = (store) => tx(store, 'readonly', (s) => prom(s.count()));
export const clear = (store) => tx(store, 'readwrite', (s) => prom(s.clear()));

export const putMany = (store, values) =>
  tx(store, 'readwrite', (s) => Promise.all(values.map((v) => prom(s.put(v)))));

export const getAllByIndex = (store, index, query) =>
  tx(store, 'readonly', (s) => prom(s.index(index).getAll(query)));

export const getRange = (store, lower, upper) =>
  tx(store, 'readonly', (s) => prom(s.getAll(IDBKeyRange.bound(lower, upper))));

export async function getMeta(clave, porDefecto = null) {
  const r = await get('meta', clave);
  return r ? r.valor : porDefecto;
}
export const setMeta = (clave, valor) => put('meta', { clave, valor });

// Volcado completo para respaldo
export async function dumpAll() {
  const out = {};
  for (const name of STORE_NAMES) out[name] = await getAll(name);
  return out;
}

// Restaura fusionando por clave (id / fecha / clave). No borra lo que no viene en el respaldo.
export async function restore(data) {
  const resumen = {};
  for (const name of STORE_NAMES) {
    const filas = Array.isArray(data[name]) ? data[name] : [];
    if (filas.length) await putMany(name, filas);
    resumen[name] = filas.length;
  }
  return resumen;
}

export async function borrarTodo() {
  for (const name of STORE_NAMES) await clear(name);
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
