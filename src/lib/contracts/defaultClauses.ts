export type ClauseVisibilityScope =
  | 'ALL'
  | 'CONSUMER_ONLY'
  | 'B2B_ONLY'
  | 'FIXED_ONLY'
  | 'INDEXED_ONLY'
  | 'SELF_CONSUMPTION_ONLY'
  | 'SOLAR_WALLET_ONLY';

export interface ContractClauseItem {
  id: string;
  order: number;
  title: string;
  body: string;
  visibilityScope: ClauseVisibilityScope;
  enabled: boolean;
}

export interface ParticularConditionsConfig {
  invoiceDeliveryNote: string;
  paperInvoiceFeeLabel: string;
  sepaCoreAuthNote: string;
  sepaB2BAuthNote: string;
  fixedPriceGuaranteeText: string;
  indexedIntroText: string;
  indexedFormulaExpression: string;
  indexedFormulaLegend: string;
  indexedSwitchToFixedNote: string;
  renewalText: string;
  penaltyLowVoltageText: string;
  penaltyHighVoltageText: string;
  adminFeeConsumerText: string;
  adminFeeB2BText: string;
  indexedPenaltyValuationNote: string;
  takeOrPayScope?: 'B2B_ONLY' | 'ALL' | 'DISABLED';
  takeOrPayText: string;
  taxesAndRegulatedText: string;
  regulatoryPassThroughText: string;
  greenCommitmentText: string;
  tramitationRightsNote: string;
  renewalTransitionNote: string;
  bonoSocialConsumerNote: string;
}

export interface AnnexAutoconsumoConfig {
  alwaysIncludeAnnex: boolean;
  surplusValuationIntro: string;
  surplusFormulaExpression: string;
  surplusFormulaLegend: string;
  compensationConditionsText: string;
  solarWalletIntro: string;
  solarWalletConditionsText: string;
}

export interface SepaMandateConfig {
  creditorReferenceNote: string;
  coreAuthorizationText: string;
  b2bAuthorizationText: string;
  includeBothInB2B: boolean;
}

export interface SummaryDocumentConfig {
  headerLegalSubtitle: string;
  withdrawalRightConsumerText: string;
  withdrawalRightB2BText: string;
  bonoSocialWarningText: string;
  claimsAndSupportText: string;
  priceTransparencyNote: string;
}

export interface BrandTemplatePayload {
  particularConfig: ParticularConditionsConfig;
  clauses: ContractClauseItem[];
  annexAutoconsumo: AnnexAutoconsumoConfig;
  sepaMandateConfig: SepaMandateConfig;
  summaryConfig: SummaryDocumentConfig;
}

export const CLAUSE_VISIBILITY_LABELS: Record<ClauseVisibilityScope, string> = {
  ALL: 'Todos los contratos (CORE y B2B)',
  CONSUMER_ONLY: 'Solo Consumidores / SEPA CORE (Particular)',
  B2B_ONLY: 'Solo Empresas y Autónomos (B2B)',
  FIXED_ONLY: 'Solo Modalidad Precio Fijo / Mixto',
  INDEXED_ONLY: 'Solo Modalidad Precio Indexado',
  SELF_CONSUMPTION_ONLY: 'Solo con Autoconsumo',
  SOLAR_WALLET_ONLY: 'Solo con Bolsillo Solar / Batería Virtual',
};

export const AVAILABLE_TEMPLATE_VARIABLES: Array<{ token: string; label: string; example: string }> = [
  { token: '{{company.name}}', label: 'Razón Social Comercializadora', example: 'AED ENERGÍA ELÉCTRICA S.L.' },
  { token: '{{company.shortName}}', label: 'Nombre Corto / Acrónimo', example: 'AED' },
  { token: '{{company.cif}}', label: 'CIF Comercializadora', example: 'B-10915544' },
  { token: '{{company.address}}', label: 'Domicilio Social Comercializadora', example: 'Av. Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba' },
  { token: '{{company.registroMercantil}}', label: 'Datos Registro Mercantil', example: 'Registro Mercantil de Córdoba, Tomo 2858, Folio 61, Hoja CO-43825' },
  { token: '{{company.dpoEmail}}', label: 'Email Delegado Protección Datos (DPD)', example: 'dpd@aed-energia.es' },
  { token: '{{company.jurisdictionCity}}', label: 'Fuero / Juzgados Domicilio Social (B2B)', example: 'Córdoba' },
  { token: '{{brand.name}}', label: 'Nombre Comercial Marca', example: 'AED Energía' },
  { token: '{{brand.supportEmail}}', label: 'Email Atención al Cliente', example: 'clientes@aed-energia.com' },
  { token: '{{brand.withdrawalEmail}}', label: 'Email Desistimiento / Bajas', example: 'clientes@aed-energia.com' },
  { token: '{{brand.freePhone900}}', label: 'Teléfono Gratuito Atención Cliente', example: '900 525 826' },
  { token: '{{brand.domain}}', label: 'Dominio / Oficina Virtual', example: 'www.aed-energia.com' },
];

export const DEFAULT_PARTICULAR_CONFIG: ParticularConditionsConfig = {
  invoiceDeliveryNote:
    'Por defecto, las facturas se envían por correo electrónico a la dirección de contacto del titular del contrato.',
  paperInvoiceFeeLabel: '3,50 € / factura',
  sepaCoreAuthNote:
    'El Titular autoriza a {{company.name}} a enviar instrucciones de cobro a su entidad bancaria, y a esta última a efectuar dichos cargos en su cuenta. El Titular tiene derecho a solicitar a su banco el reembolso del adeudo en un plazo máximo de ocho semanas desde la fecha del cargo, conforme a las condiciones pactadas con su entidad.',
  sepaB2BAuthNote:
    'El Titular autoriza a {{company.name}} y a su entidad bancaria a gestionar y efectuar los correspondientes adeudos en su cuenta, operando indistintamente bajo el esquema SEPA CORE o SEPA B2B.',
  fixedPriceGuaranteeText:
    'Garantía de Precio Fijo Real: Los precios pactados incluyen de forma definitiva los costes de los servicios de ajuste del sistema (SSAA). {{brand.name}} asume íntegramente el riesgo de su variación, garantizando expresamente que no aplicará ningún recargo, tope o sobrecoste adicional al Cliente por este concepto, sin importar los incrementos del Operador del Sistema.',
  indexedIntroText:
    'El importe a facturar se calculará multiplicando el consumo horario en el punto frontera por el precio indexado de cada hora. Dicho precio resultará de sumar los costes del mercado diario e incurridos en el sistema según la normativa vigente (OMIE, ajustes, pagos por capacidad, peajes, desvíos, FNEE, tasas aplicables, costes financieros y remuneración comercial). Para Canarias y Baleares, el coste de energía se sustituye por el coste de adquisición de la demanda (sphDEM).',
  indexedFormulaExpression:
    'Ph = [ [(OMIEh + SSAAh + PC + ROM + ROS + DSV)*(1+Perd) + FNEE + FEE]*1/0,985 + ATR]',
  indexedFormulaLegend:
    'En €/MWh: OMIEh=Precio horario de casación de energía en mercado diario de OMIE - SSAAh=Servicios de ajuste del sistema y procesos del Operador del Sistema (OS) - PC=Pago por capacidad vigente - ROM y ROS=Remuneración de los operadores del mercado (OMIE) y del sistema (REE), respectivamente - FNEE=Aportación al Fondo Nacional de Eficiencia Energética - Perd=Coeficiente de pérdidas de las redes de transporte y distribución - ATR=Término de energía de los peajes y cargos de acceso a la red - DSV=Coste de los desvíos horarios - FEE=Coste de gestión (margen comercial y costes operativos de {{company.shortName}}) - 1/0,985=Factor de repercusión de la Tasa Municipal (1,5%).',
  indexedSwitchToFixedNote:
    'Nota: El Cliente con producto INDEXADO podrá solicitar en cualquier momento el cambio a una tarifa de precio fijo, aplicándose las ofertas vigentes de {{company.shortName}} en ese momento y mediando un preaviso mínimo de 30 días.',
  renewalText:
    'El contrato se prorrogará automáticamente por períodos de un año, salvo que alguna de las partes comunique su voluntad de no renovarlo con al menos 30 días naturales de antelación.',
  penaltyLowVoltageText:
    'En Baja Tensión: el 5% del importe de la energía estimada pendiente de suministrar al precio contratado.',
  penaltyHighVoltageText:
    'En Alta Tensión (6.X TD): 30 € por cada MWh estimado pendiente de suministrar. IMPORTANTE: Para estas tarifas, cada prórroga automática anual conlleva un nuevo compromiso de permanencia por el mismo periodo renovado.',
  adminFeeConsumerText:
    '4,99 € (25,00 € en altas nuevas) si la baja ocurre en los primeros 15 días y el titular no es un consumidor particular; los consumidores particulares dispondrán de 14 días de desistimiento gratuito, abonando solo el consumo y los costes regulados incurridos.',
  adminFeeB2BText:
    '4,99 € (25,00 € en altas nuevas) si la baja ocurre en los primeros 15 días.',
  indexedPenaltyValuationNote:
    'Nota: En productos indexados, la energía se valorará según la cotización de cierre de MEFF del día anterior a la resolución.',
  takeOrPayScope: 'B2B_ONLY',
  takeOrPayText:
    'Cláusula Take or Pay: El cliente asume el compromiso de consumir al menos el 80% de la energía estimada para su periodo de suministro. Si al finalizar el año (o cualquiera de sus prórrogas), así como en la fecha de una baja anticipada, el consumo real acumulado fuera inferior al 80% de la estimación correspondiente a dicho periodo temporal, se facturará la energía no consumida hasta alcanzar dicho umbral a razón de 30 €/MWh.',
  taxesAndRegulatedText:
    'Los precios indicados no incluyen impuestos. A la facturación se le añadirá:\n• El Impuesto Eléctrico y los impuestos indirectos correspondientes (IVA/IGIC) según la Comunidad Autónoma.\n• La cuota de financiación del Bono Social vigente en cada momento para cada CUPS.\n• El coste derivado de cualquier mecanismo de ajuste del gas o del mercado mayorista que pudiera establecer la Administración.',
  regulatoryPassThroughText:
    'Los precios pactados estarán sujetos a cualquier cambio normativo. Se trasladará íntegra y automáticamente al cliente cualquier variación (al alza o a la baja) que apruebe la Administración sobre peajes de acceso, cargos, cánones, impuestos o nuevos conceptos regulados durante la vigencia del contrato.',
  greenCommitmentText:
    '{{brand.name}} garantiza que el 100% de la energía eléctrica comercializada bajo este contrato proviene de fuentes de generación renovable, respaldada mediante el Sistema de Garantías de Origen (GdOs). Para maximizar la eficiencia y evitar sobrecostes repercutibles al Cliente, {{brand.name}} realiza la adquisición y gestión de estas garantías a nivel global de compañía frente a la CNMC (Etiqueta A). En consecuencia, el Cliente tendrá derecho a recibir anualmente y sin coste adicional un Certificado Corporativo Oficial emitido por {{brand.name}}, que acredita el origen 100% verde de su volumen total de consumo, con plena validez para sus auditorías ambientales y reportes de sostenibilidad, no procediéndose a la redención individualizada por CUPS.',
  tramitationRightsNote:
    'Gestión de Alta y Derechos Regulados: En casos de alta nueva, reactivación de suministro o aumento de potencia, {{brand.name}} repercutirá al Cliente de forma íntegra todos los derechos regulados (acceso, extensión, enganche y/o verificación) que la Empresa Distribuidora liquide a {{brand.name}} según la normativa vigente.',
  renewalTransitionNote:
    'En caso de Renovación o Modificación de un CUPS que ya estaba siendo suministrado por {{brand.name}} a la fecha de firma del presente contrato, este nuevo Contrato entrará en vigor al día siguiente de finalizar el contrato vigente para este suministro, sustituyéndolo definitivamente (salvo las obligaciones de pago pendientes). Si el contrato anterior ya hubiera finalizado, entrará en vigor en la fecha de firma. Dado que los ciclos de facturación los fija la distribuidora, si un ciclo abarca días de ambos contratos, se aplicarán las condiciones del contrato anterior a todo ese ciclo.',
  bonoSocialConsumerNote:
    'En cumplimiento de la normativa vigente, {{brand.name}} informa al Cliente de la existencia del Bono Social eléctrico para consumidores vulnerables, gestionado exclusivamente por las Comercializadoras de Referencia en el mercado regulado (PVPC). El Cliente reconoce haber sido expresamente informado de que la formalización del presente contrato en el mercado libre es incompatible con dicho mecanismo y conlleva la renuncia y pérdida automática del Bono Social, en caso de que lo tuviera concedido previamente. Puede obtener más información sobre los requisitos y tramitación del Bono Social en www.bonosocial.gob.es.',
};

export const DEFAULT_CLAUSES: ContractClauseItem[] = [
  {
    id: 'cl-01-objeto',
    order: 1,
    title: 'OBJETO DEL CONTRATO',
    visibilityScope: 'ALL',
    enabled: true,
    body: `1.1. El presente contrato regula las Condiciones Generales por las cuales {{company.name}} (en adelante "{{company.shortName}}") se obliga a suministrar energía eléctrica en el punto de suministro (CUPS) titularidad del CLIENTE en la dirección indicada en Condiciones Particulares, y éste se obliga a abonar a {{company.shortName}} la energía eléctrica suministrada conforme a los términos y condiciones del presente Contrato.

1.2. La entrega de la energía eléctrica se entenderá efectuada cuando ésta sea puesta a disposición del CLIENTE en el punto de suministro, donde le serán transferidos la titularidad, el riesgo y la responsabilidad respecto de la misma.

1.3. El CLIENTE declara ser persona física, persona jurídica o autónomo que contrata el suministro en el ámbito de su actividad particular, comercial, profesional o empresarial. Asimismo, el CLIENTE deberá ser el efectivo usuario de la energía eléctrica suministrada, no pudiendo cederla, enajenarla o ponerla a disposición de terceros sin el consentimiento expreso de {{company.shortName}}.`,
  },
  {
    id: 'cl-02-duracion',
    order: 2,
    title: 'DURACIÓN',
    visibilityScope: 'ALL',
    enabled: true,
    body: `2.1. Salvo que se acuerde otro periodo en las Condiciones Particulares, el presente Contrato tendrá una duración de un (1) año desde la fecha de comienzo del suministro. El Contrato se prorrogará automáticamente por periodos anuales, salvo que alguna de las Partes comunique su intención de no prorrogarlo con al menos treinta días de antelación a su fecha fin ordinaria o de cualquiera de sus prórrogas, sin perjuicio de lo previsto en la cláusula 4.5 del RD 1435/2002, de 27 de diciembre para el periodo de prórroga de suministros en baja tensión. Las partes acuerdan que {{company.shortName}} podrá notificar al CLIENTE unas nuevas condiciones económicas de aplicación al periodo de prórroga con un mes de antelación a la fecha fin del Contrato o de sus posteriores prórrogas, las cuales serán efectivas si el CLIENTE no manifiesta su oposición a las mismas con al menos quince días de antelación al comienzo del periodo de prórroga.

2.2. En cualquiera de los casos, el inicio de la prestación del suministro por parte de {{company.shortName}} quedará supeditado al cumplimiento de todas las condiciones que se indican a continuación:
a) Que el equipo de medida del CLIENTE cumpla los requisitos técnicos y de seguridad conforme a la normativa vigente.
b) Que el CLIENTE se encuentre al corriente en el pago del suministro eléctrico; a estos efectos autoriza a {{company.shortName}} para efectuar dicha verificación con el anterior comercializador.
c) Que se haya producido la entrada en vigor del Contrato Técnico de Acceso de Terceros a la Red (en adelante "Contrato ATR" o "Contrato de Acceso") con la Empresa Distribuidora. Si {{company.shortName}} gestionase en nombre del CLIENTE la solicitud del Contrato ATR y éste se anulase por causa imputable al mismo, {{company.shortName}} le podrá repercutir los costes derivados de dicha anulación. En caso de que fuese el CLIENTE el responsable de tramitar el Contrato ATR con la Empresa Distribuidora, éste debe comunicar a {{company.shortName}} la fecha de comienzo del suministro con al menos 3 días de antelación al inicio de la prestación del servicio. En caso de no recibir dicha comunicación, {{company.shortName}} no asumirá responsabilidad alguna al respecto.
d) Que el CLIENTE abone el depósito de garantía, si éste fuera exigido por la Empresa Distribuidora en la contratación del ATR.
e) Que de las comprobaciones que en su caso efectúe {{company.shortName}} sobre el riesgo de crédito del CLIENTE se deduzca una solvencia suficiente para cumplir con sus obligaciones de pago del suministro. Si como resultado de dicha comprobación se deduce un riesgo de impago por el CLIENTE, {{company.shortName}} podrá rechazar la activación del Contrato, condicionar la prestación del suministro a la presentación por el CLIENTE de un aval a primer requerimiento otorgado por una entidad bancaria calificada como investment grade o el cambio a una modalidad de pago por anticipado. El CLIENTE se compromete a entregar a {{company.shortName}} el aval o pago anticipado que le sea requerido en un plazo máximo de 5 días naturales previos a la fecha estimada de inicio de suministro indicada en Condiciones Particulares.

Si llegada la fecha de inicio del suministro no se hubiesen cumplido todas las condiciones referidas, {{company.shortName}} podrá rechazar la activación del Contrato y por ende su resolución, sin necesidad de justificación y sin derecho a indemnización alguna para el CLIENTE.`,
  },
  {
    id: 'cl-03-prevision-consumo',
    order: 3,
    title: 'PREVISIÓN DE CONSUMO',
    visibilityScope: 'ALL',
    enabled: true,
    body: `El CLIENTE informará a {{company.shortName}} de la Previsión de Consumo en el punto de suministro correspondiente a la duración del Contrato, indicando a tal efecto su consumo anual en Condiciones Particulares. Asimismo, el CLIENTE deberá comunicar a la mayor brevedad cualquier modificación relevante que afecte a la energía consumida de la red.`,
  },
  {
    id: 'cl-04-autorizaciones-atr',
    order: 4,
    title: 'AUTORIZACIONES Y ACCESO A LA RED DE DISTRIBUCIÓN',
    visibilityScope: 'ALL',
    enabled: true,
    body: `4.1. En el caso de que así se haya solicitado por el CLIENTE en Condiciones Particulares, éste autoriza a {{company.shortName}} para que, actuando en nombre y por cuenta del CLIENTE, solicite y suscriba el correspondiente Contrato ATR con la Empresa Distribuidora para el punto de suministro objeto de Contrato. Asimismo, la firma de este Contrato supone la autorización del CLIENTE a {{company.shortName}} para que ésta realice ante la Empresa Distribuidora cuantas gestiones sean necesarias para el buen fin del suministro y para la notificación y cancelación del Contrato que con anterioridad pudiera tener con otra comercializadora. El CLIENTE deberá facilitar a {{company.shortName}} la información o documentación necesaria para contratar en nombre del CLIENTE el Contrato ATR.

4.2. El Cliente consiente expresamente y autoriza a {{company.shortName}} a llevar a cabo las modificaciones del ATR suscrito con la empresa distribuidora que, a juicio de {{company.shortName}}, sean convenientes para la reducción de los costes del presente Contrato, tales como la modificación de la potencia contratada, la modificación de la tarifa de acceso, la de los equipos de medida, y el cambio de titularidad del Contrato, entre otros supuestos. La viabilidad de dichas modificaciones podrá operar como condición para la aceptación del Contrato y la activación del suministro.

4.3. Será exclusiva responsabilidad del CLIENTE el pago de los costes relativos al Contrato ATR, sin perjuicio de que {{company.shortName}} pueda satisfacerlos por adelantado en su nombre. Igualmente será exclusiva responsabilidad del CLIENTE el pago del depósito de garantía que en su caso fuese exigido por la Empresa Distribuidora; si {{company.shortName}} hubiese satisfecho por adelantado este importe procederá a facturarlo al CLIENTE y, en caso de finalización del Contrato, éste será el titular de dicho depósito de garantía.

4.4. Si fuese el CLIENTE quien formalizase directamente el Contrato ATR con la Empresa Distribuidora, éste se compromete a tramitarlo con la antelación suficiente para que el suministro pueda empezar en la fecha acordada en Condiciones Particulares y comunicará a la Empresa Distribuidora que {{company.shortName}} será su comercializadora. Asimismo, el CLIENTE deberá comunicar previamente a {{company.shortName}} todo cambio solicitado a la Empresa Distribuidora; en caso contrario {{company.shortName}} podrá, a su elección, actualizar el Precio o resolver el Contrato.`,
  },
  {
    id: 'cl-05-modificaciones-potencia',
    order: 5,
    title: 'MODIFICACIONES DE POTENCIA Y/O TARIFA',
    visibilityScope: 'ALL',
    enabled: true,
    body: `5.1. En caso de que fuese {{company.shortName}} quien formalizase el Contrato ATR en nombre del CLIENTE y éste desee modificar la potencia y/o tarifa contratada, deberá solicitarlo a {{company.shortName}} con objeto de que ésta tramite dicha solicitud ante la Empresa Distribuidora. Si fuese el CLIENTE quien hubiese contratado el ATR directamente con la Empresa Distribuidora, deberá comunicarlo a {{company.shortName}} para que tenga constancia de dicho cambio. En cualquier caso, dicha modificación está condicionada a la concesión por parte de la Empresa Distribuidora de la nueva potencia y/o tarifa.

5.2. {{company.shortName}} no asume responsabilidad por el rechazo o retraso de la Empresa Distribuidora en tramitar la modificación solicitada por el CLIENTE ni por el sometimiento de dicha modificación por parte de la Empresa Distribuidora a cualquier actuación requerida al CLIENTE que entrañe un coste económico para este último, incluidas las modificaciones técnicas necesarias que pudieran ser requeridas por la Empresa Distribuidora.

5.3. {{company.shortName}} estará facultada para realizar las modificaciones de potencia y tarifa que sean necesarias a los efectos de activar el producto contratado por el Cliente. Salvo mención expresa en las Condiciones Particulares, el coste de los derechos de enganche o de actuación en la medida para dicha modificación de potencia y tarifa será asumido por {{company.shortName}}, excepto en el supuesto en el que el Cliente resuelva el Contrato dentro del año inmediatamente posterior a dicha modificación, en cuyo caso será éste quien asuma tal coste.`,
  },
  {
    id: 'cl-06-equipo-medida',
    order: 6,
    title: 'EQUIPO DE MEDIDA Y CONTROL',
    visibilityScope: 'ALL',
    enabled: true,
    body: `6.1. El CLIENTE deberá tener instalado un Equipo de Medida y Control que cumpla con la normativa aplicable, siendo el CLIENTE responsable de su custodia, buen uso y del cumplimiento del resto de obligaciones establecidas por la legislación vigente. El CLIENTE deberá notificar de inmediato cualquier incidencia que detecte en el funcionamiento del equipo de medida y no manipularlo; asimismo, deberá permitir en todo momento el acceso al equipo de medida a la Empresa Distribuidora y en su caso a {{company.shortName}}, a los efectos de realizar lecturas, verificaciones y actuaciones que sean necesarias para asegurar su debido mantenimiento o adecuación a modificaciones contractuales.

6.2. La Empresa Distribuidora es la responsable de realizar las lecturas de los consumos de energía bien directamente o a través de entidades autorizadas, quien las pondrá a disposición de {{company.shortName}} para su facturación al CLIENTE. En el supuesto de que {{company.shortName}} no dispusiera de los datos de lectura antes de la finalización del Periodo de Facturación, el CLIENTE faculta a {{company.shortName}} a facturar una cantidad estimada que se regularizará en cuanto la Empresa Distribuidora traslade las lecturas para dicho periodo.`,
  },
  {
    id: 'cl-07-calidad-suministro',
    order: 7,
    title: 'CALIDAD DE SUMINISTRO',
    visibilityScope: 'ALL',
    enabled: true,
    body: `7.1. De conformidad con lo previsto en la Ley 24/2013 del Sector Eléctrico y el Real Decreto 1955/2000 de 1 de diciembre o normativa que lo sustituya, la Empresa Distribuidora con la cual el CLIENTE tiene contratado el Acceso de Terceros a la Red (Contrato ATR) es la responsable de la operación y mantenimiento de la red y de la calidad del suministro. {{company.shortName}} no será en ningún caso responsable de la falta de calidad de suministro o de los daños que pudieran producirse al CLIENTE o terceros por interrupciones, cortes de suministro, bajadas de tensión, etc., debiendo dirigir el CLIENTE cualquier reclamación derivada de defectuosa calidad del suministro a la Empresa Distribuidora con la cual tenga el Contrato ATR. En ningún caso podrá el CLIENTE reclamar responsabilidad alguna a {{company.shortName}} por obligaciones que legalmente corresponden a la Empresa Distribuidora; no obstante, {{company.shortName}} se compromete a colaborar con el CLIENTE, a su requerimiento y en la medida de lo posible, en la reclamación que presente ante la Empresa Distribuidora.

7.2. En aquellos casos en que la Empresa Distribuidora incumpla los valores para la continuidad del suministro y aplique los correspondientes descuentos en la facturación de conformidad con lo establecido en el Real Decreto 1955/2000, éstos serán trasladados al CLIENTE en la posterior factura que se emita tras su percepción por parte de la Empresa Distribuidora.`,
  },
  {
    id: 'cl-08-obligaciones-partes',
    order: 8,
    title: 'OBLIGACIONES DE LAS PARTES',
    visibilityScope: 'ALL',
    enabled: true,
    body: `8.1. El CLIENTE se compromete a pagar el suministro eléctrico prestado por {{company.shortName}} conforme a las condiciones del presente Contrato y a cumplir los términos acordados en el mismo; por su parte {{company.shortName}} se compromete a suministrar la energía eléctrica en el Punto de Suministro titularidad del CLIENTE y en su caso a formalizar en nombre del CLIENTE el Contrato ATR, en las condiciones establecidas en la normativa aplicable y en el presente Contrato.

8.2. Durante la vigencia del presente Contrato y sus sucesivas prórrogas, el CLIENTE deberá tener la solvencia económica suficiente para cumplir con sus obligaciones de pago del suministro eléctrico. A tal efecto, {{company.shortName}} podrá realizar periódicamente análisis del riesgo de crédito del CLIENTE; en caso de que durante la relación contractual {{company.shortName}} deduzca que ha habido un deterioro que pueda suponer un riesgo para cumplir con sus obligaciones contractuales, {{company.shortName}} podrá requerir al CLIENTE la presentación de un aval a primer requerimiento otorgado por una entidad bancaria calificada como investment grade, el cambio a una modalidad de pago anticipado, o resolver el presente contrato sin indemnización alguna para el CLIENTE.`,
  },
  {
    id: 'cl-09-precio-facturacion-pago',
    order: 9,
    title: 'PRECIO, FACTURACIÓN, PAGO Y MODIFICACIÓN DE CONDICIONES',
    visibilityScope: 'ALL',
    enabled: true,
    body: `9.1. El CLIENTE se compromete a pagar el suministro eléctrico prestado por {{company.shortName}} conforme a los términos y condiciones acordados en el presente Contrato. El Precio será el indicado en las Condiciones Particulares; adicionalmente serán trasladados y a cargo del CLIENTE:
a) Los gastos que originen los trabajos de enganche, extensión, reconexión, verificación u otros derechos de acometida necesarios para un nuevo suministro o para la ampliación o reconexión del ya existente, así como otros normativamente establecidos y que deban pagarse a la Empresa Distribuidora. Asimismo, el CLIENTE asumirá las refacturaciones o facturaciones complementarias trasladadas por la Empresa Distribuidora o aquellas que realice {{company.shortName}} en caso de haber realizado facturaciones estimadas. Igualmente se trasladará automáticamente al CLIENTE cualquier garantía de pago solicitada por la Empresa Distribuidora.
b) El I.V.A., I.G.I.C. (o impuesto que geográficamente sea de aplicación), el impuesto especial sobre la electricidad, las tasas, cargos e impuestos que correspondan, los cuales se aplicarán sobre el Precio.
c) Si el CLIENTE tuviese derecho a una reducción o exención de la base del impuesto eléctrico de conformidad con la normativa que regula los impuestos especiales, para su aplicación deberá remitir a {{company.shortName}} a la mayor brevedad la Tarjeta de Inscripción en el Registro Territorial con el Código de Identificación de la Electricidad (CIE). En tal caso, el CLIENTE se compromete a comunicar a {{company.shortName}} cualquier cambio que pueda afectar a la percepción de tal derecho.
d) Cualquier otro no incluido expresamente en Condiciones Particulares derivado de cambios técnicos, regulatorios o fiscales que supongan un nuevo componente en el precio del suministro eléctrico o modifiquen los existentes, en cuyo caso no tendrán la consideración de modificación contractual.

9.2. Cualquier cambio que afecte a precios, términos o conceptos asociados al suministro eléctrico diferentes a los referidos en la cláusula anterior, o que suponga algún coste adicional en la actividad de comercialización de energía eléctrica o implique un desequilibrio de la contraprestación entre las partes respecto al momento de firma del Contrato, será de aplicación lo previsto en la cláusula 14.6 de modificaciones contractuales. El precio de este Contrato está basado en la hipótesis de un precio medio de mercado mayorista OMIE en 0,065 €/kWh, por lo que un precio medio superior a 0,095 €/kWh o inferior a 0,035 €/kWh durante dos meses consecutivos será considerado un desequilibrio entre las Partes.

9.3. El precio de la energía se podrá actualizar anualmente de acuerdo al Índice General de Precios al Consumo (IPC) publicado por el Instituto Nacional de Estadística.

9.4. Con carácter mensual o bimensual, {{company.shortName}} emitirá al CLIENTE la correspondiente factura por el servicio de suministro, así como cualquier otro concepto adeudado por el CLIENTE derivado de la prestación del servicio. {{company.shortName}} realizará la facturación de acuerdo a las lecturas de consumo facilitadas por la Empresa Distribuidora, si bien queda facultada a realizar una estimación con la mejor medida disponible o basándose en consumos de años o meses precedentes en caso de que la Empresa Distribuidora no trasladase dichos datos o no estuvieran a su disposición, procediendo en tal caso a realizar las regularizaciones oportunas una vez la distribuidora traslade las lecturas para dicho periodo.

9.5. En el plazo de un día, {{company.shortName}} procederá a cargar el importe de la factura en la cuenta bancaria que el CLIENTE haya indicado en la Orden de domiciliación anexa.

9.6. En el caso de producirse dos o más devoluciones consecutivas o alternas por impago de las facturas remitidas a la cuenta bancaria comunicada, el cobro dejará de ser domiciliado y se enviará la factura a la dirección (en su caso, electrónica) facilitada por el Cliente para su pago en cualquiera de las entidades y modalidades que se señalen en las distintas comunicaciones de {{company.shortName}}. Las facturas no abonadas en su totalidad en las fechas previstas por causas no imputables a {{company.shortName}} tendrán la consideración de deuda vencida.

9.7. La facturación será electrónica. A tal efecto el Cliente recibirá su factura en el correo electrónico que haya facilitado para facturación, teniendo igualmente acceso a las mismas a través de su Oficina Virtual en {{brand.domain}}. El CLIENTE puede revocar en cualquier momento el consentimiento prestado a la recepción de la factura electrónica y comenzar a recibir las facturas en soporte papel, conforme a las condiciones indicadas en Condiciones Particulares.

9.8. El impago total o parcial de cualquier factura fuera del plazo acordado o el retraso en su abono devengará automáticamente y sin necesidad de requerimiento previo los intereses de demora sobre las cantidades no satisfechas desde la fecha en que debió realizarse el pago hasta la fecha de su efectivo abono, aplicándose los intereses de demora e indemnización por costes de cobro previstos en la Ley 3/2004 de 29 de diciembre de lucha contra la morosidad en las operaciones comerciales o norma que lo sustituya. La indemnización por gastos de cobro será un importe fijo de 40 € por factura, sin perjuicio de poder reclamar una cantidad mayor en caso de superar dichos costes, previa acreditación. Los intereses de demora se devengarán diariamente y se trasladarán en las consiguientes facturas que se emitan tras aquella que fuera objeto de impago. Sin perjuicio de lo anterior, cualquier impago del CLIENTE facultará a {{company.shortName}} a modificar la modalidad de pago de domiciliación bancaria a un mecanismo de pago anticipado.

9.9. El Cliente autoriza expresamente a {{company.name}}, en el caso de que existan facturas u otros conceptos pendientes de cobro a favor de {{company.name}}, a que ésta solicite, en nombre del Cliente, el cambio de comercializador en favor de {{company.name}}, reanudando la relación que mantenía hasta la fecha con {{company.name}} y anulando cualquier cambio pretendido por el Cliente.

9.10. {{company.shortName}} podrá modificar las Condiciones del presente Contrato previa comunicación al Cliente con una antelación de 30 días naturales a la fecha efectiva de la modificación sin perjuicio de la facultad del Cliente de resolver el Contrato por disconformidad sin penalización alguna. En caso de no manifestar lo contrario dentro del citado plazo, se entenderá que el Cliente acepta las modificaciones en la fecha determinada por {{company.shortName}}.`,
  },
  {
    id: 'cl-10-suspension',
    order: 10,
    title: 'SUSPENSIÓN DE SUMINISTRO',
    visibilityScope: 'ALL',
    enabled: true,
    body: `10.1. El suministro podrá ser suspendido en caso de retraso o impago de cualquier factura vencida por parte del CLIENTE; si previo requerimiento de {{company.shortName}} para su abono, éste no hace efectivas todas las cantidades adeudadas, en cuyo caso se solicitará a la Empresa Distribuidora la suspensión del suministro de conformidad con la normativa vigente. Se podrá igualmente suspender el suministro en caso de fuerza mayor, en los casos previstos en la normativa sectorial vigente o incumplimiento de las obligaciones previstas en el presente Contrato.

10.2. En caso de suspensión del suministro, el CLIENTE vendrá obligado a abonar cualesquiera gastos que se deriven de la suspensión y eventual reposición del servicio que repercuta la Empresa Distribuidora. Si la causa de la suspensión del suministro fuese el impago, no se producirá la reconexión hasta que el CLIENTE haya abonado todos los pagos adeudados y haya sido constituida la garantía de pago que pueda requerir {{company.shortName}}. En ningún caso la suspensión del suministro eximirá al CLIENTE de sus obligaciones de pago derivadas del presente Contrato.

10.3. En caso de detección de una situación calificada como fraude por la Empresa Distribuidora, {{company.shortName}} podrá suspender el suministro y resolver el Contrato de forma inmediata, sin perjuicio de las acciones que se pudieran interponer al efecto.

10.4. El impago de cualquier factura de cualquier contrato del mismo titular facultará a la comercializadora para aplicar la presente cláusula a todos los contratos vigentes con dicho titular.`,
  },
  {
    id: 'cl-11-resolucion-anticipada',
    order: 11,
    title: 'RESOLUCIÓN ANTICIPADA DEL CONTRATO',
    visibilityScope: 'ALL',
    enabled: true,
    body: `11.1. Son causas de resolución anticipada, además de las previstas legalmente y en el presente Contrato, las siguientes:
a) El incumplimiento de las obligaciones de cualquiera de las Partes, no subsanándose en el plazo de 5 días hábiles desde la notificación de la parte cumplidora.
b) Si el CLIENTE incumpliese sus obligaciones de pago repetidamente, en cuyo caso no tendrá cabida la subsanación.
c) La falsedad de la información facilitada por el CLIENTE en la contratación.

11.2. Las Partes acuerdan que en caso de resolución unilateral del Contrato por parte del CLIENTE antes de finalizar el período mínimo de permanencia establecido en las Condiciones Particulares del presente Contrato, {{company.shortName}} tendrá derecho a reclamar las siguientes penalizaciones:
a) En el caso de suministros de Baja Tensión, la penalización será el cinco por ciento del precio del Contrato por la energía estimada pendiente de suministrar, según la estimación de consumo anual existente en la base de datos de la distribuidora (SIPS).
b) En el caso de suministros de Alta Tensión, la penalización será de 30 €/MWh por toda la energía pendiente de entregar según la estimación de consumo anual existente en la base de datos de la distribuidora (SIPS). Si el CLIENTE tuviese contratado más de un Punto de Suministro, la penalización será aplicable en caso de resoluciones individuales.

11.4. En caso de resolución del Contrato por incumplimiento de alguna de las Partes, la parte cumplidora podrá reclamar a la otra los daños y perjuicios directos que resulten acreditables. Adicionalmente, en el supuesto de resolución del contrato por impago, el CLIENTE estará obligado a abonar a {{company.shortName}} las cantidades debidas junto con los intereses de demora e indemnización por costes de cobro pactados. {{company.shortName}} quedará facultada para retener cualquier garantía (excepto el depósito de garantía exigido por la Empresa Distribuidora) que hubiese depositado el CLIENTE en caso de que, una vez finalizado el Contrato, éste tuviese adeudos con {{company.shortName}} a causa del servicio prestado o derivadas de cualquier incumplimiento; en todo caso la retención se efectuará por los importes pendientes de pago.

11.5. La resolución del Contrato, cualquiera que sea su causa, no eximirá al CLIENTE de las obligaciones de pago que se encontraran pendientes o pudieran generarse con posterioridad.`,
  },
  {
    id: 'cl-12-proteccion-datos-fuero',
    order: 12,
    title: 'PROTECCIÓN DE DATOS DE CARÁCTER PERSONAL, RECLAMACIONES Y FUERO',
    visibilityScope: 'ALL',
    enabled: true,
    body: `12.1. En cumplimiento de lo dispuesto en la normativa vigente en materia de Protección de Datos de Carácter Personal, ambas partes informan a los intervinientes de que los datos personales que figuran en este Contrato y los que se deriven de la relación serán tratados por cada una de las partes indicadas en el Contrato para la correcta ejecución de la relación contractual. La base para el tratamiento de los datos es la ejecución contractual, así como el interés legítimo en mantenerle informado acerca de nuestros servicios.

12.2. Los interesados pueden ejercitar sus derechos de acceso, rectificación, supresión, portabilidad y la limitación u oposición dirigiéndose por escrito a los domicilios de cada una de las partes que figuran en el Contrato, indicando el derecho que desea ejercer y aportando la documentación acreditativa de su identidad. Asimismo, los interesados tienen derecho a reclamar ante la Autoridad de Control (Agencia Española de Protección de Datos: www.aepd.es). Tiene a su disposición mayor información a través del email {{brand.supportEmail}}. Puede contactar con nuestro Delegado de Protección de Datos en {{company.dpoEmail}}.

12.3. El CLIENTE podrá presentar las reclamaciones convenientes en relación con el presente Contrato por las siguientes vías: a) mediante comunicación escrita a {{company.name}}, {{company.address}}; b) mediante email dirigido a {{brand.supportEmail}}; o c) a través del teléfono gratuito de Atención al Cliente {{brand.freePhone900}}. {{company.name}} informa de que no se encuentra adherida al Sistema Arbitral de Consumo ni a ninguna entidad de resolución alternativa de litigios.

12.4. El presente Contrato se regirá e interpretará por la ley española aplicable y, en particular, por la normativa sectorial eléctrica. Para cualquier disputa que pudiera suscitarse en relación con el Contrato:
a) Si el Cliente actúa en el marco de su actividad empresarial o profesional (autónomos y empresas): las partes renuncian expresamente a cualquier otro fuero que pudiera corresponderles y acuerdan someterse a la jurisdicción y competencia de los Juzgados y Tribunales de la ciudad de {{company.jurisdictionCity}}.
b) Si el Cliente tiene la consideración legal de consumidor o usuario (particulares): las partes se someterán a la jurisdicción de los Juzgados y Tribunales del domicilio del Cliente, conforme a lo establecido en la normativa vigente de defensa de los consumidores.

12.5. {{company.shortName}} podrá, bajo el pleno respeto de la normativa aplicable y con base en su interés legítimo para prevenir el fraude, consultar con anterioridad a la contratación los ficheros de solvencia patrimonial y de crédito que estime convenientes para valorar la solvencia económica del Cliente. El resultado de dicha consulta podría, en su caso, condicionar la entrada en vigor del Contrato. En caso de que {{company.shortName}} adopte una decisión denegatoria basada única y exclusivamente en el tratamiento automatizado de sus datos en dichos ficheros, el Cliente tendrá derecho a ser informado de ello, a obtener intervención humana por parte de {{company.shortName}}, a expresar su punto de vista y a impugnar la decisión.

12.6. Comunicación de información a sistemas de información crediticia: Con base en el interés legítimo, los datos personales del Cliente también podrán ser comunicados a ficheros de solvencia patrimonial y de crédito que {{company.shortName}} estime conveniente si el Cliente ha impagado un servicio de facturación periódica que tenga contratado. Las categorías de datos que se comunican en estos supuestos son: nombre, apellidos, D.N.I./N.I.E., dirección del punto de suministro, siempre cumpliendo con las garantías que otorga la legislación vigente.

12.7. Los datos se conservarán durante la vigencia del contrato y, una vez finalizado, durante los plazos legales de prescripción de responsabilidades (generalmente 5 años para deudas y 10 años por normativa de prevención de blanqueo/tributaria).`,
  },
  {
    id: 'cl-13-contratacion-distancia',
    order: 13,
    title: 'CONTRATACIÓN A DISTANCIA Y FIRMA ELECTRÓNICA',
    visibilityScope: 'ALL',
    enabled: true,
    body: `13.1. Las partes acuerdan que la perfección del presente Contrato podrá realizarse por medios electrónicos o telemáticos de conformidad con el Reglamento (UE) Nº 910/2014 (eIDAS), la Ley 6/2020 reguladora de determinados aspectos de los servicios electrónicos de confianza, el artículo 25 de la Ley 34/2002 (LSSI) y el Real Decreto 88/2026, ya sea mediante firma electrónica avanzada con código de verificación de un solo uso (OTP), sello electrónico y sellado de tiempo cualificado, o mediante firma electrónica cualificada emitida por un Prestador Cualificado de Servicios de Confianza.

13.2. A tal efecto, el Cliente recibirá en su correo electrónico y/o dispositivo móvil el enlace seguro de contratación junto con el Documento Resumen Precontractual independiente y las Condiciones Particulares, Generales y Anexos del Contrato. Para poder proceder a la firma del Contrato, es condición previa y bloqueante la recepción, lectura y aceptación expresa del Documento Resumen Precontractual, pudiendo el Cliente descargar toda la documentación en soporte duradero. Confirmada la visualización y aceptación precontractual, se remitirá al número de teléfono y/o correo electrónico titularidad del Cliente un código de verificación temporal (OTP) que deberá introducir en el portal de firma junto con su rúbrica o aceptación expresa (o, alternativamente en suministros empresariales habilitados, aportar el documento firmado con Certificado Electrónico Cualificado), generándose el correspondiente Certificado de Evidencias Electrónicas sellado criptográficamente (PAdES) y remitido a ambas partes.

13.3. Para garantizar la eficacia jurídica y el buen fin del procedimiento descrito, las partes acuerdan lo siguiente:
a) Reconocer plena validez probatoria y eficacia jurídica al Certificado de Evidencias Electrónicas, hashes criptográficos SHA-256 y sello de tiempo generados en el proceso de firma, los cuales serán custodiados de forma inmutable durante un plazo mínimo de cinco (5) años.
b) La utilización del procedimiento descrito tendrá plena validez jurídica y fuerza vinculante conforme al artículo 25 del Reglamento eIDAS y al artículo 1262 del Código Civil, equiparándose a la perfección mediante firma manuscrita.
c) Las Condiciones Generales y Particulares del presente Contrato y su Documento Resumen actúan como información precontractual hasta su aceptación y firma por las Partes de conformidad con el proceso aquí acordado, momento en el que pasarán a constituir la relación contractual vinculante entre las Partes.

13.4. Si el Cliente hubiese introducido erróneamente el código recibido para la aceptación del Contrato, o éste hubiese caducado por tiempo de espera, podrá solicitar el envío de un nuevo código de verificación al número de teléfono y/o correo electrónico facilitado por el Cliente dentro de los límites de seguridad establecidos.

13.5. El Contrato se formalizará en lengua española.`,
  },
  {
    id: 'cl-14-miscelanea',
    order: 14,
    title: 'MISCELÁNEA',
    visibilityScope: 'ALL',
    enabled: true,
    body: `14.1. Comunicaciones: Las notificaciones y comunicaciones que se efectúen entre las Partes en relación al presente contrato se realizarán mediante burofax, correo postal, correo electrónico, WhatsApp, SMS, fax o cualquier otro medio designado a efectos de notificaciones en las Condiciones Particulares. Las Partes podrán modificar los medios designados a efectos de notificaciones comunicándolo a la otra con una antelación de 15 días a la fecha en que el cambio vaya a ser efectivo. Las Partes acuerdan que {{company.shortName}} podrá comunicar la renovación del Contrato o la modificación del Precio en las propias facturas de suministro, así como el envío de WhatsApp, SMS o correos electrónicos para comunicaciones relacionadas con la gestión del Contrato.

14.2. Prevalencia: En caso de discrepancia entre las Condiciones Generales del Contrato y las Condiciones Particulares o Anexos prevalecerán, por este orden, las Particulares, Anexos y Generales.

14.3. Nulidad: Si alguna de las disposiciones del presente Contrato se declarase nula por cualquier tribunal o autoridad competente, se tendrá por no puesta y no afectará al resto de estipulaciones del Contrato. En tal caso, las Partes se comprometen a negociar de buena fe una redacción alternativa a la estipulación declarada nula.

14.4. No renuncia: El retraso o la falta de ejercicio por cualquiera de las Partes de un derecho o facultad bajo el presente Contrato no supone una renuncia a dicho derecho o facultad; del mismo modo que su ejercicio parcial no precluirá el ejercicio futuro de dicho derecho o facultad.

14.5. Actualización de datos: El CLIENTE debe comunicar inmediatamente a {{company.shortName}} cualquier modificación de los datos consignados en el presente Contrato, en especial cualquier cambio en el número de cuenta bancaria o en los datos a efectos de comunicaciones.

14.6. Modificación Condiciones Contractuales: En caso de modificación de Condiciones contractuales, éstas serán notificadas al CLIENTE con una antelación mínima de treinta días naturales a su aplicación, informándole de su derecho a resolver el contrato con quince días de antelación a su entrada en vigor, en cuyo caso el Contrato se considerará resuelto sin penalización.

14.7. Cesión: El presente Contrato no podrá ser cedido por el CLIENTE a terceros, salvo previa aceptación expresa de {{company.shortName}}. {{company.shortName}} podrá ceder el Contrato a cualquier sociedad del mismo grupo al que pertenece, previa comunicación al CLIENTE.

14.8. Cómputo de Plazos: En caso de que no se establezca nada al respecto, el cómputo de los plazos se efectuará por días naturales. Cuando se haga referencia a días hábiles, se entenderán excluidos los festivos y domingos en la localidad en la que está domiciliado el CLIENTE y que haya sido indicada en Condiciones Particulares o que hubiese comunicado fehacientemente con posterioridad.

14.9. Fuerza Mayor: Las partes acuerdan que ninguna de ellas será responsable en situaciones de fuerza mayor o caso fortuito y, en especial, si existe una imposibilidad por parte de {{company.shortName}} de adquirir o hacer llegar la energía eléctrica al CLIENTE por causas no imputables a la misma.

14.10. Confidencialidad: Salvo acuerdo por escrito en contrario, toda la información contenida en el presente Contrato (incluyendo sus términos y condiciones) e intercambiada durante su ejecución se considerará confidencial.

14.11. Referencia Catastral: De conformidad con lo establecido en la Ley del Catastro Inmobiliario, el CLIENTE deberá aportar la referencia catastral del inmueble donde se ubique el suministro en el momento de la firma del contrato; en caso de no disponer de la misma en el momento de la firma, deberá comunicarla a {{company.shortName}} en el plazo de un mes desde que le sea notificado.

14.12. En aras a dar cumplimiento al Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación de estos datos, y siguiendo las Recomendaciones e Instrucciones emitidas por la Agencia Española de Protección de Datos (A.E.P.D.), con la firma de este Contrato el cliente otorga expresamente la autorización para realizar comunicaciones a través de la APP de mensajería instantánea WhatsApp con la finalidad de agilizar la gestión de los servicios contratados y la comunicación entre ambas partes, para lo cual otorga su consentimiento expreso.`,
  },
  {
    id: 'cl-15-imputacion-pagos-b2b',
    order: 15,
    title: 'IMPUTACIÓN DE PAGOS',
    visibilityScope: 'B2B_ONLY',
    enabled: true,
    body: `En el supuesto de que el CLIENTE sea titular de varios contratos de suministro o mantenga diversas deudas vencidas y exigibles frente a la COMERCIALIZADORA, las Partes acuerdan expresamente que:
i) La COMERCIALIZADORA tendrá la facultad exclusiva de decidir a qué deuda se imputará cualquier pago realizado por el CLIENTE, renunciando este último al derecho de elección estipulado en el artículo 1172 del Código Civil;
ii) Salvo manifestación expresa en contrario por parte de la COMERCIALIZADORA, los pagos parciales o insuficientes para cubrir la totalidad de la deuda acumulada se imputarán a prorrata entre todos los importes vencidos de todos los contratos vigentes, independientemente del concepto que el CLIENTE haya indicado en el momento del pago; y
iii) El pago parcial no extinguirá la obligación de pago ni subsanará la causa de resolución del contrato hasta que la totalidad de la deuda (principal, intereses y gastos) haya sido satisfecha íntegramente para todos los puntos de suministro.`,
  },
];

export const DEFAULT_ANNEX_AUTOCONSUMO: AnnexAutoconsumoConfig = {
  alwaysIncludeAnnex: true,
  surplusValuationIntro:
    'Si el Cliente tiene contratada la modalidad de precio variable (Indexado), la compensación se calculará multiplicando el volumen de excedentes horarios por el precio final de compensación de cada hora. Este precio se calcula restando el Coste de Gestión al precio del mercado, según la siguiente fórmula (en €/MWh):',
  surplusFormulaExpression: 'P_EXCh = OMIEh - FEE_EXC',
  surplusFormulaLegend:
    'En €/MWh: OMIEh=Precio horario de casación de energía en mercado diario de OMIE - FEE_EXC=Costes operativos y de desvíos de {{company.shortName}} para monetizar los excedentes.',
  compensationConditionsText:
    'Para que aplique la compensación, el Cliente acepta expresamente las siguientes condiciones:\n• Legalización y Trámites: El Cliente es el único responsable de legalizar su instalación ante la Comunidad Autónoma y la distribuidora. {{brand.name}} no asumirá responsabilidad ni indemnización alguna por retrasos imputables a terceros. Si {{company.shortName}} tuviera que solicitar a la distribuidora la modificación del contrato ATR para habilitar la compensación, repercutirá al Cliente el coste regulado correspondiente a la actuación sobre la medida.\n• Límite legal: La compensación se realizará sobre el término de energía de la factura, sin que en ningún caso el saldo pueda resultar negativo o a favor del Cliente, conforme a la normativa vigente.\n• Garantías de Origen: El Cliente autoriza a {{brand.name}} a solicitar ante la CNMC la expedición de las Garantías de Origen (GdO) generadas por sus excedentes, cediendo a la comercializadora total libertad para su gestión y destino.',
  solarWalletIntro:
    'Al asociar este suministro a un Bolsillo Solar, el Cliente abonará a {{company.shortName}} el Coste de Gestión mensual indicado (que se prorrateará por los días del ciclo de facturación y se cobrará conjuntamente en la factura de energía). Ambas partes aceptan expresamente las siguientes normas de funcionamiento:',
  solarWalletConditionsText:
    '• Activación del servicio: El derecho a generar y aplicar saldo entrará en vigor en el momento en que {{company.shortName}} tenga constancia de la firma de este anexo y la Empresa Distribuidora confirme operativamente la compensación de excedentes.\n• Generación y Valoración del Saldo: El valor económico de los excedentes que no pueda compensarse en la factura del mes en curso (por haber alcanzado el límite legal del coste de la energía adquirida) se acumulará como saldo ("Descuento"). Su valoración se realizará aplicando el precio pactado en el contrato de la instalación específica que genere dicho excedente.\n• Aplicación del Saldo: Este saldo no caduca mientras el Contrato (o el de cualquier otra Instalación Asociada a la misma Batería Virtual) esté activo. Se aplicará automáticamente en orden cronológico como descuento en las facturas de este suministro o de los asociados, hasta el límite total del importe de la factura. En ningún caso originará saldos negativos ni devoluciones de dinero en efectivo a favor del Cliente.\n• Baja y Pérdida del Saldo: El Cliente puede desvincular un suministro en cualquier momento. Si el Cliente cambia de comercializadora o causa baja de todas las instalaciones vinculadas a la Batería Virtual, el anexo quedará anulado, cesando el cobro del Coste de Gestión, pero perdiendo irremediablemente el derecho a aplicar cualquier saldo remanente acumulado hasta esa fecha.\n• Resolución por parte de {{company.shortName}}: {{company.shortName}} podrá anular este anexo por: a) Impago de facturas de energía o del Coste de Gestión (no subsanado en 15 días tras requerimiento); o b) Concurso de acreedores, embargos, cambios normativos o resoluciones que impidan legalmente su aplicación. Asimismo, {{company.shortName}} podrá dejar sin efecto el servicio si le resultara gravoso, preavisando con 30 días (en este único caso, sí se respetará la aplicación del saldo remanente hasta su agotamiento).',
};

export const DEFAULT_SEPA_MANDATE_CONFIG: SepaMandateConfig = {
  creditorReferenceNote: 'Se indicará en la primera factura emitida.',
  coreAuthorizationText:
    'Mediante la firma de esta orden de domiciliación, autoriza a {{company.name}} a enviar instrucciones a su entidad para adeudar en su cuenta y a la entidad para efectuar los adeudos en su cuenta siguiendo las instrucciones de {{company.name}}. Como parte de sus derechos, está legitimado al reembolso por su entidad en los términos y condiciones del contrato suscrito con la misma. La solicitud de reembolso deberá efectuarse dentro de las ocho semanas que siguen a la fecha de adeudo en cuenta. Puede obtener información adicional sobre sus derechos en su entidad financiera.',
  b2bAuthorizationText:
    'Mediante la firma de esta orden de domiciliación, el deudor autoriza a {{company.name}} a enviar instrucciones a la entidad del deudor para adeudar en su cuenta y a la entidad para efectuar los adeudos en su cuenta siguiendo las instrucciones de {{company.name}} bajo el esquema B2B (Business to Business). Esta orden de domiciliación está prevista para operaciones exclusivamente entre empresas y/o autónomos. El deudor no tiene derecho a que su entidad le reembolse una vez que se haya realizado el cargo en cuenta, pero puede solicitar a su entidad que no efectúe el adeudo en la cuenta hasta la fecha debida. Puede obtener información adicional sobre sus derechos en su entidad financiera.',
  includeBothInB2B: true,
};

export const DEFAULT_SUMMARY_CONFIG: SummaryDocumentConfig = {
  headerLegalSubtitle:
    'Documento Resumen Precontractual Independiente — Reglamento General de Suministro y Contratación (Real Decreto 88/2026)',
  withdrawalRightConsumerText:
    'Derecho de Desistimiento (Consumidores): Dispone usted de un plazo de catorce (14) días naturales desde la celebración del contrato para desistir del mismo sin necesidad de justificación y sin penalización alguna, remitiendo su solicitud a {{brand.withdrawalEmail}} o llamando gratuitamente al {{brand.freePhone900}}. Solo deberá abonar el suministro efectivamente consumido y los costes regulados incurridos hasta la fecha efectiva de baja o cambio.',
  withdrawalRightB2BText:
    'Régimen Empresarial / Profesional (B2B): Al contratarse el suministro en el marco de una actividad empresarial, profesional o societaria (no consumidor conforme al RDL 1/2007), aplican desde la firma las condiciones de duración, preaviso y penalización por resolución anticipada pactadas en las Condiciones Particulares.',
  bonoSocialWarningText:
    'Advertencia sobre el Bono Social Eléctrico: La contratación del suministro en el mercado libre con {{brand.name}} es incompatible con la percepción del Bono Social regulado (PVPC). Si tuviera concedido el Bono Social, la formalización de este contrato conllevará su pérdida automática (más información en www.bonosocial.gob.es).',
  claimsAndSupportText:
    'Atención al Cliente y Reclamaciones: Puede dirigirse gratuitamente al teléfono {{brand.freePhone900}}, al correo electrónico {{brand.supportEmail}} o por escrito a {{company.address}}. Las reclamaciones en el ámbito de consumo podrán someterse a los mecanismos extrajudiciales previstos en la normativa sectorial eléctrica.',
  priceTransparencyNote:
    'Los precios unitarios mostrados no incluyen el Impuesto Eléctrico, la financiación del Bono Social, el alquiler del equipo de medida ni los impuestos indirectos aplicables (IVA / IGIC), que se repercutirán íntegramente según la normativa vigente en cada periodo de facturación.',
};

export function getDefaultBrandTemplatePayload(): BrandTemplatePayload {
  return {
    particularConfig: { ...DEFAULT_PARTICULAR_CONFIG },
    clauses: DEFAULT_CLAUSES.map((c) => ({ ...c })),
    annexAutoconsumo: { ...DEFAULT_ANNEX_AUTOCONSUMO },
    sepaMandateConfig: { ...DEFAULT_SEPA_MANDATE_CONFIG },
    summaryConfig: { ...DEFAULT_SUMMARY_CONFIG },
  };
}

export interface BrandVariableContext {
  companyName: string;
  companyShortName: string;
  companyCif: string;
  companyAddress: string;
  companyRegistroMercantil: string;
  companyDpoEmail: string;
  companyJurisdictionCity: string;
  brandName: string;
  brandSupportEmail: string;
  brandWithdrawalEmail: string;
  brandFreePhone900: string;
  brandDomain: string;
}

export function resolveCompanyJurisdictionCity(company?: any, brand?: any): string {
  const explicit = String(company?.jurisdictionCity || '').trim();
  if (explicit) return explicit;

  const address = String(company?.address || brand?.address || '').trim();
  if (address) {
    // Ejemplo: "Av. Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba" o "Calle X, 28001 Madrid"
    const cpMatch = address.match(/\b\d{5}\b[\s,-]+([^,()]+)/);
    if (cpMatch && cpMatch[1]?.trim()) {
      return cpMatch[1].trim();
    }
    const parts = address
      .split(',')
      .map((p) => p.replace(/\b\d{5}\b/g, '').trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const last = parts[parts.length - 1].replace(/[().]/g, '').trim();
      if (last.length >= 3 && last.length <= 40) return last;
    }
  }

  const reg = String(company?.registroMercantil || '').trim();
  if (reg) {
    const rmMatch = reg.match(/Registro\s+Mercantil\s+de\s+([A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s]+?)(?:[,;.]|\s+Tomo|\s+Folio|\s+Hoja|$)/i);
    if (rmMatch && rmMatch[1]?.trim()) {
      return rmMatch[1].trim();
    }
  }

  return 'su domicilio social';
}

export function buildBrandVariableContext(brand: any, company: any): BrandVariableContext {
  const companyName = company?.name || brand?.name || 'Comercializadora';
  const companyShortName =
    company?.codigo ||
    brand?.codigoMarca ||
    brand?.name?.split(/\s+/)[0]?.toUpperCase() ||
    'COMERCIALIZADORA';
  const rawCif = String(company?.cif || '').trim();
  const formattedCif =
    rawCif.length === 9 && /^[A-Z]\d{8}$/i.test(rawCif)
      ? `${rawCif[0].toUpperCase()}-${rawCif.slice(1)}`
      : rawCif || '-';

  const cleanDomain = String(brand?.domain || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^clientes\./i, 'www.')
    .replace(/\/$/, '');

  const supportEmail = brand?.supportEmail || brand?.email || company?.email || '';

  return {
    companyName,
    companyShortName,
    companyCif: formattedCif,
    companyAddress: company?.address || brand?.address || '',
    companyRegistroMercantil: company?.registroMercantil || '',
    companyDpoEmail: company?.dpoEmail || supportEmail,
    companyJurisdictionCity: resolveCompanyJurisdictionCity(company, brand),
    brandName: brand?.name || companyName,
    brandSupportEmail: supportEmail,
    brandWithdrawalEmail: brand?.withdrawalEmail || supportEmail,
    brandFreePhone900: brand?.freePhone900 || brand?.phone || company?.phone || '',
    brandDomain: cleanDomain || 'su oficina virtual',
  };
}

export function interpolateTemplateVariables(text: string | null | undefined, ctx: BrandVariableContext): string {
  if (!text) return '';
  return text
    .replace(/\{\{\s*company\.name\s*\}\}/g, ctx.companyName)
    .replace(/\{\{\s*company\.shortName\s*\}\}/g, ctx.companyShortName)
    .replace(/\{\{\s*company\.cif\s*\}\}/g, ctx.companyCif)
    .replace(/\{\{\s*company\.address\s*\}\}/g, ctx.companyAddress)
    .replace(/\{\{\s*company\.registroMercantil\s*\}\}/g, ctx.companyRegistroMercantil)
    .replace(/\{\{\s*company\.dpoEmail\s*\}\}/g, ctx.companyDpoEmail)
    .replace(/\{\{\s*company\.jurisdictionCity\s*\}\}/g, ctx.companyJurisdictionCity)
    .replace(/\{\{\s*brand\.name\s*\}\}/g, ctx.brandName)
    .replace(/\{\{\s*brand\.supportEmail\s*\}\}/g, ctx.brandSupportEmail)
    .replace(/\{\{\s*brand\.withdrawalEmail\s*\}\}/g, ctx.brandWithdrawalEmail)
    .replace(/\{\{\s*brand\.freePhone900\s*\}\}/g, ctx.brandFreePhone900)
    .replace(/\{\{\s*brand\.domain\s*\}\}/g, ctx.brandDomain);
}

export interface ContractScopeFilterInput {
  isB2B: boolean;
  isIndexed: boolean;
  hasSelfConsumption: boolean;
  hasSolarWallet: boolean;
}

export function filterClausesForContract(
  clauses: ContractClauseItem[],
  scope: ContractScopeFilterInput
): ContractClauseItem[] {
  return [...(clauses || [])]
    .filter((c) => {
      if (!c || c.enabled === false) return false;
      switch (c.visibilityScope) {
        case 'ALL':
          return true;
        case 'CONSUMER_ONLY':
          return !scope.isB2B;
        case 'B2B_ONLY':
          return scope.isB2B;
        case 'FIXED_ONLY':
          return !scope.isIndexed;
        case 'INDEXED_ONLY':
          return scope.isIndexed;
        case 'SELF_CONSUMPTION_ONLY':
          return scope.hasSelfConsumption;
        case 'SOLAR_WALLET_ONLY':
          return scope.hasSolarWallet;
        default:
          return true;
      }
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
