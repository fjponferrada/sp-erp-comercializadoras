import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getFileStreamFromR2 } from '@/lib/r2';
import { prisma } from '@/lib/prisma';

function safeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function normalizeRequestedR2Path(rawInput: string): string | null {
  let cleaned = rawInput.trim();
  if (!cleaned) return null;

  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // Keep original if already decoded or contains literal %
  }

  // Strip public R2 base URL if full URL was passed in ?file=
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (publicBase && cleaned.startsWith(publicBase)) {
    cleaned = cleaned.slice(publicBase.length);
  } else if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      cleaned = parsed.pathname;
    } catch {
      return null;
    }
  }

  cleaned = cleaned.replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..') || cleaned.includes('\\') || cleaned.includes('\0')) {
    return null;
  }
  return cleaned;
}

async function isAuthorizedTechnicalDocument(r2Path: string): Promise<boolean> {
  const lower = r2Path.toLowerCase();
  // Explicitly forbid internal ERP switching XMLs, invoices, and private signed contract folders
  if (
    lower.startsWith('switching/') ||
    lower.startsWith('invoices/') ||
    lower.startsWith('facturas/') ||
    lower.startsWith('contratos/') ||
    lower.startsWith('anexos/')
  ) {
    return false;
  }

  // Explicit CNMC / CIE attachment folders are always allowed
  if (
    lower.startsWith('cnmc/') ||
    lower.startsWith('cie/') ||
    lower.startsWith('reclamaciones/')
  ) {
    return true;
  }

  // Also allow technical documents explicitly registered in Document or SupplyPoint CIE fields
  const [docMatch, spMatch] = await Promise.all([
    prisma.document.findFirst({
      where: {
        type: { notIn: ['CONTRATO_FIRMADO', 'ANEXO_FIRMADO', 'FACTURA'] },
        OR: [
          { url: r2Path },
          { url: `/${r2Path}` },
          { url: { endsWith: `/${r2Path}` } },
        ],
      },
      select: { id: true },
    }),
    prisma.supplyPoint.findFirst({
      where: {
        OR: [
          { fileCie: r2Path },
          { fileCie: { endsWith: `/${r2Path}` } },
          { fileCieSelfConsump: r2Path },
          { fileCieSelfConsump: { endsWith: `/${r2Path}` } },
        ],
      },
      select: { id: true },
    }),
  ]);

  return Boolean(docMatch || spMatch);
}

async function handleDocumentRequest(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    let user = '';
    let pass = '';

    // 1. Check HTTP Basic Auth (handling passwords with colons safely)
    if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
      const b64 = authHeader.substring(6).trim();
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        user = decoded.slice(0, colonIdx);
        pass = decoded.slice(colonIdx + 1);
      }
    }

    // 2. Check POST body only on POST requests if Basic Auth wasn't provided
    if (!user && !pass && request.method === 'POST') {
      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        user = String(body.user || body.usuario || '');
        pass = String(body.password || body.contraseña || body.contrasena || '');
      } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
      ) {
        const formData = await request.formData().catch(() => null);
        if (formData) {
          user = String(formData.get('user') || formData.get('usuario') || '');
          pass = String(formData.get('password') || formData.get('contraseña') || formData.get('contrasena') || '');
        }
      }
    }

    // 3. Fallback to query parameters (?user=...&password=...) embedded in CNMC XML <DireccionUrl>
    const url = new URL(request.url);
    if (!user && !pass) {
      user = url.searchParams.get('user') || url.searchParams.get('usuario') || '';
      pass = url.searchParams.get('password') || url.searchParams.get('contraseña') || url.searchParams.get('contrasena') || '';
    }

    const expectedUser = process.env.CNMC_DOC_USER || 'AED-CNMC';
    const expectedPass = process.env.CNMC_DOC_PASSWORD || 'AED#2024Doc';

    if (!user || !pass || !safeStringEquals(user, expectedUser) || !safeStringEquals(pass, expectedPass)) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Acceso Documentacion CNMC"',
        },
      });
    }

    const rawFilename = url.searchParams.get('file') || url.searchParams.get('filename') || '';
    if (!rawFilename) {
      return new NextResponse('Missing "file" parameter', { status: 400 });
    }

    const r2Path = normalizeRequestedR2Path(rawFilename);
    if (!r2Path) {
      return new NextResponse('Invalid file path', { status: 400 });
    }

    const allowed = await isAuthorizedTechnicalDocument(r2Path);
    if (!allowed) {
      return new NextResponse('Forbidden document scope', { status: 403 });
    }

    const { stream, contentType } = await getFileStreamFromR2(r2Path);
    const safeDownloadName = (r2Path.split('/').pop() || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeDownloadName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('Error serving CNMC document:', error);
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      return new NextResponse('Document not found', { status: 404 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleDocumentRequest(request);
}

export async function POST(request: Request) {
  return handleDocumentRequest(request);
}
