import fs from 'fs';
import path from 'path';

async function testUpload() {
  const filePath = "C:\\Scrapping\\Temp_Downloads\\I-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U\\F1\\GRCW_I-DE Redes Eléctricas Inteligentes, S.A.U._AED ENERG╓A ELÉCTRICA, S.L._F1_0110_9.xml";
  const CRM_URL = "https://ultra.sp-energia.com";
  const WORKER_TOKEN = "AED-SCRAPING-WORKER-2026"; // from route.ts

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/xml' });
    
    const formData = new FormData();
    formData.append('file', fileBlob, path.basename(filePath));

    const uploadResponse = await fetch(`${CRM_URL}/api/cron/scraping-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKER_TOKEN}`
      },
      body: formData
    });

    const responseText = await uploadResponse.text();
    console.log(`Status: ${uploadResponse.status}`);
    console.log(`Body: ${responseText}`);
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}

testUpload();
