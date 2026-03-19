const { pool } = require('../config/db');

(async () => {
  try {
    await pool.connect();
    const r = await pool.request().query(`
      SELECT 
        fk.name AS FK_Name, 
        tp.name AS ParentTable, 
        cp.name AS ParentColumn
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
      JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      WHERE tr.name = 'ERP_PRODUCTOS'
    `);
    console.table(r.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
