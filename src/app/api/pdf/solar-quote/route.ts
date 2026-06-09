import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new NextResponse("Falta ID de presupuesto", { status: 400 });
  }

  const quote = await prisma.solarQuote.findUnique({
    where: { id }
  });

  if (!quote) {
    return new NextResponse("Presupuesto no encontrado", { status: 404 });
  }

  // Aquí iría el código de Puppeteer o React-PDF para generar la gráfica bonita de retorno de inversión
  // Como placeholder devolvemos un texto simulado
  return new NextResponse(`PDF GENERADO PARA: ${quote.quoteNumber}\n\nPotencia: ${quote.peakPowerKwp} kWp\nPresupuesto: ${quote.totalBudget} EUR`, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}
