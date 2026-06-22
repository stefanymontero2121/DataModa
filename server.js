'use strict';

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { preprocesar } = require('./dataPreprocessor');
const {
  regresionLineal,
  stockSeguridad,
  suavizadoExponencial,
  coeficienteVariacion,
} = require('./formulas');

const app    = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Umbrales de coeficiente de variación (σ / media) para clasificar la variabilidad
const UMBRAL_VARIABILIDAD_ALTA = 0.25; // ≥ 25% ⇒ alta
const UMBRAL_VARIABILIDAD_BAJA = 0.08; // ≤ 8%  ⇒ baja

app.post('/api/analizar', upload.single('archivoVentas'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo.' });
  }

  const filePath  = req.file.path;
  const extension = path.extname(req.file.originalname).replace('.', '') || 'csv';
  const categoria = (req.body.categoria || '').trim() || null;
  // CU003 FA1 — tiempo de reposición (t) ingresado manualmente; por defecto 1 período.
  const t = Math.max(1, parseInt(req.body.t, 10) || 1);

  try {
    const { serie, etiquetas, columnas, categoriasDisponibles, categoriaActiva } =
      await preprocesar(filePath, extension, categoria);

    const reg           = regresionLineal(serie);
    const { ss, sigma } = stockSeguridad(serie, t);
    const ajusteBajo    = suavizadoExponencial(serie, 0.2);
    const ajusteMedio   = suavizadoExponencial(serie, 0.5);
    const ajusteAlto    = suavizadoExponencial(serie, 0.8);
    const cv            = coeficienteVariacion(serie);

    // CU001 FA3 — alta variabilidad ⇒ margen de emergencia (prendas extra de seguridad).
    // CU003 FA2 — baja variabilidad ⇒ sugerir reducir el stock de seguridad.
    let variabilidad = 'normal';
    let margenEmergencia = 0;
    if (cv >= UMBRAL_VARIABILIDAD_ALTA) {
      variabilidad = 'alta';
      margenEmergencia = Math.round(ss * 0.5); // 50% extra sobre el stock de seguridad
    } else if (cv <= UMBRAL_VARIABILIDAD_BAJA) {
      variabilidad = 'baja';
    }

    fs.unlink(filePath, () => {});

    res.json({
      status:           'ok',
      periodos:         serie.length,
      serie,
      etiquetas,
      columnas,
      categoriasDisponibles,
      categoriaActiva,
      prediccionBase:   reg.prediccion,
      pendiente:        reg.m,
      intercepto:       reg.b,
      r2:               reg.r2,
      stockSeguridad:   ss,
      sigma,
      t,
      coefVariacion:    cv,
      variabilidad,
      margenEmergencia,
      ajusteBajo,
      ajusteMedio,
      ajusteAlto,
      totalRecomendado: ajusteMedio + ss + margenEmergencia,
      rangoMin: Math.round(reg.prediccion * 0.95),
      rangoMax: Math.round(reg.prediccion * 1.05) + ss + margenEmergencia,
    });

  } catch (err) {
    fs.unlink(filePath, () => {});
    const statusCode = err.message.startsWith('Formato') ? 422 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 DataModa listo en http://localhost:${PORT}`));
