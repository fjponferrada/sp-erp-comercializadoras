const AdmZip = require('adm-zip');
const fs = require('fs');
const mainZip = new AdmZip('Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/COMPODEM/9-C3_liquicomun-2025-11-01T00-00-00Z_2026-07-10T23-59-59_datos.zip');
const entry = mainZip.getEntry('C3_liquicomun_202603.zip');
const innerZip = new AdmZip(entry.getData());
console.log(innerZip.getEntries().map(e => e.name));
