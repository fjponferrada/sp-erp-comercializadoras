import React from 'react';
import { prisma } from '@/lib/prisma';
import ProductosClient from './ProductosClient';
import { getAuthorizedProductsWhereClause } from '@/app/actions/productActions';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any).role;
  if (role === 'CLIENT') {
    redirect('/mi-energia');
  }

  const whereClause = await getAuthorizedProductsWhereClause();
  const dbProducts = whereClause
    ? await prisma.product.findMany({
        where: whereClause,
        include: { brand: true },
        orderBy: { name: 'asc' },
      })
    : [];

  const isExternalRole = ['CANAL', 'COMERCIAL'].includes(role);
  const safeProducts = isExternalRole
    ? dbProducts.map(({ marginFC, ip1, ip2, ip3, ip4, ip5, ip6, airtableData, ...rest }) => rest)
    : dbProducts;

  return <ProductosClient initialProducts={safeProducts} />;
}
