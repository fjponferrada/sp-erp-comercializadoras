import { prisma } from './src/lib/prisma';
import { randomUUID } from 'crypto';

async function test() {
  const cups = "ES0031100000000000ZZ";
  const dateStr = "2023-01-01T00:00:00.000Z";
  const readings = new Array(96).fill(1.5);
  const resolution = "QUARTER_HOURLY";
  const isProvisional = false;
  const source = "FTP_TEST";

  const rows = [
    { cups, date: new Date(dateStr), readings, resolution, isProvisional, source }
  ];

  // We can construct a bulk INSERT
  // The trick with Prisma and Postgres is to pass arrays to UNNEST
  const cupsArr = rows.map(r => r.cups);
  const dateArr = rows.map(r => r.date);
  const readingsArr = rows.map(r => r.readings); // Array of Float[] -> Float[][]
  const resArr = rows.map(r => r.resolution);
  const provArr = rows.map(r => r.isProvisional);
  const srcArr = rows.map(r => r.source);
  const idArr = rows.map(() => randomUUID());

  try {
    const res = await prisma.$executeRaw`
      INSERT INTO "LoadCurve" (id, cups, date, readings, resolution, "isProvisional", source)
      SELECT * FROM UNNEST(
        ${idArr}::text[],
        ${cupsArr}::text[],
        ${dateArr}::date[],
        ${readingsArr}::float8[][],
        ${resArr}::"Resolution"[],
        ${provArr}::boolean[],
        ${srcArr}::text[]
      ) AS t(id, cups, date, readings, resolution, "isProvisional", source)
      ON CONFLICT (cups, date) DO UPDATE SET
        readings = EXCLUDED.readings,
        resolution = EXCLUDED.resolution,
        "isProvisional" = EXCLUDED."isProvisional",
        source = EXCLUDED.source
      WHERE "LoadCurve"."isProvisional" = true OR EXCLUDED."isProvisional" = false;
    `;
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
test().finally(() => prisma.$disconnect());
