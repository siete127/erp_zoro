const sql = require("mssql");
const { getRequiredEnv } = require("./env");

const config = {
  user: getRequiredEnv("DB_USER"),
  password: getRequiredEnv("DB_PASSWORD"),
  server: getRequiredEnv("DB_SERVER"),
  database: getRequiredEnv("DB_DATABASE"),
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true"
  }
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

// Compatibilidad: algunos controladores esperan poolPromise
const poolPromise = poolConnect;

module.exports = {
  sql,
  pool,
  poolConnect,
  poolPromise
};
