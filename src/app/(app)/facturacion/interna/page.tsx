import { prisma } from '@/lib/prisma';
import FacturacionClient from './FacturacionClient';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function FacturacionInternaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const visibilityFilter = (await getInvoiceVisibilityFilter()) as Record<string, any>;
  const params = await searchParams;
  const searchQ = (params?.q || '').trim();

  const pendingAndConditions: any[] = [
    { internalInvoices: { none: {} } },
    { contractId: { not: null } },
  ];

  if (visibilityFilter.id) {
    pendingAndConditions.push({ id: visibilityFilter.id });
  } else if (Object.keys(visibilityFilter).length > 0) {
    pendingAndConditions.push({ contract: visibilityFilter });
  }

  if (searchQ) {
    const qUpper = searchQ.toUpperCase();

    if (qUpper.startsWith('ES')) {
      pendingAndConditions.push({
        contract: {
          supplyPoint: { cups: { startsWith: qUpper } },
        },
      });
    } else if (/\d/.test(searchQ) && searchQ.length <= 30) {
      pendingAndConditions.push({
        OR: [
          { numeroFactura: { contains: searchQ, mode: 'insensitive' } },
          { contract: { client: { vatNumber: { contains: searchQ, mode: 'insensitive' } } } },
        ],
      });
    } else {
      pendingAndConditions.push({
        contract: {
          client: {
            OR: [
              { businessName: { contains: searchQ, mode: 'insensitive' } },
              { firstName: { contains: searchQ, mode: 'insensitive' } },
              { lastName: { contains: searchQ, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
  }

  const pendingF1s = await prisma.f1Invoice.findMany({
    where: { AND: pendingAndConditions },
    include: {
      contract: {
        include: {
          client: true,
          supplyPoint: true,
        },
      },
      invoices: {
        where: { OR: [{ origin: null }, { origin: { not: 'INTERNAL_ENGINE' } }] },
        select: { id: true, pdfUrl: true, totalAmount: true, invoiceType: true },
      },
    },
    orderBy: {
      fechaEmision: 'desc',
    },
    take: 500,
  });

  const drafts = await prisma.internalInvoice.findMany({
    where: {
      AND: [
        visibilityFilter,
        { status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] } },
      ],
    },
    include: {
      client: true,
      supplyPoint: true,
      contract: {
        include: {
          client: true,
          supplyPoint: true,
        },
      },
      f1Invoice: {
        include: {
          invoices: {
        where: { OR: [{ origin: null }, { origin: { not: 'INTERNAL_ENGINE' } }] },
        select: { id: true, pdfUrl: true, totalAmount: true, invoiceType: true },
      },
        },
      },
    },
    orderBy: [{ billingEnd: 'desc' }, { createdAt: 'desc' }],
  });

  const historicalInvoices = await prisma.internalInvoice.findMany({
    where: {
      AND: [
        visibilityFilter,
        { status: { in: ['EMITIDA', 'ABONO'] } },
      ],
    },
    select: {
      id: true,
      supplyPointId: true,
      billingStart: true,
      billingEnd: true,
      contract: { select: { supplyPointId: true } },
      invoiceType: true,
    },
  });

  // Enriquecer f1.invoices para Abonos (AR / S / A) y filtrar Abonos cruzados en facturas N:
  // En Ingebau, las facturas de Abono (ej. R260900165) registran en "Codigo Fiscal" el código de la N anulada
  // (ej. CF 171261N094141584), quedando enlazadas por f1InvoiceId al F1 tipo N en lugar de al F1 tipo AR/S.
  const extractDatosGen = (jsonData: any) => {
    const node =
      jsonData?.FacturaATR ||
      jsonData?.OtrasFacturas ||
      jsonData?.Facturas?.FacturaATR ||
      jsonData?.Facturas?.OtrasFacturas ||
      jsonData ||
      {};
    return (
      node?.DatosGeneralesFacturaATR?.DatosGeneralesFactura ||
      node?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura ||
      node?.DatosGeneralesFactura ||
      {}
    );
  };
  const normCf = (v: any) =>
    String((Array.isArray(v) ? v[0] : v) || '')
      .replace(/^CF\s+/i, '')
      .trim()
      .toUpperCase();

  const allLoadedF1s: any[] = [
    ...pendingF1s,
    ...drafts.map((d) => d.f1Invoice).filter(Boolean),
  ];

  // Mapa rápido por supplyPointId de R -> código rectificado cuando codAbono coincide
  const rAbonoToOrigCode = new Map<string, string>();
  const abonoSpIds = new Set<string>();

  for (const f1 of allLoadedF1s) {
    const dg = extractDatosGen(f1.jsonData);
    const tipo = normCf(dg?.TipoFactura) || 'N';
    const spId = f1.supplyPointId || f1.contract?.supplyPoint?.id;
    if (tipo === 'R') {
      const orig = normCf(dg?.CodigoFacturaRectificadaAnulada);
      const codAbo = normCf(dg?.CodigoFacturaAbono) || (orig ? `AR-${orig}` : '');
      if (codAbo && orig) {
        rAbonoToOrigCode.set(`${spId || ''}:${codAbo}`, orig);
      }
    } else if (tipo === 'AR' || tipo === 'S' || tipo === 'A') {
      if (spId && (!f1.invoices || !f1.invoices.some((i: any) => i.invoiceType === 'Abono'))) {
        abonoSpIds.add(spId);
      }
    }

    // En F1s que NO son Abono (N, R, C, G), priorizar facturas proveedor que NO sean Abono
    if (tipo !== 'AR' && tipo !== 'S' && tipo !== 'A' && Array.isArray(f1.invoices) && f1.invoices.length > 0) {
      const nonAbonos = f1.invoices.filter(
        (i: any) => String(i.invoiceType || '').trim().toLowerCase() !== 'abono'
      );
      f1.invoices = nonAbonos;
    }
  }

  if (abonoSpIds.size > 0) {
    const spIdsArr = Array.from(abonoSpIds);
    const [legacyAbonos, siblingRF1s] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          supplyPointId: { in: spIdsArr },
          invoiceType: 'Abono',
          OR: [{ origin: null }, { origin: { not: 'INTERNAL_ENGINE' } }],
        },
        select: {
          id: true,
          supplyPointId: true,
          pdfUrl: true,
          totalAmount: true,
          invoiceType: true,
          invoiceData: true,
        },
        orderBy: { issueDate: 'desc' },
      }),
      prisma.f1Invoice.findMany({
        where: { supplyPointId: { in: spIdsArr } },
        select: { supplyPointId: true, numeroFactura: true, jsonData: true },
      }),
    ]);

    for (const r of siblingRF1s) {
      const dg = extractDatosGen(r.jsonData);
      if (normCf(dg?.TipoFactura) !== 'R') continue;
      const orig = normCf(dg?.CodigoFacturaRectificadaAnulada);
      const codAbo = normCf(dg?.CodigoFacturaAbono) || (orig ? `AR-${orig}` : '');
      if (codAbo && orig) {
        rAbonoToOrigCode.set(`${r.supplyPointId || ''}:${codAbo}`, orig);
      }
    }

    for (const f1 of allLoadedF1s) {
      const dg = extractDatosGen(f1.jsonData);
      const tipo = normCf(dg?.TipoFactura) || 'N';
      if (tipo !== 'AR' && tipo !== 'S' && tipo !== 'A') continue;
      if (Array.isArray(f1.invoices) && f1.invoices.some((i: any) => i.invoiceType === 'Abono')) {
        continue;
      }

      const spId = f1.supplyPointId || f1.contract?.supplyPoint?.id || '';
      const f1CodeNorm = normCf(f1.numeroFactura);
      const targetOrigCode =
        rAbonoToOrigCode.get(`${spId}:${f1CodeNorm}`) ||
        normCf(dg?.CodigoFacturaRectificadaAnulada) ||
        (f1CodeNorm.startsWith('AR-') ? f1CodeNorm.slice(3) : '');

      if (!targetOrigCode || !spId) continue;

      const matchedAbono = legacyAbonos.find((ab) => {
        if (ab.supplyPointId !== spId) return false;
        const abData = (ab.invoiceData as any) || {};
        const cfNorm = normCf(abData['Codigo Fiscal']);
        const rectNorm = normCf(abData['Codigo Factura Rectificada Anulada']);
        return cfNorm === targetOrigCode || rectNorm === targetOrigCode || cfNorm === f1CodeNorm;
      });

      if (matchedAbono) {
        f1.invoices = [
          {
            id: matchedAbono.id,
            pdfUrl: matchedAbono.pdfUrl,
            totalAmount: matchedAbono.totalAmount,
            invoiceType: matchedAbono.invoiceType,
          },
        ];
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Facturación Interna (Motor de Pruebas)"
        subtitle="Genera facturas desde los archivos F1, revísalas y confírmalas."
        showSearch={false}
      />
      <div
        style={{
          padding: '24px 32px',
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <FacturacionClient
          pendingF1s={JSON.parse(JSON.stringify(pendingF1s))}
          drafts={JSON.parse(JSON.stringify(drafts))}
          historicalInvoices={JSON.parse(JSON.stringify(historicalInvoices))}
        />
      </div>
    </div>
  );
}
