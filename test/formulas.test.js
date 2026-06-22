'use strict';

const test   = require('node:test');
const assert = require('node:assert');

const {
  regresionLineal,
  desviacionEstandar,
  stockSeguridad,
  suavizadoExponencial,
  coeficienteVariacion,
  Z_95,
} = require('../formulas');

// ───────────────────────────────────────────────────────────────────────────
// CU001 — Regresión lineal (y = m·x + b)
// ───────────────────────────────────────────────────────────────────────────
test('regresionLineal: recta perfecta y = 2x + 1 ⇒ m=2, b=1, R²=1', () => {
  // x = 0,1,2,3,4  →  y = 1,3,5,7,9
  const r = regresionLineal([1, 3, 5, 7, 9]);
  assert.strictEqual(r.m, 2);
  assert.strictEqual(r.b, 1);
  assert.strictEqual(r.r2, 1);
  // predicción del siguiente período (x = 5) ⇒ 2·5 + 1 = 11
  assert.strictEqual(r.prediccion, 11);
});

test('regresionLineal: serie constante ⇒ pendiente 0 y R²=1', () => {
  const r = regresionLineal([100, 100, 100, 100]);
  assert.strictEqual(r.m, 0);
  assert.strictEqual(r.b, 100);
  assert.strictEqual(r.r2, 1);
  assert.strictEqual(r.prediccion, 100);
});

test('regresionLineal: tendencia ascendente real (verificación manual)', () => {
  // Datos conocidos: x=0..3, y=[10,20,25,30]
  // m = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
  // Σx=6, Σy=85, Σxy=170, Σx²=14, n=4
  // m = (4·170 − 6·85) / (4·14 − 36) = (680 − 510) / (56 − 36) = 170/20 = 6.5
  // b = (85 − 6.5·6) / 4 = (85 − 39) / 4 = 11.5
  const r = regresionLineal([10, 20, 25, 30]);
  assert.strictEqual(r.m, 6.5);
  assert.strictEqual(r.b, 11.5);
  // predicción x=4 ⇒ 6.5·4 + 11.5 = 37.5 ⇒ redondeo 38
  assert.strictEqual(r.prediccion, 38);
});

test('regresionLineal: lanza error con menos de 2 puntos', () => {
  assert.throws(() => regresionLineal([5]), /al menos 2 puntos/);
});

// ───────────────────────────────────────────────────────────────────────────
// Desviación estándar muestral (n − 1)
// ───────────────────────────────────────────────────────────────────────────
test('desviacionEstandar: muestral de [2,4,4,4,5,5,7,9]', () => {
  // media = 5; Σ(x−media)² = 9+1+1+1+0+0+4+16 = 32; /(n−1=7) = 4.571… ; √ = 2.138…
  const sd = desviacionEstandar([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(Math.abs(sd - 2.1380899) < 1e-6, `sd=${sd}`);
});

test('desviacionEstandar: serie constante ⇒ 0', () => {
  assert.strictEqual(desviacionEstandar([7, 7, 7]), 0);
});

// ───────────────────────────────────────────────────────────────────────────
// CU003 — Stock de seguridad (SS = Z · σ · √t)
// ───────────────────────────────────────────────────────────────────────────
test('stockSeguridad: SS = 1.65 · σ · √t con t=1', () => {
  const valores = [2, 4, 4, 4, 5, 5, 7, 9]; // σ ≈ 2.13809
  const { ss, sigma, z, t } = stockSeguridad(valores, 1);
  assert.strictEqual(z, Z_95);
  assert.strictEqual(t, 1);
  assert.strictEqual(sigma, 2.14); // redondeo a 2 decimales
  // 1.65 · 2.13809 · 1 = 3.5278 ⇒ redondeo 4
  assert.strictEqual(ss, 4);
});

test('stockSeguridad: t mayor aumenta el stock por √t', () => {
  const valores = [10, 14, 12, 18, 11, 15];
  const ssT1 = stockSeguridad(valores, 1).ss;
  const ssT4 = stockSeguridad(valores, 4).ss;
  // √4 = 2 ⇒ el stock con t=4 debe ser ~el doble del de t=1
  assert.strictEqual(ssT4, ssT1 * 2);
});

// ───────────────────────────────────────────────────────────────────────────
// CU002/CU004 — Suavizado exponencial (S_t = α·y_t + (1−α)·S_{t−1})
// ───────────────────────────────────────────────────────────────────────────
test('suavizadoExponencial: α=1 ⇒ devuelve el último valor', () => {
  assert.strictEqual(suavizadoExponencial([10, 20, 30], 1), 30);
});

test('suavizadoExponencial: α=0 ⇒ devuelve el primer valor', () => {
  assert.strictEqual(suavizadoExponencial([10, 20, 30], 0), 10);
});

test('suavizadoExponencial: cálculo manual con α=0.5', () => {
  // S0=100; S1=0.5·110+0.5·100=105; S2=0.5·90+0.5·105=97.5 ⇒ redondeo 98
  assert.strictEqual(suavizadoExponencial([100, 110, 90], 0.5), 98);
});

test('suavizadoExponencial: alpha fuera de rango lanza error', () => {
  assert.throws(() => suavizadoExponencial([1, 2], 1.5), /alpha/);
});

// ───────────────────────────────────────────────────────────────────────────
// Coeficiente de variación (σ / media)
// ───────────────────────────────────────────────────────────────────────────
test('coeficienteVariacion: serie constante ⇒ 0 (baja variabilidad)', () => {
  assert.strictEqual(coeficienteVariacion([50, 50, 50]), 0);
});

test('coeficienteVariacion: serie muy dispersa ⇒ alto', () => {
  const cv = coeficienteVariacion([10, 200, 5, 300, 8]);
  assert.ok(cv > 0.25, `cv=${cv}`);
});
