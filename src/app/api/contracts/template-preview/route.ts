import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  renderContractAndSummaryBuffers,
  renderModificationPdfBuffer,
} from '@/lib/contracts/contractPdfService';
import { BrandTemplatePayload } from '@/lib/contracts/defaultClauses';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const {
      brandId,
      mode = 'CORE',
      payload,
    }: {
      brandId: string;
      mode: 'CORE' | 'B2B' | 'RESUMEN_CORE' | 'RESUMEN_B2B' | 'MODTEC' | 'SUBROGACION';
      payload?: BrandTemplatePayload;
    } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId requerido' }, { status: 400 });
    }

    // Security check for non-SUPERADMIN
    if ((session.user as any).role !== 'SUPERADMIN') {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { brand: true, companies: { select: { id: true } }, assignedBrands: { select: { id: true } } },
      });
      const targetBrand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!dbUser || !targetBrand) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      }
      const allowedCompany =
        dbUser.brand?.companyId === targetBrand.companyId ||
        dbUser.companies.some((c) => c.id === targetBrand.companyId) ||
        dbUser.assignedBrands.some((b) => b.id === targetBrand.id);
      if (!allowedCompany) {
        return NextResponse.json({ error: 'Sin acceso a esta comercializadora' }, { status: 403 });
      }
    }

    const isB2BSample = mode === 'B2B' || mode === 'RESUMEN_B2B';
    const sampleData: Record<string, any> = isB2BSample
      ? {
          numcontrato: 'PREVIEW-B2B-001',
          contrato: 'PREVIEW-B2B-001',
          fechafirma: new Date().toLocaleDateString('es-ES'),
          fecha: new Date().toLocaleDateString('es-ES'),
          nombretit: 'INDUSTRIAS SOLARES DEL SUR S.L.',
          '1apetit': '',
          '2apetit': '',
          nif: 'B87654321',
          cnae: '2511',
          direcciontitular: 'POLÍGONO INDUSTRIAL LAS QUEMADAS, PARCELA 42',
          cptit: '14014',
          loctit: 'CÓRDOBA',
          provtit: 'CÓRDOBA',
          mailtitular: 'administracion@industriassolares-demo.es',
          tlftitular: '957001122',
          mvtitular: '600112233',
          nombrerep: 'CARLOS MARTÍNEZ GÓMEZ',
          nifrep: '30998877X',
          cups: 'ES0031101234567890ABCD',
          tarifa: '3.0TD',
          direccionPS: 'POLÍGONO INDUSTRIAL LAS QUEMADAS, PARCELA 42',
          cpPS: '14014',
          localidadPS: 'CÓRDOBA',
          provPS: 'CÓRDOBA',
          ftraspapel: 'Email',
          iban: 'ES91 2100 0418 4502 0005 1332',
          nombreprod: 'Indexado Pyme Plus 3.0TD',
          tipoprod: 'INDEXADO',
          fee: '5,50',
          dsv: '2,50',
          p1e: '0',
          p2e: '0',
          p3e: '0',
          p4e: '0',
          p5e: '0',
          p6e: '0',
          p1c: '25',
          p2c: '25',
          p3c: '25',
          p4c: '25',
          p5c: '25',
          p6c: '50',
          p1p: '21,634',
          p2p: '11,482',
          p3p: '5,128',
          p4p: '4,391',
          p5p: '2,810',
          p6p: '1,945',
          MESESPERMANENCIA: '12',
          servicios: 'Asesoramiento Energético Corporativo',
          consumoanual: '85000',
          tramitacion: 'Cambio comercializadora sin cambios',
          modalidadauto: 'Con excedentes',
          pexc: '0',
          feeexc: '3,00',
          asociarabolsillo: 'Si',
          cbolsillosolar: '5,99',
        }
      : {
          numcontrato: 'PREVIEW-CORE-001',
          contrato: 'PREVIEW-CORE-001',
          fechafirma: new Date().toLocaleDateString('es-ES'),
          fecha: new Date().toLocaleDateString('es-ES'),
          nombretit: 'MARÍA',
          '1apetit': 'LÓPEZ',
          '2apetit': 'SÁNCHEZ',
          nif: '45778899Z',
          cnae: '9820',
          direcciontitular: 'CALLE CONDE DE GONDOMAR 15, 3º B',
          cptit: '14003',
          loctit: 'CÓRDOBA',
          provtit: 'CÓRDOBA',
          mailtitular: 'maria.lopez@ejemplo.es',
          tlftitular: '655443322',
          mvtitular: '655443322',
          nombrerep: '',
          nifrep: '',
          cups: 'ES0031109876543210XYZW',
          tarifa: '2.0TD',
          direccionPS: 'CALLE CONDE DE GONDOMAR 15, 3º B',
          cpPS: '14003',
          localidadPS: 'CÓRDOBA',
          provPS: 'CÓRDOBA',
          ftraspapel: 'Email',
          iban: 'ES76 0049 1500 0512 3456 7892',
          nombreprod: 'Hogar Fijo Tranquilidad 2.0TD',
          tipoprod: 'FIJO',
          fee: '0',
          dsv: '0',
          p1e: '0,164500',
          p2e: '0,132100',
          p3e: '0,104900',
          p4e: '0',
          p5e: '0',
          p6e: '0',
          p1c: '4,6',
          p2c: '4,6',
          p3c: '0',
          p4c: '0',
          p5c: '0',
          p6c: '0',
          p1p: '30,912',
          p2p: '4,421',
          p3p: '0',
          p4p: '0',
          p5p: '0',
          p6p: '0',
          MESESPERMANENCIA: '12',
          servicios: 'Sin servicios adicionales',
          consumoanual: '3450',
          tramitacion: 'Cambio comercializadora sin cambios',
          modalidadauto: 'Con excedentes',
          pexc: '60',
          feeexc: '0',
          asociarabolsillo: 'Si',
          cbolsillosolar: '3,50',
        };

    let outputBuffer: Buffer;

    if (mode === 'MODTEC' || mode === 'SUBROGACION') {
      const modRes = await renderModificationPdfBuffer({
        brandId,
        customPayloadOverride: payload || null,
        templateData: sampleData,
        isTecnica: mode === 'MODTEC',
      });
      outputBuffer = modRes.pdfBuffer;
    } else {
      const bundleRes = await renderContractAndSummaryBuffers({
        brandId,
        customPayloadOverride: payload || null,
        templateData: sampleData,
        isB2B: isB2BSample,
        isTransferencia: false,
        isIndexed: isB2BSample,
        hasSelfConsumption: true,
        hasSolarWallet: true,
      });
      outputBuffer =
        mode === 'RESUMEN_CORE' || mode === 'RESUMEN_B2B'
          ? bundleRes.summaryPdfBuffer
          : bundleRes.contractPdfBuffer;
    }

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Preview_${mode}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error rendering contract template preview:', error);
    return NextResponse.json({ error: error.message || 'Error generando previsualización PDF' }, { status: 500 });
  }
}
