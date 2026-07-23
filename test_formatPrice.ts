import { PrismaClient, Prisma } from '@prisma/client';

const formatPrice = (val: any, decimals: number, suffix: string = '€') => {
  if (val === null || val === undefined) return '-';
  const numVal = Number(val);
  if (isNaN(numVal)) return '-';
  
  // Convert to string avoiding scientific notation
  const parts = numVal.toFixed(10).split('.');
  let formatted = parts[0];
  if (decimals > 0) {
    formatted += ',' + parts[1].substring(0, decimals);
  }
  
  return `${formatted} ${suffix}`;
};

const d = new Prisma.Decimal("0.1400");
console.log("Decimal:", formatPrice(d, 3, '€/kWh'));
const n = 0.14;
console.log("Number:", formatPrice(n, 3, '€/kWh'));
