import jwt from 'jsonwebtoken';

/**
 * Autentica mediante JWT en DocuSign y devuelve el Access Token.
 */
export async function getDocuSignAccessToken(): Promise<string> {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const rsaKeyRaw = process.env.DOCUSIGN_PRIVATE_KEY;
  const oauthBasePath = process.env.DOCUSIGN_OAUTH_BASE_PATH || 'account-d.docusign.com';

  if (!integrationKey || !userId || !rsaKeyRaw) {
    throw new Error('Faltan credenciales de DocuSign en .env (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY)');
  }

  // Handle newlines if stored as single line string in .env
  const rsaKey = rsaKeyRaw.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: oauthBasePath,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation'
  };

  const token = jwt.sign(payload, rsaKey, { algorithm: 'RS256' });

  try {
    const response = await fetch(`https://${oauthBasePath}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      }).toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error authenticating with DocuSign JWT:', errorText);
      throw new Error('Error al autenticar con DocuSign JWT.');
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error in DocuSign JWT fetch:', error);
    throw new Error('Error al autenticar con DocuSign.');
  }
}

export async function createAndSendEnvelope(
  contractId: string,
  pdfBuffer: Buffer,
  signerName: string,
  signerEmail: string,
  documentName: string,
  emailBlurb?: string,
  signerPhone?: string
): Promise<string> {
  const accessToken = await getDocuSignAccessToken();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

  if (!accountId) {
    throw new Error('Falta DOCUSIGN_ACCOUNT_ID en .env');
  }

  // Preparamos el teléfono si existe
  let cleanPhone = undefined;
  if (signerPhone) {
    cleanPhone = signerPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('34') && cleanPhone.length === 11) {
      cleanPhone = cleanPhone.substring(2);
    }
  }

  // Construimos el Payload exacto como en Make.com, saltándonos las clases del SDK
  // ya que la versión del SDK en Node a veces pierde propiedades como additionalNotifications
  const payload: any = {
    status: 'sent',
    brandId: '054b84c4-93c5-48be-b130-9c62e9b1e973', // Marca visual de AED Energía idéntica a Make
    emailSubject: documentName,
    emailBlurb: emailBlurb || '',
    documents: [
      {
        documentBase64: pdfBuffer.toString('base64'),
        name: documentName,
        fileExtension: 'pdf',
        documentId: '1'
      }
    ],
    recipients: {
      signers: [
        {
          email: signerEmail,
          name: signerName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                xPosition: '200',
                yPosition: '600'
              }
            ]
          }
        }
      ]
    },
    customFields: {
      textCustomFields: [
        {
          name: 'ContractId',
          value: contractId,
          required: 'false',
          show: 'false'
        }
      ]
    }
  };

  // Inyectamos la notificación por SMS si hay teléfono válido
  if (cleanPhone) {
    payload.recipients.signers[0].additionalNotifications = [
      {
        secondaryDeliveryMethod: 'SMS',
        phoneNumber: {
          countryCode: '34',
          number: cleanPhone
        }
      }
    ];
  }

  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  const endpoint = `${basePath}/v2.1/accounts/${accountId}/envelopes`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creating DocuSign Envelope via native fetch:', errorText);
      throw new Error(`Error DocuSign: ${errorText}`);
    }

    const result = await response.json();
    return result.envelopeId;
  } catch (error: any) {
    console.error('Excepción al enviar a DocuSign:', error);
    throw new Error('Error de conexión al enviar el contrato a DocuSign.');
  }
}
