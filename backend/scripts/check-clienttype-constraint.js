const { poolPromise } = require('../config/db');

async function run() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT cc.name, cc.definition
      FROM sys.check_constraints cc
      WHERE cc.parent_object_id = OBJECT_ID('ERP_CLIENT')
        AND cc.definition LIKE '%ClientType%'
    `);

    console.log(JSON.stringify(result.recordset, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
