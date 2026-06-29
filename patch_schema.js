const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Helper to inject a line before the closing brace of a model
function addToModel(modelName, newField) {
  const regex = new RegExp(`(model ${modelName} \\{[^}]*)(\\})`, 'm');
  schema = schema.replace(regex, `$1  ${newField}\n$2`);
}

addToModel('Client', 'internalInvoices InternalInvoice[]');
addToModel('Company', 'internalInvoices InternalInvoice[]');
addToModel('Contract', 'internalInvoices InternalInvoice[]');
addToModel('SupplyPoint', 'internalInvoices InternalInvoice[]');
addToModel('F1Invoice', 'internalInvoices InternalInvoice[]');

const newModel = `
enum InternalInvoiceStatus {
  BORRADOR
  EMITIDA
  ABONO
}

model InternalInvoice {
  id                 String                @id @default(cuid())
  invoiceNumber      String?
  status             InternalInvoiceStatus @default(BORRADOR)
  invoiceType        String?
  clientId           String
  companyId          String?
  rectifiedInvoiceId String?
  contractId         String?
  supplyPointId      String?
  f1InvoiceId        String?
  issueDate          DateTime
  paymentDate        DateTime?
  subtotal1          Float?
  taxPercentage      Float?
  taxAmount          Float?
  totalAmount        Float
  totalMWh           Float
  margin             Float?
  billingStart       DateTime?
  billingEnd         DateTime?
  origin             String?
  pdfUrl             String?
  communicatedAt     DateTime?
  invoiceData        Json?
  createdAt          DateTime              @default(now())
  
  client             Client                @relation(fields: [clientId], references: [id])
  company            Company?              @relation(fields: [companyId], references: [id])
  contract           Contract?             @relation(fields: [contractId], references: [id])
  invoice            InternalInvoice?      @relation("InternalInvoiceToInternalInvoice", fields: [rectifiedInvoiceId], references: [id])
  otherInvoices      InternalInvoice[]     @relation("InternalInvoiceToInternalInvoice")
  supplyPoint        SupplyPoint?          @relation(fields: [supplyPointId], references: [id])
  f1Invoice          F1Invoice?            @relation(fields: [f1InvoiceId], references: [id])

  @@unique([invoiceNumber, companyId])
}
`;

schema += newModel;

fs.writeFileSync(schemaPath, schema);
console.log("Schema patched successfully!");
