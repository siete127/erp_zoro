const { pool, sql } = require("../config/db");
const fs = require("fs");
const readline = require("readline");

async function cargarClaveProdServ(filePath) {
  console.log("Cargando catálogo de Productos/Servicios SAT...");
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber === 1) continue;

    const parts = line.split("|");
    if (parts.length < 4) continue;

    const [clave, descripcion, fechaInicio, fechaFin, palabrasSimilares] = parts;

    try {
      await pool.request()
        .input("Clave", sql.VarChar, clave.trim())
        .input("Descripcion", sql.VarChar, descripcion.trim())
        .input("FechaInicio", sql.Date, fechaInicio ? new Date(fechaInicio) : null)
        .input("FechaFin", sql.Date, fechaFin ? new Date(fechaFin) : null)
        .input("PalabrasSimilares", sql.VarChar, palabrasSimilares?.trim() || null)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM SAT_CLAVE_PRODSERV WHERE Clave = @Clave)
          INSERT INTO SAT_CLAVE_PRODSERV (Clave, Descripcion, FechaInicio, FechaFin, PalabrasSimilares)
          VALUES (@Clave, @Descripcion, @FechaInicio, @FechaFin, @PalabrasSimilares)
        `);
      
      count++;
      if (count % 1000 === 0) {
        console.log(`Procesadas ${count} claves...`);
      }
    } catch (err) {
      console.error(`Error en línea ${lineNumber}:`, err.message);
    }
  }

  console.log(`✓ Cargadas ${count} claves de Productos/Servicios`);
}

async function cargarClaveUnidad(filePath) {
  console.log("Cargando catálogo de Unidades SAT...");
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber === 1) continue;

    const parts = line.split("|");
    if (parts.length < 3) continue;

    const [clave, nombre, descripcion, fechaInicio, fechaFin, simbolo] = parts;

    try {
      await pool.request()
        .input("Clave", sql.VarChar, clave.trim())
        .input("Nombre", sql.VarChar, nombre.trim())
        .input("Descripcion", sql.VarChar, descripcion?.trim() || null)
        .input("Simbolo", sql.VarChar, simbolo?.trim() || null)
        .input("FechaInicio", sql.Date, fechaInicio ? new Date(fechaInicio) : null)
        .input("FechaFin", sql.Date, fechaFin ? new Date(fechaFin) : null)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM SAT_UNIDADES WHERE Clave = @Clave)
          INSERT INTO SAT_UNIDADES (Clave, Nombre, Descripcion, Simbolo, FechaInicio, FechaFin)
          VALUES (@Clave, @Nombre, @Descripcion, @Simbolo, @FechaInicio, @FechaFin)
        `);
      
      count++;
      if (count % 100 === 0) {
        console.log(`Procesadas ${count} unidades...`);
      }
    } catch (err) {
      console.error(`Error en línea ${lineNumber}:`, err.message);
    }
  }

  console.log(`✓ Cargadas ${count} Unidades de Medida`);
}

async function main() {
  try {
    await pool.connect();
    console.log("Conectado a la base de datos");

    const prodServPath = "./data/c_ClaveProdServ.txt";
    const unidadPath = "./data/c_ClaveUnidad.txt";

    if (fs.existsSync(prodServPath)) {
      await cargarClaveProdServ(prodServPath);
    } else {
      console.log(`⚠ Archivo no encontrado: ${prodServPath}`);
    }

    if (fs.existsSync(unidadPath)) {
      await cargarClaveUnidad(unidadPath);
    } else {
      console.log(`⚠ Archivo no encontrado: ${unidadPath}`);
    }

    console.log("\n✓ Proceso completado");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
