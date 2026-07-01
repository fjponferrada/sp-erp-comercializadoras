const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const data = await prisma.reganecuData.findFirst({ where: { total: true } });
  if(data) console.log(Object.keys(data.jsonData));
  else console.log('No data');
}
run();
