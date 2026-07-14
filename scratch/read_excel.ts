import * as xlsx from 'xlsx';

try {
  const filePath = 'Z:\\AED\\AIRTABLE\\Import_facturas\\260709.xlsx';
  const workbook = xlsx.readFile(filePath, { raw: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  
  if (rawData.length > 0) {
    console.log("Total rows:", rawData.length);
    console.log("Headers available:", Object.keys(rawData[0]));
    console.log("First row data:", rawData[0]);
    
    // Test logic from importInvoicesAction
    let errors = 0;
    const errorTypes: Record<string, number> = {};
    
    for (let i = 0; i < rawData.length; i++) {
        const row: any = rawData[i];
        const invoiceNumber = row['Numero Factura'] || row['Número Factura'] || row['NUMERO FACTURA'];
        const cupsRaw = row['CUPS'];
        const cups = cupsRaw ? String(cupsRaw).trim().substring(0, 20) : null;
        const vatNumber = row['CIF'] || row['NIF'] || row['DNI'];
        
        if (!invoiceNumber || !cups) {
            errors++;
            const msg = `Fila sin Numero de Factura o CUPS (CIF: ${vatNumber})`;
            errorTypes[msg] = (errorTypes[msg] || 0) + 1;
        }
    }
    
    console.log("Validation Errors count:", errors);
    console.log("Error Types:", errorTypes);
    
  } else {
    console.log("Empty file");
  }
} catch (error) {
  console.error("Error reading excel:", error);
}
