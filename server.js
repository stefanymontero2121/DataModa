const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Servir de forma estática los archivos que están dentro de la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Función auxiliar para parsear y limpiar las filas de los archivos CSV subidos por el usuario
function parseCSVData(text) {
    const lines = text.replace(/\r/g, '\n').split('\n');
    const values = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        const tokens = line.split(/[;,]/);
        for (let token of tokens) {
            const num = parseFloat(token.trim());
            if (!isNaN(num)) {
                values.push(num);
                break; 
            }
        }
    }
    return values;
}

// CU001 y CU003: Procesamiento matemático del archivo histórico
app.post('/api/analizar', upload.single('archivoVentas'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: "Error", mensaje: "No se seleccionó ningún archivo de datos válido." });
        }

        const fileContent = fs.readFileSync(req.file.path, 'utf-8');
        const ventas = parseCSVData(fileContent);
        
        // Limpieza de archivos del servidor local
        fs.unlinkSync(req.file.path);

        if (ventas.length < 3) {
            return res.status(400).json({ 
                status: "Error", 
                mensaje: "El archivo requiere un mínimo de 3 periodos consecutivos para calcular la Regresión Lineal de forma estable." 
            });
        }

        // 1. Regresión Lineal Matemática (y = mx + b)
        const n = ventas.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        
        for (let i = 0; i < n; i++) {
            const x = i + 1;
            const y = ventas[i];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }
        
        const denominador = (n * sumXX - sumX * sumX);
        const m = denominador !== 0 ? (n * sumXY - sumX * sumY) / denominador : 0;
        const b = (sumY - m * sumX) / n;
        
        const periodoSiguiente = n + 1;
        let prediccionBase = Math.round(m * periodoSiguiente + b);
        if (prediccionBase < 0) prediccionBase = 0;

        // 2. Cálculo matemático de Variabilidad (Desviación Estándar)
        const promedioHistorico = sumY / n;
        let sumaVariacion = 0;
        for (let i = 0; i < n; i++) {
            sumaVariacion += Math.pow(ventas[i] - promedioHistorico, 2);
        }
        const desviacionEstandar = Math.sqrt(sumaVariacion / n);

        // Constante de Confianza Logística al 95% (Z = 1.645)
        const Z = 1.645;
        const stockSeguridadBase = Math.round(Z * desviacionEstandar * Math.sqrt(1));

        res.json({
            status: "Éxito",
            datosHistoricos: ventas,
            promedioHistorico: Math.round(promedioHistorico),
            desviacionEstandar: Math.round(desviacionEstandar),
            prediccionBase: prediccionBase,
            stockSeguridadBase: stockSeguridadBase,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "Error", mensaje: "Error del servidor al procesar el archivo CSV." });
    }
});

// CU002: Suavizado Exponencial Dinámico según nivel seleccionado
app.post('/api/ajuste-dinamico', (req, res) => {
    const { prediccionBase, promedioHistorico, nivelSensibilidad } = req.body;
    
    let alpha = 0.5; // Predeterminado / Medio
    if (nivelSensibilidad === 'low') alpha = 0.2;
    if (nivelSensibilidad === 'high') alpha = 0.8;
    
    const propuestaAjuste = Math.round((alpha * promedioHistorico) + ((1 - alpha) * prediccionBase));
    const variacionPorcentaje = (((propuestaAjuste - prediccionBase) / (prediccionBase || 1)) * 100).toFixed(1);
    
    res.json({
        propuestaAjuste: propuestaAjuste,
        variacionPorcentaje: variacionPorcentaje
    });
});

// Levantar servidor local en el puerto 3000 tal como se ve en la terminal de la imagen image_c2ad7d.png
const PORT = 3000;
app.listen(PORT, () => {
    console.log(` DataModa listo y corriendo localmente en: http://localhost:${PORT}`);
});
