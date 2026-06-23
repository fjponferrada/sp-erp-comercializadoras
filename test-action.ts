import { getPendingEnergyAction } from './src/app/actions/energiaPendienteActions';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Mock session and cookies for the server action
jest = require('jest-mock');
jest.mock('@/auth', () => ({
  auth: () => ({ user: { id: 'test', companyId: 'cm0uou0y500062w81z16a695j' } })
}));
jest.mock('next/headers', () => ({
  cookies: () => ({ get: () => ({ value: 'cm0uou0y500062w81z16a695j' }) })
}));

async function main() {
  const result = await getPendingEnergyAction();
  if (result.success) {
    const data = result.data.filter(r => r.cups === 'ES0031105245642001VL0F');
    console.log(data);
  } else {
    console.error(result.error);
  }
}

main();
