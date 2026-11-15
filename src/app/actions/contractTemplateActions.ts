'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  BrandTemplatePayload,
  getDefaultBrandTemplatePayload,
} from '@/lib/contracts/defaultClauses';
import {
  normalizeTemplatePayload,
  resolveBrandAndActiveTemplate,
} from '@/lib/contracts/contractPdfService';

async function authorizeBrandAdminAccess(brandId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('No autenticado.');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { brand: true, companies: { select: { id: true } }, assignedBrands: { select: { id: true } } },
  });

  if (!dbUser || dbUser.isActive === false) {
    throw new Error('Usuario inactivo o no encontrado.');
  }

  if (!['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(dbUser.role)) {
    throw new Error('No tienes permisos para configurar plantillas contractuales.');
  }

  const targetBrand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { company: true },
  });

  if (!targetBrand) {
    throw new Error('Marca comercializadora no encontrada.');
  }

  if (dbUser.role !== 'SUPERADMIN') {
    const allowedCompanyIds = new Set<string>([
      ...(dbUser.brand?.companyId ? [dbUser.brand.companyId] : []),
      ...dbUser.companies.map((c) => c.id),
    ]);
    const allowedBrandIds = new Set<string>([
      dbUser.brandId,
      ...dbUser.assignedBrands.map((b) => b.id),
    ]);
    if (!allowedCompanyIds.has(targetBrand.companyId) && !allowedBrandIds.has(targetBrand.id)) {
      throw new Error('No tienes acceso a esta comercializadora.');
    }
  }

  return { dbUser, targetBrand };
}

export async function getBrandContractTemplateDataAction(brandId: string) {
  try {
    const { targetBrand } = await authorizeBrandAdminAccess(brandId);
    await resolveBrandAndActiveTemplate(targetBrand.id);

    const versions = await prisma.contractTemplateVersion.findMany({
      where: { brandId: targetBrand.id },
      orderBy: { versionNumber: 'desc' },
    });

    const published = versions.find((v) => v.status === 'PUBLISHED') || versions[0] || null;
    const draft = versions.find((v) => v.status === 'DRAFT') || null;
    const activeSource = draft || published;

    return {
      success: true,
      brand: targetBrand,
      company: targetBrand.company,
      activePayload: normalizeTemplatePayload(activeSource),
      publishedVersion: published
        ? {
            id: published.id,
            versionNumber: published.versionNumber,
            name: published.name,
            notes: published.notes,
            publishedAt: published.publishedAt,
          }
        : null,
      draftVersion: draft
        ? {
            id: draft.id,
            versionNumber: draft.versionNumber,
            name: draft.name,
            notes: draft.notes,
            updatedAt: draft.updatedAt,
          }
        : null,
      history: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        name: v.name,
        notes: v.notes,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error cargando plantilla contractual.' };
  }
}

export async function loadSpecificTemplateVersionAction(brandId: string, versionId: string) {
  try {
    await authorizeBrandAdminAccess(brandId);
    const ver = await prisma.contractTemplateVersion.findFirst({
      where: { id: versionId, brandId },
    });
    if (!ver) {
      return { success: false, error: 'Versión no encontrada.' };
    }
    return {
      success: true,
      payload: normalizeTemplatePayload(ver),
      versionNumber: ver.versionNumber,
      name: ver.name,
      status: ver.status,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveContractTemplateDraftAction(
  brandId: string,
  payload: BrandTemplatePayload,
  meta?: { name?: string; notes?: string }
) {
  try {
    const { targetBrand } = await authorizeBrandAdminAccess(brandId);

    const normalizedClauses = (payload.clauses || []).map((c, idx) => ({
      ...c,
      order: idx + 1,
    }));

    const existingDraft = await prisma.contractTemplateVersion.findFirst({
      where: { brandId: targetBrand.id, status: 'DRAFT' },
      orderBy: { versionNumber: 'desc' },
    });

    let saved;
    if (existingDraft) {
      saved = await prisma.contractTemplateVersion.update({
        where: { id: existingDraft.id },
        data: {
          name: meta?.name ?? existingDraft.name,
          notes: meta?.notes ?? existingDraft.notes,
          particularConfigJson: payload.particularConfig as any,
          clausesJson: normalizedClauses as any,
          annexAutoconsumoJson: payload.annexAutoconsumo as any,
          sepaMandateConfigJson: payload.sepaMandateConfig as any,
          summaryConfigJson: payload.summaryConfig as any,
        },
      });
    } else {
      const maxVer = await prisma.contractTemplateVersion.findFirst({
        where: { brandId: targetBrand.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const nextNum = (maxVer?.versionNumber ?? 0) + 1;
      saved = await prisma.contractTemplateVersion.create({
        data: {
          brandId: targetBrand.id,
          versionNumber: nextNum,
          status: 'DRAFT',
          name: meta?.name || `Borrador v${nextNum} - ${targetBrand.name}`,
          notes: meta?.notes || null,
          particularConfigJson: payload.particularConfig as any,
          clausesJson: normalizedClauses as any,
          annexAutoconsumoJson: payload.annexAutoconsumo as any,
          sepaMandateConfigJson: payload.sepaMandateConfig as any,
          summaryConfigJson: payload.summaryConfig as any,
        },
      });
    }

    revalidatePath(`/marcas/${brandId}/plantilla-contrato`);
    return { success: true, versionId: saved.id, versionNumber: saved.versionNumber };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error guardando borrador.' };
  }
}

export async function publishContractTemplateVersionAction(
  brandId: string,
  payload: BrandTemplatePayload,
  meta?: { name?: string; notes?: string }
) {
  try {
    const { dbUser, targetBrand } = await authorizeBrandAdminAccess(brandId);

    const normalizedClauses = (payload.clauses || []).map((c, idx) => ({
      ...c,
      order: idx + 1,
    }));

    const published = await prisma.$transaction(async (tx) => {
      await tx.contractTemplateVersion.updateMany({
        where: { brandId: targetBrand.id, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });

      const existingDraft = await tx.contractTemplateVersion.findFirst({
        where: { brandId: targetBrand.id, status: 'DRAFT' },
        orderBy: { versionNumber: 'desc' },
      });

      if (existingDraft) {
        return tx.contractTemplateVersion.update({
          where: { id: existingDraft.id },
          data: {
            status: 'PUBLISHED',
            name: meta?.name || existingDraft.name || `Condiciones Oficiales ${targetBrand.name} v${existingDraft.versionNumber}`,
            notes: meta?.notes ?? existingDraft.notes,
            particularConfigJson: payload.particularConfig as any,
            clausesJson: normalizedClauses as any,
            annexAutoconsumoJson: payload.annexAutoconsumo as any,
            sepaMandateConfigJson: payload.sepaMandateConfig as any,
            summaryConfigJson: payload.summaryConfig as any,
            publishedAt: new Date(),
            publishedByUserId: dbUser.id,
          },
        });
      }

      const maxVer = await tx.contractTemplateVersion.findFirst({
        where: { brandId: targetBrand.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const nextNum = (maxVer?.versionNumber ?? 0) + 1;

      return tx.contractTemplateVersion.create({
        data: {
          brandId: targetBrand.id,
          versionNumber: nextNum,
          status: 'PUBLISHED',
          name: meta?.name || `Condiciones Oficiales ${targetBrand.name} v${nextNum}`,
          notes: meta?.notes || null,
          particularConfigJson: payload.particularConfig as any,
          clausesJson: normalizedClauses as any,
          annexAutoconsumoJson: payload.annexAutoconsumo as any,
          sepaMandateConfigJson: payload.sepaMandateConfig as any,
          summaryConfigJson: payload.summaryConfig as any,
          publishedAt: new Date(),
          publishedByUserId: dbUser.id,
        },
      });
    });

    revalidatePath('/marcas');
    revalidatePath(`/marcas/${brandId}/plantilla-contrato`);
    return {
      success: true,
      versionId: published.id,
      versionNumber: published.versionNumber,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error publicando versión.' };
  }
}

export async function getFactoryDefaultTemplatePayloadAction(brandId: string) {
  try {
    await authorizeBrandAdminAccess(brandId);
    return { success: true, payload: getDefaultBrandTemplatePayload() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateBrandLegalAndSignatureConfigAction(
  brandId: string,
  config: {
    freePhone900?: string;
    supportEmail?: string;
    withdrawalEmail?: string;
    smsSenderId?: string;
    signatureFlowMode?: string;
    allowQualifiedCertUploadB2B?: boolean;
    envelopeExpirationDays?: number;
    sepaCreditorId?: string;
    dpoEmail?: string;
    jurisdictionCity?: string;
    companyAddress?: string;
    registroMercantil?: string;
  }
) {
  try {
    const { targetBrand } = await authorizeBrandAdminAccess(brandId);

    await prisma.$transaction([
      prisma.brand.update({
        where: { id: targetBrand.id },
        data: {
          freePhone900: config.freePhone900?.trim() || null,
          supportEmail: config.supportEmail?.trim() || targetBrand.supportEmail,
          withdrawalEmail: config.withdrawalEmail?.trim() || null,
          smsSenderId: config.smsSenderId?.trim().slice(0, 11) || null,
          signatureFlowMode:
            config.signatureFlowMode === 'TWO_STEP_SEPARATE_DELIVERY'
              ? 'TWO_STEP_SEPARATE_DELIVERY'
              : 'SEQUENTIAL_SINGLE_LINK',
          allowQualifiedCertUploadB2B: config.allowQualifiedCertUploadB2B ?? true,
          envelopeExpirationDays: Math.max(1, Math.min(60, Number(config.envelopeExpirationDays || 14))),
        },
      }),
      prisma.company.update({
        where: { id: targetBrand.companyId },
        data: {
          sepaCreditorId: config.sepaCreditorId?.trim() || null,
          dpoEmail: config.dpoEmail?.trim() || null,
          jurisdictionCity: config.jurisdictionCity?.trim() || null,
          ...(config.companyAddress !== undefined ? { address: config.companyAddress.trim() || null } : {}),
          ...(config.registroMercantil !== undefined
            ? { registroMercantil: config.registroMercantil.trim() || null }
            : {}),
        },
      }),
    ]);

    revalidatePath('/marcas');
    revalidatePath(`/marcas/${brandId}/plantilla-contrato`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error actualizando configuración legal y de firma.' };
  }
}
