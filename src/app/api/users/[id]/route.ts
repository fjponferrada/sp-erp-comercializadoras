import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  getUserManagementScope,
  isTargetUserInScope,
  ROOT_SUPERADMIN_EMAIL,
  VALID_ROLES,
  type ValidUserRole,
} from '@/lib/userManagementScope';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await getUserManagementScope();
  if (!scope) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        channel: { select: { id: true, brandId: true } },
        companies: { select: { id: true } },
        assignedBrands: { select: { id: true, companyId: true } },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (!isTargetUserInScope(existingUser, scope)) {
      return NextResponse.json(
        { error: 'No tienes permisos para editar usuarios fuera de tus comercializadoras.' },
        { status: 403 }
      );
    }

    const data = await req.json();

    const cleanName = (data.name || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanPassword = (data.password || '').trim();
    const cleanPhone = (data.phone || '').trim() || null;
    const rawCodigo = (data.codigo || '').trim() || null;
    const role: ValidUserRole = VALID_ROLES.includes(data.role) ? data.role : existingUser.role;
    const isActive = data.isActive === undefined ? existingUser.isActive : Boolean(data.isActive);

    if (!cleanName || !cleanEmail) {
      return NextResponse.json({ error: 'Nombre y correo electrónico son obligatorios.' }, { status: 400 });
    }

    if (cleanPassword !== '' && cleanPassword.length < 8) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      );
    }

    if (!scope.isSuperAdmin && role === 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para asignar el rol Superadmin.' },
        { status: 403 }
      );
    }

    // Protección del Superadmin raíz del sistema (Regla 23)
    const isRootSuperadmin = existingUser.email.trim().toLowerCase() === ROOT_SUPERADMIN_EMAIL;
    if (isRootSuperadmin) {
      if (role !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: 'El Superadmin raíz del sistema no puede cambiar de rol.' },
          { status: 400 }
        );
      }
      if (!isActive) {
        return NextResponse.json(
          { error: 'El Superadmin raíz del sistema no puede ser desactivado.' },
          { status: 400 }
        );
      }
    }

    // Protección contra auto-bloqueo del usuario autenticado
    if (existingUser.id === scope.callerId) {
      if (!isActive) {
        return NextResponse.json(
          { error: 'No puedes desactivar tu propia cuenta de usuario.' },
          { status: 400 }
        );
      }
      if (role !== existingUser.role) {
        return NextResponse.json(
          { error: 'No puedes modificar tu propio rol de acceso.' },
          { status: 400 }
        );
      }
    }

    const duplicateEmailUser = await prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: 'insensitive' },
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicateEmailUser) {
      return NextResponse.json({ error: 'Ya existe otro usuario con ese email.' }, { status: 400 });
    }

    const allowedBrandSet = scope.allowedBrandIds ? new Set(scope.allowedBrandIds) : null;
    const allowedCompanySet = scope.allowedCompanyIds ? new Set(scope.allowedCompanyIds) : null;

    // Si edita un COMPANYADMIN y el usuario compartido tenía marcas/empresas de otra comercializadora, las preservamos intactas
    const preservedExternalBrandIds = allowedBrandSet
      ? existingUser.assignedBrands.filter((b) => !allowedBrandSet.has(b.id)).map((b) => b.id)
      : [];
    const preservedExternalCompanyIds = allowedCompanySet
      ? existingUser.companies.filter((c) => !allowedCompanySet.has(c.id)).map((c) => c.id)
      : [];

    let primaryBrandId: string = existingUser.brandId;
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
      primaryBrandId = data.brandId || submittedBrandIds[0] || existingUser.brandId;
    } else if (role === 'CLIENT') {
      finalCodigo = null;
      const requestedBrandId =
        data.brandId ||
        (Array.isArray(data.assignedBrandIds) ? data.assignedBrandIds[0] : null) ||
        existingUser.brandId;

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
        finalBrandIds = Array.from(new Set([channel.brandId, ...preservedExternalBrandIds]));
        finalCompanyIds = Array.from(
          new Set([
            ...(channel.brand?.companyId ? [channel.brand.companyId] : []),
            ...preservedExternalCompanyIds,
          ])
        );
      } else {
        // Comercial directo sin canal (puede quedar con 0 marcas si se le revoca acceso deliberadamente)
        const submittedBrandIds: string[] = Array.isArray(data.assignedBrandIds) ? data.assignedBrandIds : [];
        if (allowedBrandSet && submittedBrandIds.some((bId) => !allowedBrandSet.has(bId))) {
          return NextResponse.json({ error: 'Has seleccionado marcas fuera de tu alcance.' }, { status: 403 });
        }
        const brands =
          submittedBrandIds.length > 0
            ? await prisma.brand.findMany({
                where: { id: { in: submittedBrandIds } },
                select: { id: true, companyId: true },
              })
            : [];

        // Si edita un COMPANYADMIN y el usuario compartido pertenecía a un canal externo fuera de su alcance, lo preservamos
        if (
          allowedBrandSet &&
          existingUser.channel?.brandId &&
          !allowedBrandSet.has(existingUser.channel.brandId)
        ) {
          finalChannelId = existingUser.channel.id;
          finalIsSupervisor = existingUser.isChannelSupervisor;
        }

        finalBrandIds = Array.from(new Set([...brands.map((b) => b.id), ...preservedExternalBrandIds]));
        finalCompanyIds = Array.from(
          new Set([...brands.map((b) => b.companyId), ...preservedExternalCompanyIds])
        );
        if (finalBrandIds.length > 0) {
          primaryBrandId =
            data.brandId && finalBrandIds.includes(data.brandId) ? data.brandId : finalBrandIds[0];
        }
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

      const selectedBrands =
        submittedBrandIds.length > 0
          ? await prisma.brand.findMany({
              where: { id: { in: submittedBrandIds } },
              select: { id: true, companyId: true },
            })
          : [];

      finalBrandIds = Array.from(new Set([...selectedBrands.map((b) => b.id), ...preservedExternalBrandIds]));
      finalCompanyIds = Array.from(
        new Set([
          ...submittedCompanyIds,
          ...selectedBrands.map((b) => b.companyId),
          ...preservedExternalCompanyIds,
        ])
      );

      if (finalBrandIds.length > 0) {
        primaryBrandId =
          data.brandId && finalBrandIds.includes(data.brandId) ? data.brandId : finalBrandIds[0];
      } else if (role === 'COMPANYADMIN' && finalCompanyIds.length > 0) {
        const fallbackBrand = await prisma.brand.findFirst({
          where: {
            companyId: { in: finalCompanyIds },
            ...(allowedBrandSet ? { id: { in: Array.from(allowedBrandSet) } } : {}),
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        if (fallbackBrand) primaryBrandId = fallbackBrand.id;
      }
    }

    const updateData: any = {
      name: cleanName,
      email: cleanEmail,
      role,
      isActive,
      phone: cleanPhone,
      codigo: finalCodigo,
      isChannelSupervisor: finalIsSupervisor,
      brand: { connect: { id: primaryBrandId } },
      channel: finalChannelId ? { connect: { id: finalChannelId } } : { disconnect: true },
      assignedBrands: {
        set: finalBrandIds.map((bId) => ({ id: bId })),
      },
      companies: {
        set: finalCompanyIds.map((cId) => ({ id: cId })),
      },
    };

    if (cleanPassword !== '') {
      updateData.password = await bcrypt.hash(cleanPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      omit: { password: true },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Error interno al actualizar usuario' },
      { status: 500 }
    );
  }
}
