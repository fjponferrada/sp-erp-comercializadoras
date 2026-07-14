import { prisma } from './src/lib/prisma';
async function main() {
  const cupsList = [
    'ES0031104116766001SZ0F', 'ES0031101395337001DZ0F', 'ES0031101351975002SF0F',
    'ES0031105503188020ML0F', 'ES0031105576962001JM0F', 'ES0021000042579134KJ',
    'ES0021000042774908TB', 'ES0022000001476878AN1P', 'ES0031101328627001NL0F',
    'ES0022000001329273WK1P', 'ES0021000043122123PH', 'ES0031408686551001WL0F',
    'ES0021000040911881MF', 'ES0021000042231970SB', 'ES0031105635402001AH0F'
  ];
  
  const results = [];
  for (const cups of cupsList) {
    const sp = await prisma.supplyPoint.findFirst({ 
      where: { cups }, 
      include: { 
        invoices: { orderBy: { billingEnd: 'desc' }, take: 1 },
        contracts: { orderBy: { activationDate: 'desc' }, take: 1 }
      } 
    });
    
    if (sp) {
      results.push({
        cups,
        isBimonthly: sp.isBimonthly,
        latestInvoiceEnd: sp.invoices[0]?.billingEnd,
        contractStatus: sp.contracts[0]?.status
      });
    } else {
      results.push({ cups, notFound: true });
    }
  }
  console.table(results);
}
main().finally(() => prisma['$disconnect']());
