import JSZip from 'jszip';

export interface ExtractedZipItem {
  baseName: string;
  bytes: Uint8Array;
}

const TARGET_RAW_BATCH_BYTES = 10 * 1024 * 1024; // ~10 MB texto plano -> ~1.2 - 1.8 MB comprimido DEFLATE
const MAX_COMPRESSED_BATCH_BYTES = 3.5 * 1024 * 1024; // < 4.5 MB límite serverless Vercel y < 10 MB proxy Next.js

async function compressGroupToSafeBlobs(items: ExtractedZipItem[]): Promise<Blob[]> {
  const zip = new JSZip();
  items.forEach((item, idx) => {
    // Usamos subcarpeta única f{idx}/ para evitar colisiones manteniendo intacto el baseName del archivo
    zip.file(`f${idx}/${item.baseName}`, item.bytes);
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (blob.size <= MAX_COMPRESSED_BATCH_BYTES || items.length <= 1) {
    return [blob];
  }

  const mid = Math.ceil(items.length / 2);
  const left = await compressGroupToSafeBlobs(items.slice(0, mid));
  const right = await compressGroupToSafeBlobs(items.slice(mid));
  return [...left, ...right];
}

/**
 * Descomprime recursivamente un archivo .zip en el navegador (incluyendo ZIPs anidados),
 * filtra únicamente los ficheros relevantes según `matcher` y los re-empaqueta en uno o varios
 * lotes ZIP ligeros (< 3.5 MB cada uno) aptos para subir sin superar límites de Next.js ni Vercel.
 */
export async function prepareFilteredZipBatches(
  file: File,
  matcher: (lowerBaseName: string) => boolean
): Promise<{ matchedCount: number; batches: Blob[]; totalCompressedBytes: number }> {
  const rootBuffer = await file.arrayBuffer();
  const rootZip = await JSZip.loadAsync(rootBuffer);
  const matched: ExtractedZipItem[] = [];

  async function scanZip(zipInstance: JSZip): Promise<void> {
    const paths = Object.keys(zipInstance.files);
    for (const relPath of paths) {
      const entry = zipInstance.files[relPath];
      if (entry.dir) continue;
      if (relPath.includes('__MACOSX')) continue;

      const baseName = relPath.replace(/\\/g, '/').split('/').pop() || relPath;
      const lowerBase = baseName.toLowerCase();
      if (lowerBase.startsWith('._')) continue;

      if (lowerBase.endsWith('.zip')) {
        const innerBytes = await entry.async('uint8array');
        const innerZip = await JSZip.loadAsync(innerBytes);
        await scanZip(innerZip);
      } else if (matcher(lowerBase)) {
        const bytes = await entry.async('uint8array');
        matched.push({ baseName, bytes });
      }
    }
  }

  await scanZip(rootZip);

  if (matched.length === 0) {
    return { matchedCount: 0, batches: [], totalCompressedBytes: 0 };
  }

  const rawGroups: ExtractedZipItem[][] = [];
  let currentGroup: ExtractedZipItem[] = [];
  let currentBytes = 0;

  for (const item of matched) {
    if (currentGroup.length > 0 && currentBytes + item.bytes.byteLength > TARGET_RAW_BATCH_BYTES) {
      rawGroups.push(currentGroup);
      currentGroup = [];
      currentBytes = 0;
    }
    currentGroup.push(item);
    currentBytes += item.bytes.byteLength;
  }
  if (currentGroup.length > 0) {
    rawGroups.push(currentGroup);
  }

  const batches: Blob[] = [];
  for (const group of rawGroups) {
    const blobs = await compressGroupToSafeBlobs(group);
    batches.push(...blobs);
  }

  const totalCompressedBytes = batches.reduce((acc, b) => acc + b.size, 0);
  return {
    matchedCount: matched.length,
    batches,
    totalCompressedBytes,
  };
}

export async function parseJsonResponseSafe(res: Response): Promise<any> {
  const rawText = await res.text();
  try {
    return JSON.parse(rawText);
  } catch {
    if (res.status === 413) {
      throw new Error('El archivo supera el tamaño máximo permitido por el servidor (HTTP 413).');
    }
    throw new Error(
      `Respuesta inesperada del servidor (HTTP ${res.status}): ${rawText.slice(0, 120)}`
    );
  }
}
