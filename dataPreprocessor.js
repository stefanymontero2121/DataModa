'use strict';

const fs  = require('fs');
const csv = require('csv-parser');

const DICT = {
  tiempo: [
    /^fecha$/,       /^date$/,        /^mes(es)?$/,
    /^periodo(s)?$/, /^period(s)?$/,  /^dia(s)?$/,
    /^day(s)?$/,     /^semana(s)?$/,  /^week(s)?$/,
    /^ano(s)?$/,     /^year(s)?$/,    /^trimestre(s)?$/,
    /^quarter(s)?$/, /^tiempo$/,      /^time$/,
    /^month(s)?$/,   /^t$/,           /^q$/,
    /^ciclo(s)?$/,   /^cycle(s)?$/,
  ],
  demanda: [
    /^cantidad(es)?$/,      /^unidades?(vendidas?)?$/,
    /^ventas?$/,            /^qty$/,
    /^quantity$/,           /^vendido(s)?$/,
    /^sold$/,               /^sales?$/,
    /^demanda$/,            /^demand$/,
    /^volumen$/,            /^volume$/,
    /^total(es)?ventas?$/,  /^unidadesvendidas$/,
    /^pedidos?$/,           /^orders?$/,
  ],
  categoria: [
    /^producto(s)?$/,   /^product(s)?$/,
    /^sku$/,            /^categorias?$/,
    /^category$/,       /^categories$/,
    /^prenda(s)?$/,     /^item(s)?$/,
    /^articulo(s)?$/,   /^article(s)?$/,
    /^tipo(s)?$/,       /^type(s)?$/,
    /^linea(s)?$/,      /^line(s)?$/,
    /^nombre$/,         /^name$/,
    /^descripcion$/,    /^description$/,
    /^referencia$/,     /^coleccion(es)?$/,
    /^collection(s)?$/,
  ],
};

function norm(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function detectarColumna(headers, diccionario) {
  for (const h of headers) {
    const n = norm(h);
    for (const rx of diccionario) {
      if (rx.test(n)) return h;
    }
  }
  return null;
}

function detectarColumnas(headers) {
  return {
    colTiempo:    detectarColumna(headers, DICT.tiempo),
    colDemanda:   detectarColumna(headers, DICT.demanda),
    colCategoria: detectarColumna(headers, DICT.categoria),
  };
}

function parsearNumero(val) {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  const limpio = String(val).trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '');
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
}

const MESES_ES = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, oct:10, nov:11, dic:12 };
const MESES_EN = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

function fechaAOrden(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;

  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d+\.\d+$/.test(s)) return Math.floor(parseFloat(s));

  let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return parseInt(m[1]) * 100 + parseInt(m[2]);

  m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return parseInt(m[1]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[3]);

  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) return parseInt(m[3]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[1]);

  m = s.toLowerCase().match(/([a-záéíóúñ]+)[^0-9]*(\d{2,4})/);
  if (m) {
    const key = m[1].substring(0, 3);
    const mes = MESES_ES[key] || MESES_EN[key] || 1;
    const anio = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
    return anio * 100 + mes;
  }

  m = s.match(/[qt](\d)\s*[-\/ ]*(\d{4})/i);
  if (m) return parseInt(m[2]) * 100 + parseInt(m[1]) * 3;

  const ts = Date.parse(s);
  return isNaN(ts) ? null : Math.floor(ts / 86400000);
}

function leerCSV(filePath) {
  return new Promise((resolve, reject) => {
    const filas = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', row => filas.push(row))
      .on('end',  () => resolve(filas))
      .on('error', reject);
  });
}

function leerExcel(filePath) {
  const xlsx = require('xlsx');
  const wb   = xlsx.readFile(filePath, { cellDates: false, raw: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { defval: '' });
}

function limpiarYAgrupar(filas, colTiempo, colDemanda, colCategoria, categoriaFiltro) {
  let validas = filas.filter(f => {
    const t = fechaAOrden(f[colTiempo]);
    const d = parsearNumero(f[colDemanda]);
    return t !== null && d !== null;
  });

  if (validas.length === 0) return null;

  if (categoriaFiltro && colCategoria) {
    const filtroNorm = norm(categoriaFiltro);
    const porCategoria = validas.filter(f => norm(String(f[colCategoria] ?? '')) === filtroNorm);
    if (porCategoria.length > 0) validas = porCategoria;
  }

  validas.sort((a, b) => fechaAOrden(a[colTiempo]) - fechaAOrden(b[colTiempo]));

  const mapa = new Map();
  for (const f of validas) {
    const key = String(f[colTiempo]).trim();
    const val = parsearNumero(f[colDemanda]);
    mapa.set(key, (mapa.get(key) || 0) + val);
  }

  return {
    etiquetas: Array.from(mapa.keys()),
    serie:     Array.from(mapa.values()).map(v => Math.round(v)),
  };
}

async function preprocesar(filePath, extension, categoriaFiltro = null) {
  let filas;
  const ext = extension.toLowerCase().replace('.', '');

  if (ext === 'csv' || ext === 'txt') {
    filas = await leerCSV(filePath);
  } else if (ext === 'xlsx' || ext === 'xls') {
    filas = leerExcel(filePath);
  } else {
    throw new Error(`Formato no soportado: .${ext}. Use CSV o Excel (.xlsx, .xls).`);
  }

  if (!filas || filas.length === 0) {
    throw new Error('El archivo está vacío o no tiene filas de datos.');
  }

  const headers = Object.keys(filas[0]);
  const { colTiempo, colDemanda, colCategoria } = detectarColumnas(headers);

  const faltantes = [];
  if (!colTiempo)  faltantes.push('fecha / período (ej: fecha, mes, date, periodo)');
  if (!colDemanda) faltantes.push('ventas / cantidad (ej: ventas, unidades, qty, cantidad)');

  if (faltantes.length > 0) {
    throw new Error(
      `Formato inválido: No se encontraron las columnas requeridas — ${faltantes.join(' | ')}. ` +
      `Columnas detectadas en el archivo: ${headers.join(', ')}.`
    );
  }

  const resultado = limpiarYAgrupar(filas, colTiempo, colDemanda, colCategoria, categoriaFiltro);

  if (!resultado || resultado.serie.length < 2) {
    throw new Error(
      'Datos insuficientes: se necesitan al menos 2 períodos con valores válidos ' +
      `en las columnas "${colTiempo}" y "${colDemanda}".`
    );
  }

  return {
    serie:     resultado.serie,
    etiquetas: resultado.etiquetas,
    columnas:  { colTiempo, colDemanda, colCategoria: colCategoria || null },
  };
}

module.exports = { preprocesar, detectarColumnas, norm };