const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;
    
    const ptc = await pool.request().query(`SELECT TOP 1 Company_Id, NameCompany FROM ERP_COMPANY WHERE NameCompany LIKE '%PTC%'`);
    console.log('PTC:', ptc.recordset[0]);

    const roles = await pool.request().query('SELECT * FROM ERP_ROL');
    console.log('\nRoles:');
    console.table(roles.recordset);

    const users = await pool.request().query(`
      SELECT u.User_Id, u.Username, u.Name, u.RolId, r.Name as RolName,
             STRING_AGG(uc.Company_Id, ',') as Companies
      FROM ERP_USERS u
      LEFT JOIN ERP_ROL r ON u.RolId = r.Rol_Id
      LEFT JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
      GROUP BY u.User_Id, u.Username, u.Name, u.RolId, r.Name
    `);
    console.log('\nUsuarios:');
    console.table(users.recordset);

    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
