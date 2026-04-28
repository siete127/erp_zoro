#!/usr/bin/env node
require("dotenv").config();

const sql = require("mssql");
const fs = require("fs");
const path = require("path");
const { getRequiredEnv } = require("./backend/config/env");

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

    const scriptPath = path.join(__dirname, "erp_zoro_python/sql/fase_7_brechas_erp.sql");
    const sqlScript = fs.readFileSync(scriptPath, "utf8");

    console.log("Ejecutando Fase 7...");
    console.log("=".repeat(60));

    const request = pool.request();
    await request.batch(sqlScript);

    console.log("=".repeat(60));
    console.log("Fase 7 ejecutada correctamente");
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
    console.error("Error:", error.message);
    if (error.originalError) {
      console.error("  Detalle:", error.originalError.message);
    }
    process.exit(1);
  }
}

ejecutarFase7();
