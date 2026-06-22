'use strict';

/**
 * Motor estadístico de DataModa.
 *
 * Cada función implementa una fórmula del documento de casos de uso y está
 * aislada para poder probarse unitariamente (mitigación del Riesgo R1:
 * "verificar la correctitud de cada fórmula contra cálculos manuales").
 *
 *   CU001 — Regresión lineal:        y = m·x + b      (+ R² de bondad de ajuste)
 *   CU003 — Stock de seguridad:      SS = Z · σ · √t  (Z = 1.65 → confianza 95%)
 *   CU002/CU004 — Suavizado exp.:    S_t = α·y_t + (1−α)·S_{t−1}
 */

// CU001 — Regresión lineal sobre una serie indexada por posición (x = 0,1,2,…)
function regresionLineal(valores) {
  const n = valores.length;
  if (n < 2) throw new Error('La regresión lineal requiere al menos 2 puntos.');

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += valores[i];
    sumXY += i * valores[i];
    sumX2 += i * i;
  }
  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  // R² = 1 − (SS_res / SS_tot)
  const media = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yHat = m * i + b;
    ssTot += (valores[i] - media) ** 2;
    ssRes += (valores[i] - yHat)  ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return {
    m:          +m.toFixed(4),
    b:          +b.toFixed(4),
    r2:         +r2.toFixed(4),
    prediccion: Math.round(m * n + b), // proyección del siguiente período (x = n)
  };
}

// Z = 1.65 corresponde a ~95% de nivel de servicio (CU003)
const Z_95 = 1.65;

// Desviación estándar muestral (n − 1)
function desviacionEstandar(valores) {
  const n = valores.length;
  if (n < 2) return 0;
  const media = valores.reduce((a, v) => a + v, 0) / n;
  const varianza = valores.reduce((a, v) => a + (v - media) ** 2, 0) / (n - 1);
  return Math.sqrt(varianza);
}

// CU003 — Stock de seguridad: SS = Z · σ · √t
function stockSeguridad(valores, t = 1, z = Z_95) {
  const sigma = desviacionEstandar(valores);
  return {
    ss:    Math.round(z * sigma * Math.sqrt(t)),
    sigma: +sigma.toFixed(2),
    z,
    t,
  };
}

// CU002/CU004 — Suavizado exponencial simple
function suavizadoExponencial(valores, alpha) {
  if (alpha < 0 || alpha > 1) throw new Error('alpha debe estar entre 0 y 1.');
  let s = valores[0];
  for (let i = 1; i < valores.length; i++) {
    s = alpha * valores[i] + (1 - alpha) * s;
  }
  return Math.round(s);
}

// Coeficiente de variación (σ / media) — usado para detectar alta/baja variabilidad
// CU001 FA3 (margen de emergencia) y CU003 FA2 (sugerir reducir stock).
function coeficienteVariacion(valores) {
  const media = valores.reduce((a, v) => a + v, 0) / valores.length;
  if (media === 0) return 0;
  return +(desviacionEstandar(valores) / media).toFixed(4);
}

module.exports = {
  Z_95,
  regresionLineal,
  desviacionEstandar,
  stockSeguridad,
  suavizadoExponencial,
  coeficienteVariacion,
};
