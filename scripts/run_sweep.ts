import { retryUnresolvedSwitchingEventsAction } from '../src/app/actions/switchingActions';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    console.log('Ejecutando el sweep de SwitchingEvents...');
    const result = await retryUnresolvedSwitchingEventsAction();
    console.log('Resultado del Sweep:', result);
}

main().catch(console.error);
