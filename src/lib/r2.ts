import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || '';
const publicUrl = process.env.R2_PUBLIC_URL || '';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Uploads a file buffer to Cloudflare R2 and returns the public URL.
 * @param path The key (path) inside the bucket where the file will be stored.
 * @param fileBuffer The binary content of the file.
 * @param contentType The MIME type of the file.
 * @returns The public URL to access the file.
 */
export async function uploadFileToR2(path: string, fileBuffer: Buffer, contentType: string): Promise<string> {
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME is not configured.');
  }
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: path,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // Return the public URL
  // Remove trailing slashes from publicUrl just in case
  const baseUrl = publicUrl.replace(/\/$/, '');
  return `${baseUrl}/${path}`;
}
