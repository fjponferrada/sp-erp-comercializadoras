import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const ghostColumns = [
    'ipP1', 'ipP2', 'ipP3', 'ipP4', 'ipP5', 'ipP6',
    'p1c', 'p2c', 'p3c', 'p4c', 'p5c', 'p6c',
    'p1pDaily', 'p2pDaily', 'p3pDaily', 'p4pDaily', 'p5pDaily', 'p6pDaily',
    'p1eActual', 'p2eActual', 'p3eActual', 'p4eActual', 'p5eActual', 'p6eActual',
    'errorTariff', 'errorProductTariff', 'errorVat', 'errorSelfConsumption', 'errorCnae', 'errorCp', 'errorPostal',
    'sipsCnae', 'sipsPostalCode', 'sipsTariff', 'sipsLastModDate', 'sipsUpdateOwnScript', 'sipsUpdateIngebauScript', 'sipsUpdateIngebau', 'sipsSelfConsCode',
    'firstName', 'lastName', 'contactEmail2', 'contactEmail3', 'contactName', 'contactLastName', 'contactRole', 'contactVat', 'iban', 'paymentMethod', 'paperInvoice', 'invoiceDelivery',
    'fee', 'pexc', 'signatureType', 'docusignEnvelopeId', 'isB2B', 'hasPanels', 'comments', 'offerDate', 'priceService', 'priceServiceActual', 'cups2', 'lastInvoiceUrl', 'generateDraft', 'verificationReq', 'remakeDraft', 'triggerDuplicate', 'wpName', 'tramitationType', 'mandateDouble'
  ];

  const results: Record<string, number> = {};
  console.log('Checking ghost columns for existing data...');

  for (const col of ghostColumns) {
    const count = await prisma.lead.count({
      where: {
        [col]: { not: null }
      }
    });
    if (count > 0) {
      results[col] = count;
    }
  }

  console.log('Results (Columns with data):');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
