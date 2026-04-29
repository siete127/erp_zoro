const { pool, sql } = require('../config/db');

async function ensureCostTables(transaction = null) {
  const request = transaction ? new sql.Request(transaction) : pool.request();
  await request.query(`
    IF OBJECT_ID('dbo.ERP_PRODUCTO_COSTEO_PROMEDIO', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.ERP_PRODUCTO_COSTEO_PROMEDIO (
        CostoPromedio_Id INT IDENTITY(1,1) PRIMARY KEY,
        Producto_Id INT NOT NULL,
        Company_Id INT NULL,
        CostoPromedio DECIMAL(18,6) NOT NULL DEFAULT 0,
        ExistenciaBase DECIMAL(18,4) NOT NULL DEFAULT 0,
        UltimoCostoCompra DECIMAL(18,6) NULL,
        UltimaCantidadEntrada DECIMAL(18,4) NULL,
        UltimaActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        UNIQUE (Producto_Id, Company_Id)
      );
      CREATE INDEX IX_ERP_PRODUCTO_COSTEO_PROMEDIO_PRODUCTO
        ON dbo.ERP_PRODUCTO_COSTEO_PROMEDIO (Producto_Id, Company_Id);
    END
  `);
}

function resolveCompanyScope(req, alias = 'a') {
  const request = pool.request();
  let clause = '';

  if (!req?.isAdmin) {
    if (req?.userCompanies?.length) {
      const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
      req.userCompanies.forEach((companyId, idx) => {
        request.input(`userCompany${idx}`, sql.Int, Number(companyId));
      });
      clause = ` AND ${alias}.Company_Id IN (${placeholders})`;
    } else {
      clause = ' AND 1 = 0';
    }
  } else if (req?.query?.company_id && req.query.company_id !== 'all') {
    request.input('Company_Id', sql.Int, Number(req.query.company_id));
    clause = ` AND ${alias}.Company_Id = @Company_Id`;
  }

  return { request, clause };
}

async function getCurrentAverageCost(productoId, companyId = null, transaction = null) {
  await ensureCostTables(transaction);
  const request = transaction ? new sql.Request(transaction) : pool.request();
  request.input('Producto_Id', sql.Int, Number(productoId));
  request.input('Company_Id', sql.Int, companyId ? Number(companyId) : null);

  const result = await request.query(`
    SELECT TOP 1 cp.CostoPromedio,
                 cp.ExistenciaBase,
                 cp.UltimoCostoCompra,
                 p.CostoInicial
    FROM ERP_PRODUCTOS p
    LEFT JOIN ERP_PRODUCTO_COSTEO_PROMEDIO cp
      ON cp.Producto_Id = p.Producto_Id
     AND ((cp.Company_Id IS NULL AND @Company_Id IS NULL) OR cp.Company_Id = @Company_Id)
    WHERE p.Producto_Id = @Producto_Id;
  `);

  const row = result.recordset?.[0] || {};
  const fallbackCost = Number(row.CostoPromedio ?? row.CostoInicial ?? 0);
  return {
    costoPromedio: fallbackCost,
    existenciaBase: Number(row.ExistenciaBase || 0),
    ultimoCostoCompra: Number(row.UltimoCostoCompra || fallbackCost || 0),
  };
}

async function updateAverageCostFromReceipt({
  productoId,
  companyId = null,
  cantidadEntrante,
  costoUnitario,
  stockPrevio = null,
  transaction = null,
}) {
  const cantidad = Number(cantidadEntrante || 0);
  const costo = Number(costoUnitario || 0);

  if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(costo) || costo < 0) {
    return null;
  }

  await ensureCostTables(transaction);
  const current = await getCurrentAverageCost(productoId, companyId, transaction);
  const existenciaBase = Number.isFinite(Number(stockPrevio)) ? Number(stockPrevio) : Number(current.existenciaBase || 0);
  const valorAnterior = existenciaBase * Number(current.costoPromedio || 0);
  const valorEntrada = cantidad * costo;
  const existenciaNueva = existenciaBase + cantidad;
  const costoPromedioNuevo = existenciaNueva > 0
    ? Number(((valorAnterior + valorEntrada) / existenciaNueva).toFixed(6))
    : costo;

  const request = transaction ? new sql.Request(transaction) : pool.request();
  request.input('Producto_Id', sql.Int, Number(productoId));
  request.input('Company_Id', sql.Int, companyId ? Number(companyId) : null);
  request.input('CostoPromedio', sql.Decimal(18, 6), costoPromedioNuevo);
  request.input('ExistenciaBase', sql.Decimal(18, 4), existenciaNueva);
  request.input('UltimoCostoCompra', sql.Decimal(18, 6), costo);
  request.input('UltimaCantidadEntrada', sql.Decimal(18, 4), cantidad);

  await request.query(`
    MERGE dbo.ERP_PRODUCTO_COSTEO_PROMEDIO AS target
    USING (
      SELECT @Producto_Id AS Producto_Id, @Company_Id AS Company_Id
    ) AS source
    ON target.Producto_Id = source.Producto_Id
      AND (
        (target.Company_Id IS NULL AND source.Company_Id IS NULL)
        OR target.Company_Id = source.Company_Id
      )
    WHEN MATCHED THEN
      UPDATE SET
        CostoPromedio = @CostoPromedio,
        ExistenciaBase = @ExistenciaBase,
        UltimoCostoCompra = @UltimoCostoCompra,
        UltimaCantidadEntrada = @UltimaCantidadEntrada,
        UltimaActualizacion = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (Producto_Id, Company_Id, CostoPromedio, ExistenciaBase, UltimoCostoCompra, UltimaCantidadEntrada)
      VALUES (@Producto_Id, @Company_Id, @CostoPromedio, @ExistenciaBase, @UltimoCostoCompra, @UltimaCantidadEntrada);

    UPDATE ERP_PRODUCTOS
    SET CostoInicial = @CostoPromedio,
        FechaActualizacion = GETDATE()
    WHERE Producto_Id = @Producto_Id;
  `);

  return {
    costoPromedio: costoPromedioNuevo,
    existenciaBase: existenciaNueva,
  };
}

module.exports = {
  ensureCostTables,
  resolveCompanyScope,
  getCurrentAverageCost,
  updateAverageCostFromReceipt,
};
