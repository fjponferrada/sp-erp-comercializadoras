import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config();

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

async function testR2() {
  try {
    const originalName = 'GRCW_I-DE Redes Eléctricas Inteligentes, S.A.U._AED ENERG╓A ELÉCTRICA, S.L._F1_0110_9.xml';
    const standardizedName = `${originalName.replace('.xml', '')}_${Date.now()}.xml`;
    const r2Key = `switching/recibidos/F1/${standardizedName}`;

    console.log(`Intentando subir a R2 con Key: ${r2Key}`);

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'aed-energia',
      Key: r2Key,
      Body: 'test',
      ContentType: 'application/xml',
    }));

    console.log('R2 Upload OK');
  } catch (err: any) {
    console.error('R2 Upload Exception:', err.name, err.message);
  }
}

testR2();
