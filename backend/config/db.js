const sql = require("mssql");

const config = {
  user: "sa",
  password: "D1g1t4l3dg32024.",
  server: "74.208.195.73",
  database: "ERP",
  options: {
    encrypt: false,
    trustServerCertificate: true
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
