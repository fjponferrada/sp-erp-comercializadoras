import { NextResponse } from 'next/server';
import { auth } from '@/auth';

function isBlockedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '[::1]' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost')
  ) {
    return true;
  }

  // Block private, loopback, and link-local IPv4 ranges (SSRF protection)
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^0\./.test(h)) return true;

  return false;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    if (parsed.protocol !== 'https:' || isBlockedHost(parsed.hostname)) {
      return NextResponse.json({ error: 'Destino no permitido' }, { status: 403 });
    }

    const response = await fetch(parsed.toString(), { redirect: 'follow' });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
    }

    // Re-check final URL after redirects against SSRF
    if (response.url) {
      const finalParsed = new URL(response.url);
      if (finalParsed.protocol !== 'https:' || isBlockedHost(finalParsed.hostname)) {
        return NextResponse.json({ error: 'Redirección no permitida' }, { status: 403 });
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isJpeg = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPng =
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isPdf =
      buffer.length > 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46;

    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    let filename = decodeURIComponent(parsed.pathname.split('/').pop() || 'documento').replace(/["\r\n]/g, '');
    let isSpoofedImage = false;

    if (isJpeg) {
      contentType = 'image/jpeg';
      filename = filename.replace(/\.[^/.]+$/, '') + '.jpg';
      isSpoofedImage = true;
    } else if (isPng) {
      contentType = 'image/png';
      filename = filename.replace(/\.[^/.]+$/, '') + '.png';
      isSpoofedImage = true;
    } else if (isPdf) {
      contentType = 'application/pdf';
      filename = filename.replace(/\.[^/.]+$/, '') + '.pdf';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('X-Content-Type-Options', 'nosniff');

    if (isSpoofedImage) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    }

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error downloading smart file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
