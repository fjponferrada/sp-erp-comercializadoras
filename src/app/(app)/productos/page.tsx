import React from 'react';
import { prisma } from '@/lib/prisma';
import ProductosClient from './ProductosClient';

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { brand: true },
    orderBy: { name: 'asc' }
  });

  return <ProductosClient initialProducts={products} />;
}
