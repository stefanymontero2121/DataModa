const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const csv     = require('csv-parser');

const app    = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// UTILIDADES MATEMÁTICAS
// ─────────────────────────────────────────────

function regresionLineal(valores) {
  const n = valores.length;
  if (n < 2) throw new Error('Se necesitan al menos 2 períodos de datos.');

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
  const prediccion = Math.round(m * n + b);

  return { m: +m.toFixed(4), b: +b.toFixed(4), r2: +r2.toFixed(4), prediccion };
}

function desviacionEstandar(valores) {
  const n = valores.length;
  const media = valores.reduce((a, v) => a + v, 0) / n;
  const varianza = valores.reduce((a, v) => a + (v - media) ** 2, 0) / (n - 1);
  return Math.sqrt(varianza);
}

// SS = Z · σ · √t  (Z=1.65, confianza 95%)
function stockSeguridad(valores, t = 1) {
  const Z  = 1.65;
  const sd = desviacionEstandar(valores);
  const ss = Z * sd * Math.sqrt(t);
  return { ss: Math.round(ss), sigma: +sd.toFixed(2) };
}

// Suavizado exponencial: S_t = α·y_t + (1−α)·S_{t−1}
// Baja α=0.2 | Media α=0.5 | Alta α=0.8
function suavizadoExponencial(valores, alpha) {
  let s = valores[0];
  for (let i = 1; i < valores.length; i++) {
    s = alpha * valores[i] + (1 - alpha) * s;
  }
  return Math.round(s);
}

// ─────────────────────────────────────────────
// PARSEO DE CSV
// ─────────────────────────────────────────────

function parsearCSV(filePath) {
  return new Promise((resolve, reject) => {
    const filas = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const normalizado = {};
        for (const k of Object.keys(row)) {
          const clave = k.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim().replace(/\s+/g, '_');
          normalizado[clave] = row[k].trim();
        }

        const unidades = parseInt(
          normalizado['unidades_vendidas'] ||
          normalizado['unidades'] ||
          normalizado['ventas'] ||
          normalizado['cantidad'] || '0',
          10
        );

        if (!isNaN(unidades) && unidades > 0) {
          filas.push({
            fecha:     normalizado['fecha'] || '',
            categoria: normalizado['categoria'] || normalizado['category'] || '',
            unidades
          });
        }
      })
      .on('end', () => {
        if (filas.length === 0) {
          reject(new Error('El archivo no contiene datos válidos. Columnas requeridas: fecha, categoria, unidades_vendidas.'));
        } else {
          resolve(filas);
        }
      })
      .on('error', reject);
  });
}

// ─────────────────────────────────────────────
// ENDPOINT PRINCIPAL
// ─────────────────────────────────────────────

app.post('/api/analizar', upload.single('archivoVentas'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo.' });
  }

  try {
    const filas = await parsearCSV(req.file.path);
    const serie = filas.map(f => f.unidades);

    const reg               = regresionLineal(serie);
    const { ss, sigma }     = stockSeguridad(serie);
    const ajusteBajo        = suavizadoExponencial(serie, 0.2);
    const ajusteMedio       = suavizadoExponencial(serie, 0.5);
    const ajusteAlto        = suavizadoExponencial(serie, 0.8);
    const totalRecomendado  = ajusteMedio + ss;

    fs.unlink(req.file.path, () => {});

    res.json({
      status:          'ok',
      periodos:        filas.length,
      serie,
      prediccionBase:  reg.prediccion,
      pendiente:       reg.m,
      intercepto:      reg.b,
      r2:              reg.r2,
      stockSeguridad:  ss,
      sigma,
      ajusteBajo,
      ajusteMedio,
      ajusteAlto,
      totalRecomendado,
      rangoMin: Math.round(reg.prediccion * 0.95),
      rangoMax: Math.round(reg.prediccion * 1.05) + ss
    });

  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(422).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 DataModa listo en http://localhost:${PORT}`);
});