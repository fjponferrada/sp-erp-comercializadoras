require('dotenv').config({path: '.env.local'});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.invoice.updateMany({ data: { communicatedAt: null } });
  console.log("Cleared communicatedAt flags");
}
run();
