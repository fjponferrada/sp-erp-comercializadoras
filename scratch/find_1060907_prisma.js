const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const prisma = new PrismaClient();
  const res = await prisma.f1Invoice.findMany({
    where: {
      numeroFactura: {
        contains: '1060907'
      }
    }
  });
  console.log(res);
}
main().catch(console.error);
