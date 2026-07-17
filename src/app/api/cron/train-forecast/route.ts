import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PROVINCES_GEO } from '@/lib/services/ProvinceService';
import { getDay, getMonth, isWeekend, subDays } from 'date-fns';
import { DecisionTreeRegression } from 'ml-cart';
import { auth } from '@/auth';

import { AggregationService } from '@/lib/services/AggregationService';

const SEGMENTS = ['HOGAR 0-5kW', 'HOGAR 5-10kW', 'HOGAR 10-15kW', 'PYME <50 MWh', 'PYME >50 MWh', 'VE <15 MWh', 'VE >15 MWh', 'VIP'];
const PROVINCES = Object.values(PROVINCES_GEO).map(p => p.name);

export async function GET(req: Request) {
  // En producción, Vercel Cron llamará a este GET. 
  try {
    const expectedSecret = process.env.CRON_SECRET || 'fallback_secret';
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');

    const session = await auth();

    // Permitir si se envía la contraseña (Vercel Cron) o si hay sesión activa (Botón UI)
    if (
      (expectedSecret !== 'fallback_secret' && cronSecret !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`)
      && !session?.user
    ) {
      return NextResponse.json({ error: 'Unauthorized: Invalid cron secret or no session' }, { status: 401 });
    }

    console.log('Synchronizing history before training...');
    await AggregationService.regenerateAggregates(30);

    console.log('Starting background model training...');

    const maxAgg = await prisma.aggregatedLoadCurve.aggregate({ _max: { date: true } });
    let dbMaxDate = maxAgg._max.date || new Date();
    
    // Fetch 12 months of historical data
    const history = await prisma.aggregatedLoadCurve.findMany({
      where: {
        date: {
          gte: subDays(dbMaxDate, 365)
        }
      }
    });

    let X_global: number[][] = [];
    let Y_global: number[] = [];

    for (const record of history) {
      if (['VIP', 'VE <15 MWh', 'VE >15 MWh'].includes(record.segment)) continue; // VIP and VE are handled via SDA dynamically
      if (record.clientCount === 0) continue;

      const segmentId = SEGMENTS.indexOf(record.segment);
      const provinceId = PROVINCES.indexOf(record.province);
      
      const d = record.date;
      const dow = getDay(d);
      const month = getMonth(d);
      const isWknd = isWeekend(d) ? 1 : 0;

      for (let h = 0; h < 24; h++) {
        const temp = record.temperature[h] ?? 20.0;
        const cons = record.totalConsumption[h] ?? 0;
        X_global.push([segmentId, provinceId, dow, month, h, temp, isWknd]);
        Y_global.push(cons / record.clientCount);
      }
    }

    // Optimize training for serverless environment by down-sampling 
    const MAX_TRAINING_SAMPLES = 10000;
    if (X_global.length > MAX_TRAINING_SAMPLES) {
      const sampledX: number[][] = [];
      const sampledY: number[] = [];
      for (let i = 0; i < MAX_TRAINING_SAMPLES; i++) {
        const randIdx = Math.floor(Math.random() * X_global.length);
        sampledX.push(X_global[randIdx]);
        sampledY.push(Y_global[randIdx]);
        X_global[randIdx] = X_global[X_global.length - 1];
        Y_global[randIdx] = Y_global[Y_global.length - 1];
        X_global.pop();
        Y_global.pop();
      }
      X_global = sampledX;
      Y_global = sampledY;
    }

    if (X_global.length < 100) {
      return NextResponse.json({ error: 'Not enough data to train model' }, { status: 400 });
    }

    console.log(`Training model with ${X_global.length} samples...`);
    const regression = new DecisionTreeRegression({ maxDepth: 20 });
    regression.train(X_global, Y_global);

    // Serialize model to JSON
    const modelJson = regression.toJSON();

    // Upsert into DB (we can just keep the latest version to save space)
    const existingCache = await prisma.forecastModelCache.findFirst();
    if (existingCache) {
      await prisma.forecastModelCache.update({
        where: { id: existingCache.id },
        data: {
          modelData: modelJson as any,
          version: existingCache.version + 1
        }
      });
    } else {
      await prisma.forecastModelCache.create({
        data: {
          modelData: modelJson as any,
          version: 1
        }
      });
    }

    console.log('Model trained and saved to database successfully!');
    return NextResponse.json({ success: true, message: 'Model trained successfully' });
  } catch (error) {
    console.error('Cron Train Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
