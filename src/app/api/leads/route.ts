import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLeadAction } from '@/app/actions/leadActions';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    const isApiKey = token && token === process.env.AED_API_KEY;

    if (!isApiKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized. API Key is required.' }, { status: 401 });
    }

    const brandId = req.headers.get('x-brand-id');
    if (!brandId) {
      return NextResponse.json({ success: false, error: 'X-Brand-Id header is required.' }, { status: 400 });
    }

    // Buscar un usuario específico tipo CANAL creado para la web (ej. "Captación Web")
    let apiUser = await prisma.user.findFirst({
      where: { 
        brandId: brandId,
        role: 'CANAL',
        name: { contains: 'Web', mode: 'insensitive' }
      }
    });

    // Fallback: Si no han creado el usuario web, coger el primer admin
    if (!apiUser) {
      apiUser = await prisma.user.findFirst({
        where: { brandId: brandId },
        orderBy: { role: 'asc' } // Prioriza SUPERADMIN
      });
    }

    if (!apiUser) {
      return NextResponse.json({ success: false, error: 'No active users found for this brand to assign the lead.' }, { status: 404 });
    }

    const formData = await req.formData();

    // Contexto simulado para el Lead
    const apiContext = {
      userId: apiUser.id,
      brandId: apiUser.brandId,
      allowedAutoTariffs: apiUser.allowedAutoTariffs,
      defaultSource: 'API_ONBOARDING'
    };

    const result = await createLeadAction(formData, apiContext);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in /api/leads:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
