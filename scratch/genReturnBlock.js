const fs = require('fs');

const headersRaw = "CONTRATO;EMPRESA;MARCA;CANAL;Tipo;Tipo_c2;Peticion_cliente_c2;Tipo_entrada;Fecha_prevista;Tipo_de_cliente;NOMBRERAZON SOCIAL;Primer Apellido;Segundo Apellido;CIF;DOMICILIO SOC;CP SOC;POBLACION SOC;PROVINCIA SOC;Tlf;Email;CNAE;Captacion_Cliente;Nombre;apellidos;domicilio_cont;cp_cont;poblacion_cont;provincia_cont;tlf_1;tlf2;email_1;factura_si_no;email_factura;Nombre_y_apellidos;En_calidad_de;Dni;Tlf_2;Email_2;DISTRIBUIDORA;codigo_ree_distri;CUPS;DOMICILIO PS;CP PS;POBLACION PS;PROVINCIA PS;duracion;fecha_firma;autoconsumo;autoconsumo_fijo_index;tarifa;consumo_anual;FIJO  INDEX;atr_comer;P1C;P2C;P3C;P4C;P5C;P6C;equipo_distrib;potencias_distri;potencia_boe;un_precio;dias_pago;suspendido;swift;IBAN;P1P;P2P;P3P;P4P;P5P;P6P;P1E;P2E;P3E;P4E;P5E;P6E;plus;cg;dsv;cierre;fee;precio_autoconsumo;gap_autoconsumo;p1p_1;p2p_1;p3p_1;p4p_1;p5p_1;p6p_1;p1e_1;p2e_1;p3e_1;p4e_1;p5e_1;p6e_1;plus_1;cg_1;dsv_1;cierre_1;fee_1;n_cie;DESCUENTO CIE;precio;comision;comision_variable;EFACTURA;Mandato_Doble;Concepto_SVA;Precio_SVA;Duracion_SVA;Fecha_Inicio_SVA;inicio_proceso;fecha_activacion;fecha_baja;FECHA_BAJA_ESTIMADA;GAS INCLUIDO;BOLSILLO SOLAR;CG BOLSILLO SOLAR;p1cd;p2cd;p3cd;p4cd;p5cd;p6cd;isla;up;estado_cups;exento_igic;id_crm;estado;date_expected_end";
const headers = headersRaw.split(';');

const code = fs.readFileSync('src/app/actions/contractActions.ts', 'utf8');

const regex = /return\s+\{([\s\S]*?)\};\s*\}\);\s*return \{ success: true, data: exportData \};/;
const match = code.match(regex);

if (!match) {
  console.log("Could not find the return block.");
  process.exit(1);
}

// We will parse the old headers and values to try to map the new ones
const lines = match[1].split('\n').map(l => l.trim()).filter(l => l.includes(':'));
const mapping = {};
for (const line of lines) {
  const parts = line.split(':');
  const keyRaw = parts.shift().trim();
  const valRaw = parts.join(':').trim().replace(/,$/, '');
  const key = keyRaw.replace(/^"|"$/g, '');
  mapping[key] = valRaw;
}

let newReturnCode = "return {\n";
for (const h of headers) {
  let val = mapping[h];
  if (!val) {
    if (h === 'Tipo_de_cliente') val = "c.client?.clientType === 'EMPRESA' ? 'J' : (c.client?.clientType === 'AUTONOMO' ? 'A' : 'F')";
    else if (h === 'autoconsumo') val = 'c.supplyPoint?.hasSelfConsumption ? "SI" : "NO"';
    else if (h === 'fecha_firma') val = 'formatDate(c.signatureDate) || formatStr(cd["fecha_firma"])';
    else if (h === 'fecha_activacion') val = 'formatDate(c.activationDate) || formatStr(cd["fecha_activacion"])';
    else if (h === 'fecha_baja') val = 'formatDate(c.terminationDate) || formatStr(cd["fecha_baja"])';
    else val = `formatStr(cd["${h}"])`;
  }
  newReturnCode += `        "${h}": ${val},\n`;
}
// remove trailing comma
newReturnCode = newReturnCode.replace(/,\n$/, '\n');
newReturnCode += "      };";

console.log(newReturnCode);
fs.writeFileSync('src/app/actions/contractActions.newReturn.txt', newReturnCode);
