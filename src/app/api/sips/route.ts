import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1];
  const isApiKey = token && token === process.env.AED_API_KEY;

  if (!isApiKey) {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const cups = searchParams.get('cups');
  
  if (!cups || cups.length < 20) {
    return NextResponse.json({ success: false, message: 'CUPS inválido (20 caracteres mínimo)' }, { status: 400 });
  }

  try {
    const ingebauKey = process.env.INGEBAU_API_KEY;
    if (!ingebauKey) {
      return NextResponse.json({ success: false, message: 'Falta API Key de SIPS' }, { status: 500 });
    }

    const sipsRes = await fetch(`https://api.ingebau.com/v1/sips/cups/${cups}?API_KEY=${ingebauKey}`);
    
    // Si da 404, es que el CUPS no existe en la distribuidora
    if (sipsRes.status === 404) {
       return NextResponse.json({ success: false, message: 'CUPS no encontrado en SIPS' }, { status: 404 });
    }
    
    if (!sipsRes.ok) {
       return NextResponse.json({ success: false, message: `Error SIPS HTTP ${sipsRes.status}` }, { status: 500 });
    }

    const data = await sipsRes.json();
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Error desconocido al consultar SIPS' }, { status: 500 });
  }
}
