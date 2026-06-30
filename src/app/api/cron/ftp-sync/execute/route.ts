import { NextResponse } from 'next/server';
import { executeFtpSync } from '@/app/api/cron/ftp-sync/route';
import { prisma } from '@/lib/prisma';

export const maxDuration = 300; // Hasta 5 mins en Vercel Pro (10s en Hobby)

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

  const configs = await prisma.distributor.findMany({ where: { ftpActive: true } });
  
  if (configs.length === 0) {
    return NextResponse.json({ error: 'No configs' }, { status: 400 });
  }

  try {
    // Al hacer await aquí, Vercel mantiene viva la función Serverless
    // mientras el cliente siga esperando la respuesta HTTP.
    const { hasMore } = await executeFtpSync(configs, jobId);
    return NextResponse.json({ success: true, hasMore });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
