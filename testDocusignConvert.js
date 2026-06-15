require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const docusign = require('docusign-esign');

async function testConvert() {
  try {
    const apiClient = new docusign.ApiClient();
    apiClient.setOAuthBasePath('account-d.docusign.com');
    const privateKey = process.env.DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, '\n');

    console.log('Autenticando...');
    const results = await apiClient.requestJWTUserToken(
        process.env.DOCUSIGN_INTEGRATION_KEY,
        process.env.DOCUSIGN_USER_ID,
        ["signature"],
        Buffer.from(privateKey, 'utf-8'),
        3600
    );
    apiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
    apiClient.setBasePath('https://demo.docusign.net/restapi');

    console.log('Creando Envelope Draft con DOCX...');
    const envDef = new docusign.EnvelopeDefinition();
    envDef.emailSubject = "Convert Test";
    
    const docBytes = fs.readFileSync('public/templates/CORE.docx');
    const docBase64 = Buffer.from(docBytes).toString('base64');
    
    const doc = new docusign.Document();
    doc.documentBase64 = docBase64;
    doc.name = "Contrato_Test";
    doc.fileExtension = "docx";
    doc.documentId = "1";
    envDef.documents = [doc];
    envDef.status = "created"; // Draft status

    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    
    const env = await envelopesApi.createEnvelope(accountId, { envelopeDefinition: envDef });
    console.log('Envelope creado:', env.envelopeId);

    console.log('Descargando documento convertido...');
    const pdfBytes = await envelopesApi.getDocument(accountId, env.envelopeId, '1');
    fs.writeFileSync('test.pdf', Buffer.from(pdfBytes, 'binary'));
    console.log('PDF guardado exitosamente.');
    
    // Opcional: intentar borrar o anular
  } catch (err) {
    console.error(err.message || err);
  }
}

testConvert();
