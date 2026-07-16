import { NextResponse } from 'next/server';
import { getFileStreamFromR2 } from '@/lib/r2';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    let user = '';
    let pass = '';

    // Check Basic Auth
    if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
      const b64 = authHeader.substring(6);
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      [user, pass] = decoded.split(':');
    } else {
      // Check POST Body
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json();
        user = body.user || body.usuario || '';
        pass = body.password || body.contraseña || body.contrasena || '';
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        user = (formData.get('user') || formData.get('usuario') || '') as string;
        pass = (formData.get('password') || formData.get('contraseña') || formData.get('contrasena') || '') as string;
      }

      // Check Query Params if body didn't have it
      if (!user && !pass) {
        const url = new URL(request.url);
        user = url.searchParams.get('user') || url.searchParams.get('usuario') || '';
        pass = url.searchParams.get('password') || url.searchParams.get('contraseña') || url.searchParams.get('contrasena') || '';
      }
    }

    const expectedUser = process.env.CNMC_DOC_USER || 'AED-CNMC';
    const expectedPass = process.env.CNMC_DOC_PASSWORD || 'AED#2024Doc';

    if (!user || !pass || user !== expectedUser || pass !== expectedPass) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Acceso Documentacion CNMC"',
        },
      });
    }

    // Get the requested file from query param
    const url = new URL(request.url);
    const filename = url.searchParams.get('file') || url.searchParams.get('filename');

    if (!filename) {
      return new NextResponse('Missing "file" parameter', { status: 400 });
    }

    // Attempt to download the file from R2
    // We assume the filename might be the full path in R2 or just a file in a generic 'cnmc' folder.
    // For safety, let's strip leading slashes
    const r2Path = filename.replace(/^\/+/, '');

    const { stream, contentType } = await getFileStreamFromR2(r2Path);

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${r2Path.split('/').pop()}"`,
      },
    });

  } catch (error: any) {
    console.error('Error serving CNMC document:', error);
    if (error.name === 'NoSuchKey') {
      return new NextResponse('Document not found', { status: 404 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
