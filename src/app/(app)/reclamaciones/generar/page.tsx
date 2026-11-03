import fs from 'fs';
import path from 'path';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import GenerarReclamacionClient from './GenerarReclamacionClient';

export default async function GenerarReclamacionesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  // Read the CNMC Dictionary server-side
  const dictionaryPath = path.join(process.cwd(), 'docs', 'cnmc_dictionary.json');
  let dictionary: Record<string, any> = {};
  
  try {
    const fileContents = fs.readFileSync(dictionaryPath, 'utf8');
    dictionary = JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading CNMC dictionary:', error);
  }

  // Extract the specific tables we need for claims (filtering out eliminated submotivos with FECHA BAJA)
  const motivosRaw = (dictionary['Tabla_81_81 Tipo de Reclamación o Petición'] || []).filter(
    (m: any) => !m['FECHA BAJA'] || String(m['FECHA BAJA']).trim() === ''
  );
  const submotivosRaw = (dictionary['Tabla_82_82 Subtipo de Reclamación o Petición'] || []).filter(
    (sm: any) => !sm['FECHA BAJA'] || String(sm['FECHA BAJA']).trim() === ''
  );

  return (
    <GenerarReclamacionClient 
      motivos={motivosRaw}
      submotivos={submotivosRaw}
    />
  );
}
