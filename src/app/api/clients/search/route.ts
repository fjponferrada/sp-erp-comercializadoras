import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand, getClientVisibilityFilter, getLeadVisibilityFilter } from '@/lib/permissions';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawNif = searchParams.get('nif') || '';
    const cleanNif = rawNif.trim().toUpperCase().replace(/[-\s.]/g, '');

    if (!cleanNif || cleanNif.length < 5) {
      return NextResponse.json({ found: false });
    }

    const dbUser = await prisma.user.findFirst({
      where: { email: { equals: session.user.email.trim(), mode: 'insensitive' } },
    });
    if (!dbUser || dbUser.isActive === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = ['CANAL', 'COMERCIAL'].includes(dbUser.role)
      ? dbUser.brandId
      : ((await getActiveBrand(dbUser)) || dbUser.brandId);

    const [clientFilter, leadFilter] = await Promise.all([
      getClientVisibilityFilter(),
      getLeadVisibilityFilter(),
    ]);

    const identityDocFilter = {
      where: { type: { in: ['DNI', 'ESCRITURAS', 'DNI_APODERADO'] } },
      orderBy: { createdAt: 'desc' as const },
      take: 10,
    };

    let client = await prisma.client.findFirst({
      where: {
        AND: [
          clientFilter,
          { vatNumber: { equals: cleanNif, mode: 'insensitive' } },
        ],
      },
      include: {
        contracts: {
          include: {
            supplyPoint: true,
          },
        },
        documents: identityDocFilter,
      },
    });

    const latestLead = await prisma.lead.findFirst({
      where: {
        AND: [
          leadFilter,
          { vatNumber: { equals: cleanNif, mode: 'insensitive' } },
        ],
      },
      include: {
        documents: identityDocFilter,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Si el agente ya creó un Lead propio para este NIF (aunque aún no tenga Contrato convertido),
    // puede consultar también la ficha Client asociada dentro de su misma marca activa.
    if (!client && latestLead) {
      client = await prisma.client.findFirst({
        where: {
          brandId: activeBrandId,
          vatNumber: { equals: cleanNif, mode: 'insensitive' },
        },
        include: {
          contracts: {
            include: {
              supplyPoint: true,
            },
          },
          documents: identityDocFilter,
        },
      });
    }

    if (!client && !latestLead) {
      return NextResponse.json({ found: false });
    }

    const cupsList = (client?.contracts || [])
      .map((c) => c.supplyPoint)
      .filter((sp, index, self) => sp && self.findIndex((s) => s?.id === sp.id) === index)
      .map((sp) => ({
        id: sp!.id,
        cups: sp!.cups,
        address: sp!.address,
        tariff: sp!.tariff,
      }));

    const cd = (latestLead?.contractData as Record<string, any>) || {};
    const esJuridica =
      client?.clientType === 'JURIDICA' ||
      cd.tipoPersona === 'JURIDICA' ||
      (!/^([0-9XYZ])/i.test(cleanNif) && /^[A-W]/i.test(cleanNif));

    let nombre = '';
    let primerApellido = String(cd.primerApellido || client?.lastName || '').trim();
    let segundoApellido = String(cd.segundoApellido || client?.lastName2 || '').trim();

    if (esJuridica) {
      nombre = String(client?.businessName || latestLead?.businessName || cd.nombre || '').trim();
      primerApellido = '';
      segundoApellido = '';
    } else {
      nombre = String(cd.nombre || client?.firstName || '').trim();
      if (!nombre) {
        const fullName = String(client?.businessName || latestLead?.businessName || '').trim();
        if (fullName && !primerApellido) {
          const parts = fullName.split(/\s+/);
          if (parts.length >= 3) {
            nombre = parts[0];
            primerApellido = parts[1];
            segundoApellido = parts.slice(2).join(' ');
          } else if (parts.length === 2) {
            nombre = parts[0];
            primerApellido = parts[1];
          } else {
            nombre = fullName;
          }
        } else {
          nombre = fullName;
        }
      }
    }

    const displayName =
      client?.businessName ||
      [client?.firstName, client?.lastName].filter(Boolean).join(' ').trim() ||
      latestLead?.businessName ||
      nombre;

    // Documentos reutilizables de identidad / representación (NUNCA factura ni IBAN)
    const combinedDocs = [...(client?.documents || []), ...(latestLead?.documents || [])];
    const findDocUrl = (docType: string): string | null => {
      const match = combinedDocs.find((d) => d.type === docType && d.url);
      return match ? match.url : null;
    };

    const reusableDocs = {
      dniTitular: findDocUrl('DNI'),
      escrituras: findDocUrl('ESCRITURAS'),
      dniApoderado: findDocUrl('DNI_APODERADO') || client?.fileRepresentativeId || null,
    };

    const adicionalClient = [client?.billingFloor, client?.billingDoor, client?.billingAddressAddition]
      .filter(Boolean)
      .join(' ')
      .trim();

    // IMPORTANTE: Por regla de negocio explícita, NUNCA se devuelve ni autocompleta el IBAN ni la Última Factura
    const profile = {
      tipoPersona: esJuridica ? 'JURIDICA' : 'FISICA',
      businessName: nombre,
      primerApellido,
      segundoApellido,
      vatNumber: client?.vatNumber || latestLead?.vatNumber || cleanNif,
      email: String(client?.contactEmail || latestLead?.email || cd.email || '').trim(),
      phone: String(client?.contactPhone || latestLead?.phone || cd.phone || '').trim(),
      tipoVia: String(cd.direccion?.tipoVia || cd.tipoVia || client?.billingStreetType || 'Calle').trim(),
      nombreVia: String(
        cd.direccion?.nombreVia || cd.nombreVia || client?.billingStreet || client?.billingAddress || ''
      ).trim(),
      tipoNumeracion: String(cd.direccion?.tipoNumeracion || cd.tipoNumeracion || 'NÚMERO').trim(),
      numKm: String(cd.direccion?.numKm || cd.numKm || client?.billingNumber || '').trim(),
      adicional: String(cd.direccion?.adicional || cd.adicional || adicionalClient || '').trim(),
      cp: String(cd.direccion?.cp || cd.cp || client?.billingPostalCode || '').trim(),
      poblacion: String(cd.direccion?.poblacion || cd.poblacion || client?.billingCity || '').trim(),
      provincia: String(cd.direccion?.provincia || cd.provincia || client?.billingProvince || '').trim(),
      contactoNombre: String(
        cd.contactoNombre || cd.representativeName || client?.contactName || client?.representativeName || ''
      ).trim(),
      contactoApellidos: String(
        cd.contactoApellidos || cd.representativeLastName || client?.contactLastName || ''
      ).trim(),
      contactoNif: String(
        cd.contactoNif || cd.representativeVat || client?.contactVat || client?.representativeVat || ''
      ).trim(),
      suppliesCount: cupsList.length,
    };

    return NextResponse.json({
      found: true,
      client: {
        id: client?.id || latestLead!.id,
        name: displayName,
        nif: client?.vatNumber || cleanNif,
      },
      cups: cupsList,
      profile,
      reusableDocs,
    });
  } catch (error) {
    console.error('Error searching client by nif:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
