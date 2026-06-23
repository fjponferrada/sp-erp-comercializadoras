import { prisma } from './src/lib/prisma';
import { subMonths } from 'date-fns';

async function main() {
  const today = new Date();
  const pastDate = subMonths(today, 15);

  const res = await prisma.$queryRaw`
    SELECT 
      sp."cups",
      EXTRACT(MONTH FROM i."billingEnd") as "month",
      EXTRACT(YEAR FROM i."billingEnd") as "year",
      SUM(i."totalMWh") as "totalMWh",
      SUM(EXTRACT(DAY FROM (i."billingEnd" - i."billingStart"))) as "days"
    FROM "Invoice" i
    JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
    WHERE i."billingEnd" >= ${pastDate}
      AND i."billingStart" IS NOT NULL
      AND i."billingEnd" IS NOT NULL
    GROUP BY sp."cups", EXTRACT(MONTH FROM i."billingEnd"), EXTRACT(YEAR FROM i."billingEnd")
    LIMIT 5
  `;
  console.log(res);
}

main().catch(console.error).finally(() => process.exit(0));
