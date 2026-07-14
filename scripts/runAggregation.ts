import 'dotenv/config';
import { AggregationService } from '../src/lib/services/AggregationService';

async function main() {
  console.log('Iniciando regeneracion de curvas agregadas (700 dias)...');
  await AggregationService.regenerateAggregates(700);
  console.log('Regeneracion completada.');
}

main().catch(console.error);
