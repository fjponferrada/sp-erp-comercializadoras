import { prisma } from '../prisma';

export class EsiosService {
  private static getHeaders() {
    const token = process.env.ESIOS_API_TOKEN;
    if (!token) throw new Error('ESIOS_API_TOKEN is not defined in environment variables');
    return {
      'Accept': 'application/json; application/vnd.esios-api-v1+json',
      'Content-Type': 'application/json',
      'Authorization': `Token token="${token}"`
    };
  }

  /**
   * Fetches data for a specific indicator from ESIOS API.
   * Dates should be ISO strings (e.g. "2023-01-01T00:00:00")
   */
  static async fetchIndicator(indicatorId: number, startDate: string, endDate: string) {
    const url = `https://api.esios.ree.es/indicators/${indicatorId}?start_date=${startDate}&end_date=${endDate}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized: Invalid ESIOS_API_TOKEN');
      throw new Error(`ESIOS API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.indicator;
  }

  /**
   * Parses ESIOS indicator values into an array of daily 24-hour records
   */
  static processIndicatorData(indicator: any) {
    if (!indicator || !indicator.values) return [];
    
    // Group by local date
    const dailyData = new Map<string, number[]>();

    for (const val of indicator.values) {
      const dt = new Date(val.datetime);
      
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, new Array(24).fill(0));
      }

      const hour = dt.getHours();
      
      const arr = dailyData.get(dateKey)!;
      if (hour >= 0 && hour < 24) {
        arr[hour] = val.value;
      }
    }

    const result = [];
    for (const [dateStr, values] of dailyData.entries()) {
      result.push({
        indicatorId: indicator.id,
        name: indicator.name || `Indicador ${indicator.id}`,
        date: new Date(`${dateStr}T00:00:00Z`),
        values
      });
    }

    return result;
  }
}
