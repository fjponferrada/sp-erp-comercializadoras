export function generateInvoiceXml(data: any): string {
  // Generador básico de XML de factura. 
  // Esta plantilla es editable para ajustarla al formato oficial FacturaE 3.2.2 o el que uséis.
  return `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica>
  <Cabecera>
    <NumeroFactura>${data.invoiceNumber || 'BORRADOR'}</NumeroFactura>
    <FechaEmision>${data.issueDate ? new Date(data.issueDate).toISOString().split('T')[0] : ''}</FechaEmision>
  </Cabecera>
  <Vendedor>
    <Nombre>Nuestra Comercializadora S.L.</Nombre>
    <NIF>B00000000</NIF>
  </Vendedor>
  <Comprador>
    <Nombre>${data.clientName || ''}</Nombre>
    <NIF>${data.clientNif || ''}</NIF>
  </Comprador>
  <DetalleFactura>
    <Periodo>
      <Inicio>${data.billingStart ? new Date(data.billingStart).toISOString().split('T')[0] : ''}</Inicio>
      <Fin>${data.billingEnd ? new Date(data.billingEnd).toISOString().split('T')[0] : ''}</Fin>
    </Periodo>
    <ConsumoMWh>${data.totalMWh || 0}</ConsumoMWh>
    <Importes>
      <BaseImponible>${data.subtotal1?.toFixed(2) || '0.00'}</BaseImponible>
      <PorcentajeImpuesto>${data.taxPercentage || 21}</PorcentajeImpuesto>
      <ImporteImpuesto>${data.taxAmount?.toFixed(2) || '0.00'}</ImporteImpuesto>
      <TotalFactura>${data.totalAmount?.toFixed(2) || '0.00'}</TotalFactura>
    </Importes>
  </DetalleFactura>
</FacturaElectronica>
`;
}
