const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;

    // PRE2507108S2 es un RFC de prueba que no existe en el SAT real.
    // Para sandbox se puede usar el RFC del emisor como receptor o un RFC real conocido.
    // Aquí actualizamos el RFC del cliente PTCREMA al RFC real: CALI691111PX9 (solo para pruebas sandbox)
    await pool.request().query(
      "UPDATE ERP_CLIENT SET RFC = 'CALI691111PX9', LegalName = 'MARIA ISABEL CHAVEZ LOMELI', TaxRegime = '612' WHERE Client_Id = 26"
    );

    const r = await pool.request().query(
      "SELECT Client_Id, RFC, LegalName, TaxRegime FROM ERP_CLIENT WHERE Client_Id = 26"
    );
    console.log('Cliente actualizado para sandbox:', JSON.stringify(r.recordset, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
