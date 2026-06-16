const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' }); // Carpeta temporal para los archivos

app.use(cors());
app.use(express.json());

// Servir la carpeta 'public' (tu mockup)
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para recibir el archivo del CU001
app.post('/api/analizar', upload.single('archivoVentas'), (req, res) => {
    // Aquí implementaremos la fórmula estadística clásica (y = mx + b)
    // leyendo el archivo CSV/Excel que llegue en req.file
    console.log("Archivo recibido:", req.file);
    
    res.json({
        status: "Éxito",
        mensaje: "Archivo procesado. Calculando regresión lineal...",
        // Datos simulados para probar la conexión con el front
        prediccionBase: 1200,
        margenSeguridad: 150
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 DataModa listo en http://localhost:${PORT}`);
});