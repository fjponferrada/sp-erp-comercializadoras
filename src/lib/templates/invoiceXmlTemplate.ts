export function generateInvoiceXml(data: any): string {
  // Generador básico de XML de factura, alineado con FacturaE
  const powerNodes = (data.powerDetails || []).map((p: any) => `
      <LineaPotencia>
        <Periodo>${p.period}</Periodo>
        <PotenciaKW>${p.kw?.toFixed(3)}</PotenciaKW>
        <Dias>${p.days?.toFixed(0)}</Dias>
        <PrecioKWDia>${p.price?.toFixed(6)}</PrecioKWDia>
        <TotalImporte>${p.total?.toFixed(2)}</TotalImporte>
      </LineaPotencia>`).join('');

  const atrNodes = (data.energyAtrDetails || []).map((e: any) => `
      <LineaEnergiaATR>
        <Periodo>${e.period}</Periodo>
        <KWh>${e.kwh?.toFixed(2)}</KWh>
        <PrecioKWh>${e.price?.toFixed(6)}</PrecioKWh>
        <TotalImporte>${e.total?.toFixed(2)}</TotalImporte>
      </LineaEnergiaATR>`).join('');

  const mktNodes = (data.energyMarketDetails || []).map((e: any) => `
      <LineaEnergiaMercado>
        <Periodo>${e.period}</Periodo>
        <KWh>${e.kwh?.toFixed(2)}</KWh>
        <PrecioKWh>${e.price?.toFixed(6)}</PrecioKWh>
        <TotalImporte>${e.total?.toFixed(2)}</TotalImporte>
      </LineaEnergiaMercado>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica>
  <Cabecera>
    <NumeroFactura>${data.invoiceNumber || 'BORRADOR'}</NumeroFactura>
    <TipoFactura>${data.invoiceType || 'NORMAL'}</TipoFactura>
    <FechaEmision>${data.issueDate ? new Date(data.issueDate).toISOString().split('T')[0] : ''}</FechaEmision>
  </Cabecera>
  <Vendedor>
    <Nombre>Nuestra Comercializadora S.L.</Nombre>
    <NIF>B00000000</NIF>
  </Vendedor>
  <Comprador>
    <Nombre>${data.clientName || ''}</Nombre>
    <NIF>${data.clientNif || ''}</NIF>
    <CUPS>${data.cups || ''}</CUPS>
  </Comprador>
  <DetalleFactura>
    <Periodo>
      <Inicio>${data.billingStart ? new Date(data.billingStart).toISOString().split('T')[0] : ''}</Inicio>
      <Fin>${data.billingEnd ? new Date(data.billingEnd).toISOString().split('T')[0] : ''}</Fin>
    </Periodo>
    <ConsumoMWh>${data.totalMWh || 0}</ConsumoMWh>
    <LineasFacturacion>
      <Potencia>${powerNodes}
      </Potencia>
      <EnergiaATR>${atrNodes}
      </EnergiaATR>
      <EnergiaMercado>${mktNodes}
      </EnergiaMercado>
      <OtrosCargos>
        <BonoSocial>${data.bonoSocial?.toFixed(2) || '0.00'}</BonoSocial>
        <AlquilerEquipos>${data.alquilerEquipo?.toFixed(2) || '0.00'}</AlquilerEquipos>
      </OtrosCargos>
    </LineasFacturacion>
    <Importes>
      <BaseImponible>${data.subtotal1?.toFixed(2) || '0.00'}</BaseImponible>
      <ImpuestoElectrico>${data.taxElectric?.toFixed(2) || '0.00'}</ImpuestoElectrico>
      <PorcentajeIVA>${data.taxPercentage || 21}</PorcentajeIVA>
      <ImporteIVA>${data.taxAmount?.toFixed(2) || '0.00'}</ImporteIVA>
      <TotalFactura>${data.totalAmount?.toFixed(2) || '0.00'}</TotalFactura>
    </Importes>
  </DetalleFactura>
</FacturaElectronica>
`;
}
