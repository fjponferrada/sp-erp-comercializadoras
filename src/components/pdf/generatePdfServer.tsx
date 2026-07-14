import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { ContractDocument } from './ContractDocument';

export async function generateContractPdfStream(contract: any, lead: any, prices: any): Promise<NodeJS.ReadableStream> {
  const stream = await renderToStream(<ContractDocument contract={contract} lead={lead} prices={prices} />);
  return stream;
}

export async function generateContractPdfBuffer(contract: any, lead: any, prices: any): Promise<Buffer> {
  const stream = await renderToStream(<ContractDocument contract={contract} lead={lead} prices={prices} />);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
