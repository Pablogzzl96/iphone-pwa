// Pruebas de calc.js. Corre en Node (`node tests/calc.test.js`) o abriendo tests/calc.test.html.
import * as C from '../js/calc.js';

const resultados = [];
function ok(cond, nombre) { resultados.push({ ok: !!cond, nombre }); }
const cerca = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

// Marina (hombre): 180 cm, cuello 38, cintura 90 ≈ 19.8 %
const m = C.grasaMarinaHombre({ cinturaCm: 90, cuelloCm: 38, estaturaCm: 180 });
ok(cerca(m.pct, 19.8, 0.15), `Marina 180/38/90 ≈ 19.8 (dio ${m.pct})`);
ok(cerca(m.rango[1] - m.rango[0], 7, 0.11), 'Banda de ±3.5 puntos');
ok(C.grasaMarinaHombre({ cinturaCm: 30, cuelloCm: 38, estaturaCm: 180 }) === null, 'Marina rechaza cintura ≤ cuello');

// Restante del día con márgenes
const meta = { kcal: 2000, prot: 150 };
const r = C.restanteDelDia(meta, [
  { kcal: 500, prot: 40, precision: 'pesado' },
  { kcal: 800, prot: 30, precision: 'restaurante' },
]);
ok(r.kcal === 700 && r.prot === 80, `Restante 700 kcal / 80 g (dio ${r.kcal}/${r.prot})`);
ok(r.kcalRango[0] === 2000 - (525 + 1040) && r.kcalRango[1] === 2000 - (475 + 560), `Rango ${r.kcalRango}`);

// Meta del día según modo
const settings = { mantenimientoEstimado: 2800, plantillas: { A: { kcal: 2300, prot: 160 }, B: { kcal: 2100, prot: 160 } } };
ok(C.metaDelDia(settings, { modo: 'deficitA' }).kcal === 2300, 'Meta A');
ok(C.metaDelDia(settings, { modo: 'deficitB' }).kcal === 2100, 'Meta B');
ok(C.metaDelDia(settings, { modo: 'enfermo' }).kcal === 2800, 'Enfermo = mantenimiento');
ok(C.metaDelDia(settings, { modo: 'mantenimiento' }, 2650).kcal === 2650, 'Mantenimiento usa TDEE adaptativo');

// EMA
const ema = C.tendenciaEMA([{ fecha: '2026-01-01', kg: 80 }, { fecha: '2026-01-02', kg: 81 }]);
ok(ema[0].tendencia === 80 && ema[1].tendencia === 80.1, 'EMA 10 %');

// Fechas
ok(C.lunesDe('2026-11-25') === '2026-11-23', 'Lunes de miércoles 25-nov-2026');
ok(C.lunesDe('2026-11-29') === '2026-11-23', 'Lunes de domingo');
ok(C.sumarDias('2026-12-31', 1) === '2027-01-01', 'Sumar días cruza año');

// Ritmo con datos sintéticos: −0.5 kg/sem exacto
const pesos = Array.from({ length: 14 }, (_, i) => ({ fecha: C.sumarDias('2026-11-01', i), kg: 85 - (0.5 / 7) * i }));
ok(cerca(C.ritmoKgSemana(pesos), -0.5, 0.01), `Ritmo −0.5 kg/sem (dio ${C.ritmoKgSemana(pesos)})`);
ok(C.ritmoKgSemana(pesos.slice(0, 5)) === null, 'Ritmo exige ≥ 8 pesajes');

// Promedios semanales
const sem = C.promediosSemanales(pesos);
ok(sem.length >= 2 && sem.every((s) => s.promedio > 0), 'Promedios semanales');

// TDEE adaptativo: ingesta 2200 y −0.5 kg/sem → 2200 + 550 = 2750
const pesos21 = Array.from({ length: 21 }, (_, i) => ({ fecha: C.sumarDias('2026-11-01', i), kg: 85 - (0.5 / 7) * i }));
const dias21 = pesos21.map((p) => ({ fecha: p.fecha, kcal: 2200, completo: true, modo: 'deficitB' }));
const tdee = C.tdeeAdaptativo({ diasRegistro: dias21, pesos: pesos21 });
ok(cerca(tdee, 2750, 2), `TDEE adaptativo ≈ 2750 (dio ${tdee})`);
ok(C.tdeeAdaptativo({ diasRegistro: dias21.slice(0, 10), pesos: pesos21 }) === null, 'TDEE exige 6 de 7 días');

// Ajuste quincenal
const a1 = C.ajusteQuincenal({ ritmo: -0.2, pesoTendencia: 85, kcalMeta: 2200, tdee: null, diasValidos: 13, diasEnfermo: 0 });
ok(a1.accion === 'bajar' && a1.delta === -150, 'Ritmo lento → bajar 150');
const a2 = C.ajusteQuincenal({ ritmo: -0.45, pesoTendencia: 85, kcalMeta: 2200, tdee: null, diasValidos: 13, diasEnfermo: 0 });
ok(a2.accion === 'mantener', 'Ritmo en objetivo → mantener');
const a3 = C.ajusteQuincenal({ ritmo: -1.0, pesoTendencia: 85, kcalMeta: 2200, tdee: null, diasValidos: 13, diasEnfermo: 0 });
ok(a3.accion === 'subir', 'Ritmo rápido → subir');
const a4 = C.ajusteQuincenal({ ritmo: -0.2, pesoTendencia: 85, kcalMeta: 2200, tdee: null, diasValidos: 13, diasEnfermo: 3 });
ok(a4.accion === 'mantener', 'Quincena con enfermedad no se evalúa');

// Proyección: siempre rango con mín ≤ máx
const p = C.proyeccion({ pesoTendencia: 85, grasaPct: 22, ritmoKgSem: [0.4, 0.5], desde: new Date('2026-11-25T12:00:00') });
ok(p.kgPorPerder[0] <= p.kgPorPerder[1] && p.semanas[0] <= p.semanas[1], `Proyección en rango ${p.kgPorPerder}`);

// Conversor
ok(C.cocidoACrudo(144, 0.72) === 200 && C.crudoACocido(200, 0.72) === 144, 'Crudo ↔ cocido');
ok(C.calibrarFactor(200, 540) === 2.7, 'Calibrar factor');
const mc = C.macrosDesdeCocido(144, { kcal: 120, prot: 22.5 }, 0.72);
ok(mc.gCrudos === 200 && mc.kcal === 240 && mc.prot === 45, 'Macros desde cocido (200 g crudos de pechuga)');

// Macros por cantidad
ok(C.macrosDeAlimento({ base: '100g', kcal: 120, prot: 22.5 }, { gramos: 200 }).kcal === 240, 'Macros por gramos');
ok(C.macrosDeAlimento({ base: 'porcion', porcionG: 33, kcal: 120, prot: 27 }, { porciones: 2 }).prot === 54, 'Macros por porción');

// Balance semanal: enfermo y mantenimiento no cuentan
const b = C.balanceSemanal([
  { fecha: 'a', modo: 'deficitA', metaKcal: 2300, kcal: 2000, nEntradas: 3 },
  { fecha: 'b', modo: 'deficitB', metaKcal: 2100, kcal: 2400, nEntradas: 3 },
  { fecha: 'c', modo: 'enfermo', metaKcal: 2800, kcal: 1000, nEntradas: 1 },
  { fecha: 'd', modo: 'deficitB', metaKcal: 2100, kcal: 0, nEntradas: 0 },
]);
ok(b.balance === 0 && b.diasContados === 2, `Balance semanal (dio ${b.balance}/${b.diasContados})`);

// Resumen
const fallas = resultados.filter((x) => !x.ok);
for (const x of resultados) console[x.ok ? 'log' : 'error'](`${x.ok ? '✓' : '✗'} ${x.nombre}`);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} pruebas OK`);
if (typeof process !== 'undefined' && fallas.length) process.exit(1);
export { resultados };
