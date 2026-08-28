import { prisma } from '../lib/prisma';

const data = `PRPR257211225KC0F	23/4/2026	A26PEN025	€9,20	€11,14	CARMEN  PEREZ  PEREZ	44371480H
PRPR259181025GF0F	23/4/2026	A26PEN024	€28,94	€35,02	JOSE ANTONIO ARJONA  BAYO	80146634Y
PRPR256111249AK0F	23/4/2026	A26PEN023	€10,47	€12,67	JESSICA MARIA ROLDAN  VALLEJOS	26974905E
PRPR257212516XL0F	23/4/2026	A26PEN022	€8,89	€10,75	CARMEN PEREZ PEREZ	44371480H
PRPR2512291140YV0F	23/4/2026	A26PEN021	€34,15	€41,32	MARIA GERTRUDIS CANILLO IGLESIAS	75019946H
PRPR254151651RN0F	23/4/2026	A26PEN020	€8,26	€9,99	FRANCISCO GALISTEO RAMIREZ	52203156X
PRPR25691745JJ0F	23/4/2026	A26PEN019	€17,70	€21,41	ENCARNACION GARCIA BAENA	34001349N
PRPR25541342RA0F	1/4/2026	A26PEN018	€4,88	€5,90	PEDRO JESUS SANCHEZ SAIZ	30995577H
PRPR262252044TH0F	1/4/2026	A26PEN017	€47,07	€56,96	DOMINGO MANUEL LASTRES PULIDO	80140090V
PRGF254151317YM0F	1/4/2026	A26PEN016	€21,37	€25,86	LUISA JURADO MONJE	30068884H
PRPR2564912BT0F	1/4/2026	A26PEN015	€20,59	€24,91	ROCIO CUENCA VERGARA	25344085V
PRPR256261243SW0F	1/4/2026	A26PEN014	€9,87	€11,94	BIPASA 1618 FAMILY OFFICE SL  	B14949143
PRGF254141254DG0F	1/4/2026	A26PEN013	€30,13	€36,45	PV CASTRO S.L  	B14314405
PRPR25626927MF0F	1/4/2026	A26PEN012	€5,02	€6,08	ANTONIO MANUEL GARCIA JIMENEZ	50623492D
PRPR2512161532HX0F	18/3/2026	A26PEN011	€75,25	€91,06	JAIRO JIMENEZ BENITEZ	76437219P
PRPR25813131GM0F	18/3/2026	A26PEN010	€109,71	€132,75	RUFINO JOSE AREVALO CANTERO	51182395N
PRPR25625109TK0F	13/3/2026	A26PEN009	€11,85	€14,34	PILAR COBO GAROFANO	80116714D
PRPR252141941XQ0F	19/2/2026	A26PEN008	€489,44	€592,23	LA MANZANA DE ADAN EVENTOS S.L  	B14688774
PRJAV2512231930RD0F	16/2/2026	A26PEN007	€21,90	€26,50	RECICLADOS EXTREMEÑOS S.L.  	B06415897
PRJAV2512231930WY0F	16/2/2026	A26PEN006	€288,96	€349,65	RECICLADOS EXTREMEÑOS, SL  	B06415897
PRPR255301325XF0F	27/1/2026	A26PEN005	€7,76	€9,39	ALVARO JESUS ESTEVEZ GUTIERREZ	77646144F
PRJAV2511122034NE0F	27/1/2026	A26PEN004	€34,63	€41,90	FERMIN  CARABALLO SANCHEZ	08681327T
PRPR253271129TD0F	27/1/2026	A26PEN002	€55,80	€67,52	FRANCISCO MANUEL ARIZA MEDINA 	50601392N
PRPR253201321VC0F	27/1/2026	A26PEN001	€17,71	€21,43	JOSE ANTONIO  GARCIA  PULIDO	30832113S`;

function parseEuro(val: string) {
  return parseFloat(val.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
}

function parseDate(val: string) {
  const [day, month, year] = val.split('/');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

async function run() {
  const lines = data.split('\n').filter(l => l.trim() !== '');
  let count = 0;
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const [contractCode, dateStr, invoiceNumber, bipenStr, totalStr, clientName, cif] = parts;
    const issueDate = parseDate(dateStr);
    const bipen = parseEuro(bipenStr);
    const totalAmount = parseEuro(totalStr);

    console.log(`Processing ${invoiceNumber} for contract ${contractCode}...`);

    // Find contract by contractCode (take latest version)
    const contract = await prisma.contract.findFirst({
      where: { contractCode },
      orderBy: { version: 'desc' }
    });

    if (!contract) {
      console.error(`  Contract not found: ${contractCode}`);
      continue;
    }

    // Check if invoice already exists
    const existing = await prisma.penaltyInvoice.findUnique({
      where: { invoiceNumber }
    });

    if (!existing) {
      // Create PenaltyInvoice
      await prisma.penaltyInvoice.create({
        data: {
          invoiceNumber,
          amount: totalAmount,
          issueDate,
          status: 'EMITIDA',
          contractId: contract.id,
          clientId: contract.clientId,
          supplyPointId: contract.supplyPointId,
        }
      });
      console.log(`  -> Created PenaltyInvoice ${invoiceNumber}`);
    } else {
      console.log(`  -> PenaltyInvoice ${invoiceNumber} already exists.`);
    }

    // Update Contract
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        penalization: bipen,
        penaltyStatus: 'FACTURADA'
      }
    });
    console.log(`  -> Updated Contract ${contractCode}`);
    count++;
  }
  
  console.log(`Finished processing ${count} records.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
