import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream } from '@react-pdf/renderer';

import { ContractDocument } from '@/components/pdf/ContractDocument';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contract, lead, prices } = body;

    const stream = await renderToStream(<ContractDocument contract={contract} lead={lead} prices={prices} />);
    
    // Convert Node.js stream to Web stream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Contrato_AED_${lead?.cups || contract.id}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating contract PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
