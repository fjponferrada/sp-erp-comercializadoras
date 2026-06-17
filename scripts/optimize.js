const fs = require('fs');

let code = fs.readFileSync('src/app/actions/dashboardActions.ts', 'utf8');

if (!code.includes('unstable_cache')) {
  code = code.replace(
    "import { prisma } from '@/lib/prisma';",
    "import { prisma } from '@/lib/prisma';\nimport { unstable_cache } from 'next/cache';"
  );
  
  code = code.replace(
    "const filter = await getUserVisibilityFilter();",
    "const filter = await getUserVisibilityFilter();\n\n    const filterKey = JSON.stringify(filter);\n    const getMetrics = unstable_cache(\n      async (filterObj: any) => {"
  );
  
  // Replace filter with filterObj inside the function
  code = code.replace(/where: \{ \.\.\.filter,/g, "where: { ...filterObj,");
  code = code.replace(/where: \{\n\s*\.\.\.filter,/g, "where: {\n        ...filterObj,");
  
  const targetEnd = `    return {
      success: true,
      data: {
        kpis: {
          activos: activosCount,
          tramitando: tramitandoCount,
          rechazos: rechazosCount,
          bajas: bajasCount,
          mwh: totalMWh,
        },
        recentContracts: recentContracts.map(c => ({
          id: c.contractCode || c.supplyPoint.cups,
          internalId: c.id,
          client: c.client.businessName,
          status: c.status,
          tariff: c.product.tariff || '-',
          mwh: c.supplyPoint.annualConsumption || 0,
          canal: c.user.channel?.name || c.user.name,
          updatedAt: c.updatedAt
        })),
        renewals: renewalAlerts.map(c => {
          const diffTime = new Date(c.expectedEndDate!).getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            internalId: c.id,
            client: c.client.businessName,
            cups: c.supplyPoint.cups,
            expiresIn: \`\${diffDays} días\`,
            mwh: c.supplyPoint.annualConsumption || 0
          };
        }),
        billingStats
      }
    };
  } catch (error: any) {
    console.error("Error fetching dashboard metrics:", error);
    return { success: false, error: error.message };
  }`;

  const replacementEnd = `        return {
          kpis: {
            activos: activosCount,
            tramitando: tramitandoCount,
            rechazos: rechazosCount,
            bajas: bajasCount,
            mwh: totalMWh,
          },
          recentContracts: recentContracts.map(c => ({
            id: c.contractCode || c.supplyPoint.cups,
            internalId: c.id,
            client: c.client.businessName,
            status: c.status,
            tariff: c.product.tariff || '-',
            mwh: c.supplyPoint.annualConsumption || 0,
            canal: c.user.channel?.name || c.user.name,
            updatedAt: c.updatedAt
          })),
          renewals: renewalAlerts.map(c => {
            const diffTime = new Date(c.expectedEndDate!).getTime() - new Date().getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
              internalId: c.id,
              client: c.client.businessName,
              cups: c.supplyPoint.cups,
              expiresIn: \`\${diffDays} días\`,
              mwh: c.supplyPoint.annualConsumption || 0
            };
          }),
          billingStats
        };
      },
      ['dashboard-metrics-' + filterKey],
      { revalidate: 300 }
    );

    const data = await getMetrics(filter);
    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching dashboard metrics:", error);
    return { success: false, error: error.message };
  }`;

  code = code.replace(targetEnd, replacementEnd);
  
  fs.writeFileSync('src/app/actions/dashboardActions.ts', code);
  console.log('Successfully optimized dashboardActions.ts');
} else {
  console.log('Already optimized');
}
