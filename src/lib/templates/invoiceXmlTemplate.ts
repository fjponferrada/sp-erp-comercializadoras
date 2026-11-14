import { getInclusiveEndDate, toMadridIsoDate } from '@/lib/services/internalInvoiceMapper';

function escXml(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateInvoiceXml(data: any): string {
  const powerNodes = (data.powerDetails || [])
    .map(
      (p: any) => `
      <LineaPotencia>
        <Periodo>${escXml(p.period)}</Periodo>
        <PotenciaKW>${Number(p.kw || 0).toFixed(3)}</PotenciaKW>
        <Dias>${Math.round(Number(p.days || 0))}</Dias>
        <PrecioKWDia>${Number(p.price || 0).toFixed(6)}</PrecioKWDia>
        <PeajeEUR>${Number(p.peajeEur || 0).toFixed(2)}</PeajeEUR>
        <CargoEUR>${Number(p.cargoEur || 0).toFixed(2)}</CargoEUR>
        <TotalImporte>${Number(p.total || 0).toFixed(2)}</TotalImporte>
      </LineaPotencia>`
    )
    .join('');

  const atrNodes = (data.energyAtrDetails || [])
    .map(
      (e: any) => `
      <LineaEnergiaATR>
        <Periodo>${escXml(e.period)}</Periodo>
        <KWh>${Number(e.kwh || 0).toFixed(2)}</KWh>
        <PrecioKWh>${Number(e.price || 0).toFixed(6)}</PrecioKWh>
        <PeajeEUR>${Number(e.peajeEur || 0).toFixed(2)}</PeajeEUR>
        <CargoEUR>${Number(e.cargoEur || 0).toFixed(2)}</CargoEUR>
        <TotalImporte>${Number(e.total || 0).toFixed(2)}</TotalImporte>
      </LineaEnergiaATR>`
    )
    .join('');

  const mktNodes = (data.energyMarketDetails || [])
    .map(
      (e: any) => `
      <LineaEnergiaMercado>
        <Periodo>${escXml(e.period)}</Periodo>
        <KWh>${Number(e.kwh || 0).toFixed(2)}</KWh>
        <PrecioKWh>${Number(e.price || 0).toFixed(6)}</PrecioKWh>
        <TotalImporte>${Number(e.total || 0).toFixed(2)}</TotalImporte>
      </LineaEnergiaMercado>`
    )
    .join('');

  const reactiveNodes = (data.reactiveDetails || [])
    .map(
      (r: any) => `
      <LineaEnergiaReactiva>
        <Periodo>${escXml(r.period)}</Periodo>
        <KVArh>${Number(r.kvarh || 0).toFixed(2)}</KVArh>
        <TotalImporte>${Number(r.cost || 0).toFixed(2)}</TotalImporte>
      </LineaEnergiaReactiva>`
    )
    .join('');

  const repercutiblesNodes = (data.conceptosRepercutibles || [])
    .map(
      (c: any) => `
      <ConceptoRepercutible>
        <Codigo>${escXml(c.code)}</Codigo>
        <Descripcion>${escXml(c.description)}</Descripcion>
        <TipoImpositivoCNMC>${escXml(c.taxTypeCode)}</TipoImpositivoCNMC>
        <TotalImporte>${Number(c.total || 0).toFixed(2)}</TotalImporte>
      </ConceptoRepercutible>`
    )
    .join('');

  const svaNodes = (data.svaDetails || [])
    .map(
      (s: any) => `
      <ServicioAdicional>
        <Concepto>${escXml(s.name)}</Concepto>
        <Dias>${Math.round(Number(s.days || 0))}</Dias>
        <PrecioDia>${Number(s.dailyPrice || 0).toFixed(6)}</PrecioDia>
        <TotalImporte>${Number(s.total || 0).toFixed(2)}</TotalImporte>
      </ServicioAdicional>`
    )
    .join('');

  const taxNodes = (data.taxBreakdown || [])
    .map(
      (t: any) => `
      <ImpuestoRepercutido>
        <Tipo>${escXml(t.taxType || data.taxType || 'IVA')}</Tipo>
        <Porcentaje>${Number(t.rate ?? data.taxPercentage ?? 21).toFixed(2)}</Porcentaje>
        <BaseImponible>${Number(t.base ?? data.subtotal1 ?? 0).toFixed(2)}</BaseImponible>
        <Cuota>${Number(t.amount ?? data.taxAmount ?? 0).toFixed(2)}</Cuota>
      </ImpuestoRepercutido>`
    )
    .join('');

  const inclusiveEnd = getInclusiveEndDate(data.billingStart, data.billingEnd);

  return `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica>
  <Cabecera>
    <NumeroFactura>${escXml(data.invoiceNumber || 'BORRADOR')}</NumeroFactura>
    <TipoFactura>${escXml(data.invoiceType || 'Normal')}</TipoFactura>
    <FechaEmision>${escXml(toMadridIsoDate(data.issueDate))}</FechaEmision>
  </Cabecera>
  <Vendedor>
    <Nombre>${escXml(data.companyName || 'Comercializadora Eléctrica')}</Nombre>
    <NIF>${escXml(data.companyCif || '')}</NIF>
    <Direccion>${escXml(data.companyAddress || '')}</Direccion>
  </Vendedor>
  <Comprador>
    <Nombre>${escXml(data.clientName || '')}</Nombre>
    <NIF>${escXml(data.clientNif || '')}</NIF>
    <Direccion>${escXml(data.clientAddress || '')}</Direccion>
    <CUPS>${escXml(data.cups || '')}</CUPS>
    <TarifaAcceso>${escXml(data.tariff || '')}</TarifaAcceso>
  </Comprador>
  <DetalleFactura>
    <Periodo>
      <Inicio>${escXml(toMadridIsoDate(data.billingStart))}</Inicio>
      <Fin>${escXml(toMadridIsoDate(inclusiveEnd))}</Fin>
      <Dias>${Math.round(Number(data.billingDays || 0))}</Dias>
    </Periodo>
    <ConsumoMWh>${Number(data.totalMWh || 0).toFixed(6)}</ConsumoMWh>
    <LineasFacturacion>
      <Potencia>${powerNodes}
      </Potencia>
      <EnergiaATR>${atrNodes}
      </EnergiaATR>
      <EnergiaMercado>${mktNodes}
      </EnergiaMercado>
      <EnergiaReactiva>${reactiveNodes}
      </EnergiaReactiva>
      <Autoconsumo>
        <ExcedentesKWh>${Number(data.excedentesKwh || 0).toFixed(2)}</ExcedentesKWh>
        <CompensacionRD244>${(-Number(data.excedentesAutoconsumo || 0)).toFixed(2)}</CompensacionRD244>
        <LlenadoBolsilloSolar>${Number(data.bolsilloSolarLlenado || 0).toFixed(2)}</LlenadoBolsilloSolar>
        <UsoBolsilloSolar>${Number(data.bolsilloSolarUso || 0).toFixed(2)}</UsoBolsilloSolar>
        <SaldoFinalBolsilloSolar>${Number(data.bolsilloSolarSaldoFinal || 0).toFixed(2)}</SaldoFinalBolsilloSolar>
      </Autoconsumo>
      <OtrosCargos>
        <ExcesosPotencia>${Number(data.excesosPotencia || 0).toFixed(2)}</ExcesosPotencia>
        <EnergiaCapacitiva>${Number(data.capacitiveEnergyCost || 0).toFixed(2)}</EnergiaCapacitiva>
        <PenalizacionNoICP>${Number(data.penalizacionNoIcpCost || 0).toFixed(2)}</PenalizacionNoICP>
        <RecargoInfAnio>${Number(data.recargoInfAnioCost || 0).toFixed(2)}</RecargoInfAnio>
        <InteresesDemora>${Number(data.interesesDemoraCost || 0).toFixed(2)}</InteresesDemora>
        <BonoSocial>${Number(data.bonoSocial || 0).toFixed(2)}</BonoSocial>
        <AlquilerEquipos>${Number(data.alquilerEquipo || 0).toFixed(2)}</AlquilerEquipos>
        <CosteGestionBolsilloSolar>${Number(data.cgBolsilloSolarCost || 0).toFixed(2)}</CosteGestionBolsilloSolar>
        <ServiciosAdicionalesTotal>${Number(data.svaCost || 0).toFixed(2)}</ServiciosAdicionalesTotal>${svaNodes}${repercutiblesNodes}
      </OtrosCargos>
    </LineasFacturacion>
    <Importes>
      <BaseIEE>${Number(data.baseIEE || 0).toFixed(2)}</BaseIEE>
      <ImpuestoElectrico>${Number(data.taxElectric || 0).toFixed(2)}</ImpuestoElectrico>
      <BaseImponible>${Number(data.subtotal1 || 0).toFixed(2)}</BaseImponible>
      <TipoImpuestoIndirecto>${escXml(data.taxType || 'IVA')}</TipoImpuestoIndirecto>
      <PorcentajeImpuesto>${Number(data.taxPercentage ?? 21).toFixed(2)}</PorcentajeImpuesto>
      <ImporteImpuesto>${Number(data.taxAmount || 0).toFixed(2)}</ImporteImpuesto>
      <DesgloseImpuestos>${taxNodes}
      </DesgloseImpuestos>
      <ConceptosExentos>${Number(data.conceptosRepercutiblesExempt || 0).toFixed(2)}</ConceptosExentos>
      <DescuentoBolsilloSolar>${Number(data.bolsilloSolarUso || 0).toFixed(2)}</DescuentoBolsilloSolar>
      <TotalFactura>${Number(data.totalAmount || 0).toFixed(2)}</TotalFactura>
    </Importes>
  </DetalleFactura>
</FacturaElectronica>
`;
}
