#!/usr/bin/env node
require("dotenv").config();

const sql = require("mssql");
const fs = require("fs");
const path = require("path");
const { getRequiredEnv } = require("./config/env");

const config = {
  user: getRequiredEnv("DB_USER"),
  password: getRequiredEnv("DB_PASSWORD"),
  server: getRequiredEnv("DB_SERVER"),
  database: getRequiredEnv("DB_DATABASE"),
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true",
    connectionTimeout: 30000,
    requestTimeout: 300000,
  },
};

async function ejecutarFase7() {
  try {
    console.log("Conectando a SQL Server...");
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log("Conectado a ERP SQL Server");

    const scriptPath = path.join(__dirname, "../erp_zoro_python/sql/fase_7_brechas_erp.sql");
    const sqlScript = fs.readFileSync(scriptPath, "utf8");

    console.log("Ejecutando Fase 7...");
    console.log("=".repeat(60));

    const lotes = sqlScript.split(/\nGO\n/i).filter((lote) => lote.trim().length > 0);

    let contador = 0;
    for (const lote of lotes) {
      try {
        const request = pool.request();
        const loteLimpio = lote.replace(/^GO\s*$/gim, "").trim();
        if (loteLimpio.length > 0) {
          await request.batch(loteLimpio);
          contador++;
        }
      } catch (batchError) {
        console.error(`Error en lote ${contador + 1}:`, batchError.message);
        if (batchError.originalError) {
          console.error("  Detalle:", batchError.originalError.message);
        }
      }
    }

    console.log("=".repeat(60));
    console.log(`Fase 7 ejecutada (${contador} lotes procesados)`);
    console.log("\nTablas/Alter creados:");
    console.log("  7.1 -> ERP_REQUISICION_COMPRA, ERP_REQUISICION_DETALLE");
    console.log("  7.2 -> (sin DDL nuevo - usa ERP_LEDGER)");
    console.log("  7.3 -> ERP_APROBACION_REGLAS, ERP_APROBACIONES");
    console.log("  7.4 -> ERP_CRM_EQUIPOS, ERP_CRM_EQUIPO_MIEMBROS, ERP_CRM_LEADS + ALTER ERP_CRM_OPORTUNIDADES");
    console.log("  7.5 -> ERP_PROVEEDOR_PRECIOS + ALTER ERP_CLIENT");
    console.log("  7.6 -> ERP_PROYECTOS, ERP_TIMESHEETS + ALTER ERP_TAREAS");
    console.log("  7.7 -> ERP_ACTIVOS_FIJOS, ERP_DEPRECIACIONES");

    await pool.close();
    console.log("\nConexion cerrada.");
    process.exit(0);
  } catch (error) {
    console.error("Error critico:", error.message);
    if (error.originalError) {
      console.error("  Detalle:", error.originalError.message);
    }
    process.exit(1);
  }
}

ejecutarFase7();
