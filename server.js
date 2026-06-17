'use strict';

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { preprocesar } = require('./dataPreprocessor');

const app    = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CU001 — Regresión lineal: y = m·x + b  +  R²
function regresionLineal(valores) {
  const n = valores.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += valores[i];
    sumXY += i * valores[i];
    sumX2 += i * i;
  }
  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  const media = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yHat = m * i + b;
    ssTot += (valores[i] - media) ** 2;
    ssRes += (valores[i] - yHat)  ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { m: +m.toFixed(4), b: +b.toFixed(4), r2: +r2.toFixed(4), prediccion: Math.round(m * n + b) };
}

// CU003 — Stock de seguridad: SS = Z · σ · √t  (Z = 1.65, confianza 95%)
function stockSeguridad(valores, t = 1) {
  const n     = valores.length;
  const media = valores.reduce((a, v) => a + v, 0) / n;
  const sd    = Math.sqrt(valores.reduce((a, v) => a + (v - media) ** 2, 0) / (n - 1));
  return { ss: Math.round(1.65 * sd * Math.sqrt(t)), sigma: +sd.toFixed(2) };
}

// CU002/CU004 — Suavizado exponencial: S_t = α·y_t + (1−α)·S_{t−1}
function suavizadoExponencial(valores, alpha) {
  let s = valores[0];
  for (let i = 1; i < valores.length; i++) s = alpha * valores[i] + (1 - alpha) * s;
  return Math.round(s);
}

app.post('/api/analizar', upload.single('archivoVentas'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo.' });
  }

  const filePath  = req.file.path;
  const extension = path.extname(req.file.originalname).replace('.', '') || 'csv';
  const categoria = (req.body.categoria || '').trim() || null;

  try {
    const { serie, etiquetas, columnas } = await preprocesar(filePath, extension, categoria);

    const reg           = regresionLineal(serie);
    const { ss, sigma } = stockSeguridad(serie);
    const ajusteBajo    = suavizadoExponencial(serie, 0.2);
    const ajusteMedio   = suavizadoExponencial(serie, 0.5);
    const ajusteAlto    = suavizadoExponencial(serie, 0.8);

    fs.unlink(filePath, () => {});

    res.json({
      status:          'ok',
      periodos:        serie.length,
      serie,
      etiquetas,
      columnas,
      prediccionBase:  reg.prediccion,
      pendiente:       reg.m,
      intercepto:      reg.b,
      r2:              reg.r2,
      stockSeguridad:  ss,
      sigma,
      ajusteBajo,
      ajusteMedio,
      ajusteAlto,
      totalRecomendado: ajusteMedio + ss,
      rangoMin: Math.round(reg.prediccion * 0.95),
      rangoMax: Math.round(reg.prediccion * 1.05) + ss,
    });

  } catch (err) {
    fs.unlink(filePath, () => {});
    const statusCode = err.message.startsWith('Formato') ? 422 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 DataModa listo en http://localhost:${PORT}`));