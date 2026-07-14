const fetch = require('node-fetch');

async function triggerWebhook() {
  const payload = {
    event: 'envelope-completed',
    data: {
      envelopeId: 'a1e0fb16-f2b7-8272-81dc-f67239c88638',
      envelopeSummary: {
        status: 'completed',
        completedDateTime: new Date().toISOString()
      }
    }
  };

  const res = await fetch('https://ultra.sp-energia.com/api/webhooks/docusign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const responseText = await res.text();
  console.log('Webhook Response:', res.status, responseText);
}

triggerWebhook();
