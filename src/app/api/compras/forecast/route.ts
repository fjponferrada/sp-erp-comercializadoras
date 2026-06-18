import { NextResponse } from 'next/server';
import { generateTomorrowForecast } from '@/lib/services/ForecastService';

export async function POST(req: Request) {
  try {
    const result = await generateTomorrowForecast();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Forecast API error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
