import { prisma } from '../src/lib/prisma';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';

async function main() {
  const configs = await prisma.distributor.findMany({ where: { ftpActive: true } });
  console.log(`Found ${configs.length} active FTP configs.`);

  for (const config of configs) {
    console.log(`\nTesting ${config.name}...`);
    const port = config.ftpPort || 21;
    const isSftp = [22, 11022, 6222].includes(port);

    try {
      if (isSftp) {
        console.log(`  -> SFTP connect to ${config.ftpHost}:${port}`);
        const sftpClient = new SftpClient();
        await sftpClient.connect({
          host: config.ftpHost || '',
          port: port,
          username: config.ftpUser || '',
          password: config.ftpPassword || '',
          readyTimeout: 5000
        });
        console.log(`  -> SUCCESS SFTP!`);
        await sftpClient.end();
      } else {
        console.log(`  -> FTP connect to ${config.ftpHost}:${port}`);
        const ftpClient = new Client(5000); // 5s timeout
        await ftpClient.access({
          host: config.ftpHost || '',
          port: port,
          user: config.ftpUser || '',
          password: config.ftpPassword || '',
          secure: false
        });
        console.log(`  -> SUCCESS FTP!`);
        ftpClient.close();
      }
    } catch (e: any) {
      console.error(`  -> ERROR connecting to ${config.name}:`, e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
