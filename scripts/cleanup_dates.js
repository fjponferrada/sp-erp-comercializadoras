const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function main() {
  const url = process.env.DATABASE_URL;
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log("Eliminando registros de FTP y UPLOAD en LoadCurve...");
    const res = await client.query(`
      DELETE FROM "LoadCurve" 
      WHERE source LIKE 'FTP_%' OR source = 'UPLOAD'
    `);
    console.log(`¡Limpieza completada! Se han eliminado ${res.rowCount} registros corruptos.`);
  } catch (err) {
    console.error('Error al limpiar:', err.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
