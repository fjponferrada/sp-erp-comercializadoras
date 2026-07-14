import fs from 'fs';
import path from 'path';
import GenerarReclamacionClient from './GenerarReclamacionClient';

export default async function GenerarReclamacionesPage() {
  // Read the CNMC Dictionary server-side
  const dictionaryPath = path.join(process.cwd(), 'docs', 'cnmc_dictionary.json');
  let dictionary: Record<string, any> = {};
  
  try {
    const fileContents = fs.readFileSync(dictionaryPath, 'utf8');
    dictionary = JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading CNMC dictionary:', error);
  }

  // Extract the specific tables we need for claims
  const motivosRaw = dictionary['Tabla_81_81 Tipo de Reclamación o Petición'] || [];
  const submotivosRaw = dictionary['Tabla_82_82 Subtipo de Reclamación o Petición'] || [];

  return (
    <GenerarReclamacionClient 
      motivos={motivosRaw}
      submotivos={submotivosRaw}
    />
  );
}
