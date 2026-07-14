import React from 'react';
import { prisma } from '@/lib/prisma';
import ProductosClient from './ProductosClient';
import { getAuthorizedProductsWhereClause } from '@/app/actions/productActions';

export default async function ProductsPage() {
  const whereClause = await getAuthorizedProductsWhereClause();
  const products = whereClause ? await prisma.product.findMany({
    where: whereClause,
    include: { brand: true },
    orderBy: { name: 'asc' }
  }) : [];

  return <ProductosClient initialProducts={products} />;
}
