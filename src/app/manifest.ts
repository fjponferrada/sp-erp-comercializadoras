import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headersList = await headers();
  let host = headersList.get('host') || '';
  
  // Clean up port from host if present
  if (host.includes(':')) {
    host = host.split(':')[0];
  }

  // Find the brand by domain
  const brand = await prisma.brand.findFirst({
    where: {
      domain: host
    }
  });

  const appName = brand?.name || 'SP Energía ERP';
  const shortName = brand?.name || 'SP Energía';
  const bgColor = brand?.bgColor || '#0B0F19';
  const themeColor = brand?.bgColor || '#0B0F19';
  
  // Use brand logo if available, otherwise default icons
  const iconSrc = brand?.logoUrl || '/icon-512x512.png';

  return {
    name: appName,
    short_name: shortName,
    description: 'Sistema de gestión para comercializadoras eléctricas',
    start_url: '/',
    display: 'fullscreen',
    background_color: bgColor,
    theme_color: themeColor,
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
