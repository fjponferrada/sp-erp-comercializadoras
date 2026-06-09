export interface IngebauSipsData {
  result?: string;
  messages?: string;
  code?: string;
  // Estos campos pueden variar dependiendo de la estructura real de INGEBAU
  // Lo mapearemos genéricamente hasta confirmar el JSON exacto de éxito
  tarifa?: string;
  p1?: number | string;
  p2?: number | string;
  p3?: number | string;
  p4?: number | string;
  p5?: number | string;
  p6?: number | string;
  direccion?: string;
  municipio?: string;
  cp?: string;
  provincia?: string;
  distribuidora?: string;
  [key: string]: any;
}

const INGEBAU_TOKEN = process.env.INGEBAU_TOKEN || '475b0437b1d35f423dba1863bbb7a100';
const INGEBAU_URL = 'http://13.39.57.137:8004/Cups';

/**
 * Consulta la API de Ingebau de forma nativa.
 * Elimina la necesidad de utilizar Make.com.
 * 
 * @param cups El CUPS a consultar
 * @returns IngebauSipsData o null en caso de error crítico
 */
export async function getSipsData(cups: string): Promise<IngebauSipsData | null> {
  if (!cups || cups.length < 20) {
    console.warn(`CUPS inválido para consultar SIPS: ${cups}`);
    return null;
  }

  try {
    const url = `${INGEBAU_URL}?cups=${encodeURIComponent(cups)}&token=${INGEBAU_TOKEN}`;
    console.log(`[SIPS] Consultando Ingebau para CUPS: ${cups}...`);
    
    // Un timeout de 10 segundos es prudencial para llamadas externas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[SIPS] Error HTTP de Ingebau: ${response.status}`);
      return null;
    }

    const data: IngebauSipsData = await response.json();
    
    if (data.result === 'ERROR') {
      console.warn(`[SIPS] Ingebau devolvió error: ${data.messages || 'Desconocido'}`);
      return data; // Devolvemos para poder mostrar el mensaje de error si es necesario
    }

    console.log(`[SIPS] Lectura exitosa para CUPS: ${cups}`);
    return data;
  } catch (error) {
    console.error(`[SIPS] Excepción al consultar Ingebau:`, error);
    return null;
  }
}
