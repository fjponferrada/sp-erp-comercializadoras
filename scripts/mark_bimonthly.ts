import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cupsList = [
    "ES0031101410259001PM0F",
    "ES0031101654487001EK0F",
    "ES0031101347735001NX0F",
    "ES0031101418770001GQ0F",
    "ES0031101368362001EN0F",
    "ES0031104663783001YX0F",
    "ES0031105678969028BP0F",
    "ES0031101652984003HG0F",
    "ES0031105665678001SZ0F",
    "ES0031104595203054NZ0F",
    "ES0031101351836001CH0F",
    "ES0031101493309002SL0F",
    "ES0031101653646003GH0F",
    "ES0031105675275001XB0F",
    "ES0031101788185001MX0F",
    "ES0031104722265004YM0F",
    "ES0031101391935003DS0F",
    "ES0031104192825001BS0F",
    "ES0031101415620001JG0F",
    "ES0031103111894019QX0F",
    "ES0031103534689001RE0F",
    "ES0031105144008001TY0F",
    "ES0031101318697003YH0F",
    "ES0031102397551002LD0F",
    "ES0031102432145001KF0F",
    "ES0031103077433005TB0F",
    "ES0031101402914001SD0F",
    "ES0031104767387009RN0F",
    "ES0031104079886021YM0F",
    "ES0031101301184010XF0F",
    "ES0031101416340001ZN0F",
    "ES0031101445479002HZ0F",
    "ES0031103022666001QD0F",
    "ES0031102952786006DV0F",
    "ES0031101423134001QL0F",
    "ES0031104645544027RJ0F",
    "ES0031101357992007EM0F",
    "ES0031104844156011RM0F",
    "ES0031101653158001QF0F",
    "ES0031102937339026RK0F",
    "ES0031105478050010PC0F",
    "ES0031101653004002JQ0F",
    "ES0031101653004005JL0F",
    "ES0031101432164001SN0F",
    "ES0031105662761013NR0F",
    "ES0031101652984005HY0F",
    "ES0031101652984006HF0F",
    "ES0031101352622001QQ0F",
    "ES0031101652984002HA0F"
  ];

  const uniqueCups = [...new Set(cupsList)];
  console.log(`Marcando ${uniqueCups.length} CUPS como bimensuales...`);

  const result = await prisma.supplyPoint.updateMany({
    where: {
      cups: { in: uniqueCups }
    },
    data: {
      isBimonthly: true
    }
  });

  console.log(`Actualizados: ${result.count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
