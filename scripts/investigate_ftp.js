const { Client } = require('pg');
const SftpClient = require('ssh2-sftp-client');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function main() {
  const url = process.env.DATABASE_URL;
  const pgClient = new Client({ connectionString: url });
  await pgClient.connect();

  const res = await pgClient.query(`SELECT * FROM "Distributor" WHERE name LIKE '%EDISTRIBUCION%'`);
  const config = res.rows[0];
  await pgClient.end();

  if (!config) return console.log("No config");

  const isSftp = [22, 11022, 6222].includes(config.ftpPort || 21);
  console.log("Conectando...", { host: config.ftpHost, port: config.ftpPort });

  if (isSftp) {
    const sftpClient = new SftpClient();
    await sftpClient.connect({
      host: config.ftpHost,
      port: config.ftpPort,
      username: config.ftpUser,
      password: config.ftpPassword,
      readyTimeout: 5000
    });
    const list = await sftpClient.list('/');
    console.log("Root files:", list.map(x => ({ name: x.name, type: x.type, modifyTime: new Date(x.modifyTime) })));
    
    const sublist1 = await sftpClient.list('/01_SALIDA_FACT');
    console.log("Files in /01_SALIDA_FACT:", sublist1.map(x => ({ name: x.name, type: x.type, modify: new Date(x.modifyTime) })));

    const yearFolder = sublist1.find(x => x.name === new Date().getFullYear().toString() || x.name === '2026');
    if (yearFolder) {
      const sublist2 = await sftpClient.list(`/01_SALIDA_FACT/${yearFolder.name}`);
      console.log(`Files in /01_SALIDA_FACT/${yearFolder.name}:`, sublist2.map(x => ({ name: x.name, type: x.type })));
      
      const monthFolder = sublist2.find(x => x.type === 'd');
      if (monthFolder) {
        const sublist3 = await sftpClient.list(`/01_SALIDA_FACT/${yearFolder.name}/${monthFolder.name}`);
        console.log(`Files in /01_SALIDA_FACT/${yearFolder.name}/${monthFolder.name}:`, sublist3.map(x => ({ name: x.name, type: x.type })));
      }
    }

    await sftpClient.end();
  } else {
    const ftp = require('basic-ftp');
    const ftpClient = new ftp.Client();
    await ftpClient.access({
      host: config.ftpHost,
      port: config.ftpPort || 21,
      user: config.ftpUser,
      password: config.ftpPassword,
      secure: config.ftpPort === 21 ? false : 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    const list = await ftpClient.list('/');
    console.log("Root files:", list.map(x => ({ name: x.name, type: x.type, date: x.modifiedAt })));
    ftpClient.close();
  }
}

main().catch(console.error);
