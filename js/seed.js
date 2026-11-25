// seed.js — alimentos GENÉRICOS de referencia y factores de cocción.
// Sin metas, sin medidas, sin favoritos: eso se captura y se guarda en el dispositivo.
// Valores por 100 g (base '100g') salvo que se indique porción. Fuente: referencias USDA FoodData Central
// de uso común; verifica contra FoodData Central o contra la etiqueta mexicana y edítalos en la app.

export const SEED_VERSION = 1;

export const YIELDS = [
  { id: 'pollo-asado', nombre: 'Pechuga de pollo · plancha/horno', factor: 0.72, fuente: 'usda',
    nota: 'USDA Table of Cooking Yields: horneada o asada 72 %. Calibra el tuyo.' },
  { id: 'pollo-guisado', nombre: 'Pechuga de pollo · pochada/guisada', factor: 0.77, fuente: 'usda',
    nota: 'USDA Table of Cooking Yields: pochada o guisada 77 %.' },
  { id: 'arroz', nombre: 'Arroz (seco → cocido)', factor: 2.7, fuente: 'usda',
    nota: 'Rango típico 2.5–3.0 según agua y tiempo. Calibra el tuyo.' },
  { id: 'pasta', nombre: 'Pasta (seca → cocida)', factor: 2.3, fuente: 'usda',
    nota: 'Rango típico 2.2–2.5. Calibra el tuyo.' },
  { id: 'res-molida', nombre: 'Carne molida de res · sartén', factor: 0.75, fuente: 'usda',
    nota: 'Aproximado; depende del % de grasa y de si escurres.' },
];

const f = (id, nombre, kcal, prot, grasa, carbs, estado, extra = {}) => ({
  id, nombre, base: '100g', kcal, prot, grasa, carbs, estado, fuente: 'usda', seed: true, ...extra,
});

export const FOODS = [
  // Proteínas
  f('pollo-pechuga-cruda', 'Pechuga de pollo sin piel (cruda)', 120, 22.5, 2.6, 0, 'crudo',
    { fdcId: 171077, yieldId: 'pollo-asado' }),
  f('pollo-pechuga-asada', 'Pechuga de pollo asada (cocida)', 165, 31, 3.6, 0, 'cocido'),
  f('atun-agua', 'Atún en agua (escurrido)', 116, 25.5, 0.8, 0, 'listo'),
  f('tilapia-cruda', 'Tilapia / pescado blanco (crudo)', 96, 20.1, 1.7, 0, 'crudo', { yieldId: 'pollo-asado' }),
  f('res-molida-90', 'Carne molida de res 90/10 (cruda)', 176, 20, 10, 0, 'crudo', { yieldId: 'res-molida' }),
  f('huevo-entero', 'Huevo entero', 143, 12.6, 9.5, 0.7, 'crudo', { porcionG: 50, porcionNombre: 'huevo grande' }),
  f('clara-huevo', 'Clara de huevo', 52, 10.9, 0.2, 0.7, 'crudo', { porcionG: 33, porcionNombre: 'clara' }),
  f('yogurt-griego-0', 'Yogurt griego natural sin grasa', 59, 10.2, 0.4, 3.6, 'listo'),
  f('leche-descremada', 'Leche descremada', 34, 3.4, 0.1, 5, 'listo'),
  {
    id: 'proteina-polvo', nombre: 'Proteína en polvo (aislado, genérico)', base: 'porcion', porcionG: 33,
    porcionNombre: 'scoop', kcal: 120, prot: 27, grasa: 0.5, carbs: 2, estado: 'listo', fuente: 'estimado',
    seed: true, nota: 'Depende de la marca: edítalo con tu etiqueta.',
  },

  // Carbohidratos
  f('arroz-integral-cocido', 'Arroz integral (cocido)', 123, 2.7, 1, 25.6, 'cocido', { fdcId: 169704 }),
  f('arroz-blanco-cocido', 'Arroz blanco (cocido)', 130, 2.7, 0.3, 28.2, 'cocido'),
  f('arroz-integral-crudo', 'Arroz integral (seco, crudo)', 370, 7.9, 2.9, 77, 'seco', { yieldId: 'arroz' }),
  f('pasta-seca', 'Pasta (seca)', 371, 13, 1.5, 74.7, 'seco', { yieldId: 'pasta' }),
  f('pasta-cocida', 'Pasta (cocida)', 158, 5.8, 0.9, 30.9, 'cocido'),
  f('avena', 'Avena en hojuelas (seca)', 379, 13.2, 6.5, 67.7, 'seco'),
  f('tortilla-maiz', 'Tortilla de maíz', 218, 5.7, 2.9, 44.6, 'listo', { porcionG: 28, porcionNombre: 'tortilla' }),
  f('platano', 'Plátano', 89, 1.1, 0.3, 22.8, 'listo', { porcionG: 118, porcionNombre: 'plátano mediano' }),
  f('camote', 'Camote (cocido)', 90, 2, 0.2, 20.7, 'cocido'),
  f('frijol-negro', 'Frijol negro (cocido)', 132, 8.9, 0.5, 23.7, 'cocido'),

  // Verduras y grasas
  f('brocoli', 'Brócoli (cocido)', 35, 2.4, 0.4, 7.2, 'cocido'),
  f('aguacate', 'Aguacate', 160, 2, 14.7, 8.5, 'listo'),
  f('aceite-oliva', 'Aceite de oliva', 884, 0, 100, 0, 'listo', { porcionG: 13.5, porcionNombre: 'cucharada' }),
];
