require('dotenv').config();

const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString:
    `Driver={ODBC Driver 18 for SQL Server};` +
    `Server=${process.env.DB_SERVER};` +
    `Database=${process.env.DB_DATABASE};` +
    `Trusted_Connection=Yes;` +
    `TrustServerCertificate=Yes;`
};

console.log(config);

let pool;

async function getPool() {
  if (pool) return pool;

  try {
    pool = await sql.connect(config);
    console.log('Connected to SQL Server ✅');
    return pool;
  } catch (err) {
    console.dir(err, { depth: 10 });
    throw err;
  }
}

module.exports = {
  sql,
  getPool
};