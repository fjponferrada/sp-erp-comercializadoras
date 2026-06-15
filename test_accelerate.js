process.env.DATABASE_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19BVkc5YXh6YmM3cTFoOEplUENrWDEiLCJhcGlfa2V5IjoiMDFLVFNGU1lYMVYxOTRWQUI4TUJUOTFXMUgiLCJ0ZW5hbnRfaWQiOiI2NmVhYzU3OWUxZDlhMWM3NDZmNTdlYzdkMmU4ZjY2MzY1Nzc5NjI1YTE0MDFiNzdhNzdmYmUyY2UwNmJjZmFhIiwiaW50ZXJuYWxfc2VjcmV0IjoiMDNlMmJmYmYtOTNlYi00YjM2LTljMzMtYjIwYmVmY2E0OWY5In0.w63dNH9ZoB_Ncs_qDwDrMkC8Ve2Pi2gtIg--sBWFEpo";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting...");
  try {
    const count = await prisma.contract.count();
    console.log("Count:", count);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
