import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isJpeg = buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isPdf = buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    let filename = url.split('/').pop() || 'documento';
    let isSpoofedImage = false;

    if (isJpeg) {
      contentType = 'image/jpeg';
      filename = filename.replace(/\.[^/.]+$/, "") + '.jpg';
      isSpoofedImage = true;
    } else if (isPng) {
      contentType = 'image/png';
      filename = filename.replace(/\.[^/.]+$/, "") + '.png';
      isSpoofedImage = true;
    } else if (isPdf) {
      contentType = 'application/pdf';
      filename = filename.replace(/\.[^/.]+$/, "") + '.pdf';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    
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
