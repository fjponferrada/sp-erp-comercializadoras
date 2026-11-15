import React from 'react';
import { getPublicEnvelopeByTokenAction } from '@/app/actions/signatureActions';
import SigningPortalClient from './SigningPortalClient';

export const dynamic = 'force-dynamic';

export default async function PublicSigningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicEnvelopeByTokenAction(token);

  if (!result.found) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Enlace de firma no encontrado</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            El enlace al que intenta acceder no existe o no es válido. Por favor, revise el último correo electrónico
            enviado por su comercializadora eléctrica o solicite un nuevo envío.
          </p>
        </div>
      </div>
    );
  }

  return <SigningPortalClient token={token} initialEnvelope={result.envelope} />;
}
