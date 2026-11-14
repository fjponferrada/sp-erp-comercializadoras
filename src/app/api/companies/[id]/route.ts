import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { normalizeCnmcLabelConfig } from '@/lib/cnmcLabelConfig';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as string;
    if (!['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verificar pertenencia a la comercializadora si no es SUPERADMIN
    if (userRole !== 'SUPERADMIN') {
      const userRecord = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          brand: { select: { companyId: true } },
          companies: { select: { id: true } },
          assignedBrands: { select: { companyId: true } },
        },
      });
      const allowedCompanyIds = new Set(
        [
          userRecord?.brand?.companyId,
          ...(userRecord?.companies || []).map((c) => c.id),
          ...(userRecord?.assignedBrands || []).map((b) => b.companyId),
        ].filter(Boolean)
      );
      if (!allowedCompanyIds.has(companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const data = await req.json();

    const cleanOptStr = (val: any): string | null => {
      if (val === undefined || val === null) return null;
      const trimmed = String(val).trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const cleanOptDate = (val: any): Date | null => {
      if (!val) return null;
      const dt = new Date(val);
      return isNaN(dt.getTime()) ? null : dt;
    };

    const updatePayload: Record<string, any> = {
      name: String(data.name || '').trim(),
      cif: String(data.cif || '').trim().toUpperCase(),
      codigo: cleanOptStr(data.codigo),
      address: cleanOptStr(data.address),
      email: cleanOptStr(data.email),
      contactPerson: cleanOptStr(data.contactPerson),
      phone: cleanOptStr(data.phone),
      cie: cleanOptStr(data.cie),
      codigoRee: cleanOptStr(data.codigoRee),
      codigoAcer: cleanOptStr(data.codigoAcer),
      unidadOfertaOmie: cleanOptStr(data.unidadOfertaOmie),
      remit: cleanOptStr(data.remit),
      codigoSujetoMercado: cleanOptStr(data.codigoSujetoMercado),
      ordenCnmc: cleanOptStr(data.ordenCnmc),
      fechaActivacionCnmc: cleanOptDate(data.fechaActivacionCnmc),
      fechaBajaCnmc: cleanOptDate(data.fechaBajaCnmc),
      representadoPor: cleanOptStr(data.representadoPor),
      fechaActivacionIsm: cleanOptDate(data.fechaActivacionIsm),
      fechaBajaIsm: cleanOptDate(data.fechaBajaIsm),
      residenciaCanarias: Boolean(data.residenciaCanarias),
      exportableOdoo: Boolean(data.exportableOdoo),
      empresaVisible: Boolean(data.empresaVisible),
      emisionFacturasCliente: Boolean(data.emisionFacturasCliente),
      registroMercantil: cleanOptStr(data.registroMercantil),
    };

    if (data.etiquetaCnmc !== undefined) {
      updatePayload.etiquetaCnmc = normalizeCnmcLabelConfig(data.etiquetaCnmc) as any;
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updatePayload,
    });

    return NextResponse.json(updatedCompany);
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}
