import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  getUserManagementScope,
  VALID_ROLES,
  type ValidUserRole,
} from '@/lib/userManagementScope';

export async function POST(req: Request) {
  const scope = await getUserManagementScope();
  if (!scope) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const data = await req.json();

    const cleanName = (data.name || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanPassword = (data.password || '').trim();
    const cleanPhone = (data.phone || '').trim() || null;
    const rawCodigo = (data.codigo || '').trim() || null;
    const role: ValidUserRole = VALID_ROLES.includes(data.role) ? data.role : 'COMERCIAL';
    const isActive = data.isActive === undefined ? true : Boolean(data.isActive);

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { error: 'Nombre, correo electrónico y contraseña son obligatorios.' },
        { status: 400 }
      );
    }

    if (cleanPassword.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      );
    }

    if (!scope.isSuperAdmin && role === 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para crear usuarios con rol Superadmin.' },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 400 });
    }

    const allowedBrandSet = scope.allowedBrandIds ? new Set(scope.allowedBrandIds) : null;
    const allowedCompanySet = scope.allowedCompanyIds ? new Set(scope.allowedCompanyIds) : null;

    let primaryBrandId: string | null = null;
    let finalBrandIds: string[] = [];
    let finalCompanyIds: string[] = [];
    let finalChannelId: string | null = null;
    let finalIsSupervisor = false;
    let finalCodigo: string | null = rawCodigo;

    if (role === 'SUPERADMIN') {
      const submittedBrandIds: string[] = Array.isArray(data.assignedBrandIds) ? data.assignedBrandIds : [];
      const submittedCompanyIds: string[] = Array.isArray(data.assignedCompanyIds) ? data.assignedCompanyIds : [];
      finalBrandIds = submittedBrandIds;
      finalCompanyIds = submittedCompanyIds;
      primaryBrandId =
        data.brandId ||
        submittedBrandIds[0] ||
        (await prisma.brand.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }))?.id ||
        null;
    } else if (role === 'CLIENT') {
      finalCodigo = null;
      const requestedBrandId =
        data.brandId || (Array.isArray(data.assignedBrandIds) ? data.assignedBrandIds[0] : null);

      if (!requestedBrandId) {
        return NextResponse.json(
          { error: 'Debes seleccionar la marca a la que pertenece el cliente.' },
          { status: 400 }
        );
      }
      if (allowedBrandSet && !allowedBrandSet.has(requestedBrandId)) {
        return NextResponse.json({ error: 'No tienes permisos sobre la marca seleccionada.' }, { status: 403 });
      }
      const brandExists = await prisma.brand.findUnique({
        where: { id: requestedBrandId },
        select: { id: true },
      });
      if (!brandExists) {
        return NextResponse.json({ error: 'La marca seleccionada no existe.' }, { status: 400 });
      }
      primaryBrandId = brandExists.id;
    } else if (role === 'CANAL' || role === 'COMERCIAL') {
      if (role === 'CANAL' && !data.channelId) {
        return NextResponse.json(
          { error: 'El rol Jefe de Canal requiere seleccionar obligatoriamente un Canal de Ventas.' },
          { status: 400 }
        );
      }

      if (data.channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: data.channelId },
          include: { brand: { select: { id: true, companyId: true } } },
        });
        if (!channel || !channel.brandId) {
          return NextResponse.json({ error: 'El canal seleccionado no es válido.' }, { status: 400 });
        }
        if (allowedBrandSet && !allowedBrandSet.has(channel.brandId)) {
          return NextResponse.json({ error: 'No tienes permisos sobre el canal seleccionado.' }, { status: 403 });
        }

        finalChannelId = channel.id;
        finalIsSupervisor = Boolean(data.isChannelSupervisor);
        primaryBrandId = channel.brandId;
        finalBrandIds = [channel.brandId];
        finalCompanyIds = channel.brand?.companyId ? [channel.brand.companyId] : [];
      } else {
        // Comercial directo sin canal
        const submittedBrandIds: string[] = Array.isArray(data.assignedBrandIds) ? data.assignedBrandIds : [];
        if (submittedBrandIds.length === 0) {
          return NextResponse.json(
            { error: 'Selecciona un canal o al menos una marca autorizada para el comercial.' },
            { status: 400 }
          );
        }
        if (allowedBrandSet && submittedBrandIds.some((bId) => !allowedBrandSet.has(bId))) {
          return NextResponse.json({ error: 'Has seleccionado marcas fuera de tu alcance.' }, { status: 403 });
        }
        const brands = await prisma.brand.findMany({
          where: { id: { in: submittedBrandIds } },
          select: { id: true, companyId: true },
        });
        if (brands.length === 0) {
          return NextResponse.json({ error: 'Marcas seleccionadas no válidas.' }, { status: 400 });
        }
        finalBrandIds = brands.map((b) => b.id);
        finalCompanyIds = Array.from(new Set(brands.map((b) => b.companyId)));
        primaryBrandId =
          data.brandId && finalBrandIds.includes(data.brandId) ? data.brandId : finalBrandIds[0];
      }
    } else {
      // COMPANYADMIN o BACKOFFICE
      const submittedCompanyIds: string[] = Array.isArray(data.assignedCompanyIds) ? data.assignedCompanyIds : [];
      const submittedBrandIds: string[] = Array.isArray(data.assignedBrandIds) ? data.assignedBrandIds : [];

      if (allowedCompanySet && submittedCompanyIds.some((cId) => !allowedCompanySet.has(cId))) {
        return NextResponse.json(
          { error: 'Has seleccionado comercializadoras fuera de tu alcance.' },
          { status: 403 }
        );
      }
      if (allowedBrandSet && submittedBrandIds.some((bId) => !allowedBrandSet.has(bId))) {
        return NextResponse.json({ error: 'Has seleccionado marcas fuera de tu alcance.' }, { status: 403 });
      }

      if (role === 'BACKOFFICE') {
        if (submittedBrandIds.length === 0) {
          return NextResponse.json(
            { error: 'El rol Backoffice requiere seleccionar al menos una marca autorizada.' },
            { status: 400 }
          );
        }
        const brands = await prisma.brand.findMany({
          where: { id: { in: submittedBrandIds } },
          select: { id: true, companyId: true },
        });
        finalBrandIds = brands.map((b) => b.id);
        finalCompanyIds = Array.from(
          new Set([...submittedCompanyIds, ...brands.map((b) => b.companyId)])
        );
        primaryBrandId =
          data.brandId && finalBrandIds.includes(data.brandId) ? data.brandId : finalBrandIds[0];
      } else {
        // COMPANYADMIN
        if (submittedCompanyIds.length === 0 && submittedBrandIds.length === 0) {
          return NextResponse.json(
            { error: 'El Responsable de Empresa requiere al menos una comercializadora asignada.' },
            { status: 400 }
          );
        }
        const selectedBrands =
          submittedBrandIds.length > 0
            ? await prisma.brand.findMany({
                where: { id: { in: submittedBrandIds } },
                select: { id: true, companyId: true },
              })
            : [];

        finalCompanyIds = Array.from(
          new Set([...submittedCompanyIds, ...selectedBrands.map((b) => b.companyId)])
        );
        finalBrandIds = selectedBrands.map((b) => b.id);

        if (finalBrandIds.length > 0) {
          primaryBrandId =
            data.brandId && finalBrandIds.includes(data.brandId) ? data.brandId : finalBrandIds[0];
        } else {
          const fallbackBrand = await prisma.brand.findFirst({
            where: {
              companyId: { in: finalCompanyIds },
              ...(allowedBrandSet ? { id: { in: Array.from(allowedBrandSet) } } : {}),
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
          primaryBrandId = fallbackBrand?.id || null;
        }
      }
    }

    if (!primaryBrandId) {
      return NextResponse.json(
        { error: 'No se pudo determinar una marca principal válida para el usuario.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role,
        isActive,
        brand: { connect: { id: primaryBrandId } },
        ...(finalChannelId ? { channel: { connect: { id: finalChannelId } } } : {}),
        phone: cleanPhone,
        codigo: finalCodigo,
        isChannelSupervisor: finalIsSupervisor,
        assignedBrands:
          finalBrandIds.length > 0
            ? { connect: finalBrandIds.map((id) => ({ id })) }
            : undefined,
        companies:
          finalCompanyIds.length > 0
            ? { connect: finalCompanyIds.map((id) => ({ id })) }
            : undefined,
      },
      omit: { password: true },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Error interno al crear usuario' }, { status: 500 });
  }
}
