import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getBrandContractTemplateDataAction } from '@/app/actions/contractTemplateActions';
import ClauseEditorClient from './ClauseEditorClient';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function BrandContractTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const res = await getBrandContractTemplateDataAction(id);
  if (!res.success || !res.brand || !res.activePayload) {
    if (res.error?.includes('encontrada')) {
      notFound();
    }
    redirect('/marcas');
  }

  return (
    <ClauseEditorClient
      brand={res.brand}
      company={res.company}
      initialPayload={res.activePayload}
      publishedVersion={res.publishedVersion}
      draftVersion={res.draftVersion}
      initialHistory={res.history || []}
    />
  );
}
