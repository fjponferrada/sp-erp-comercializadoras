import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { auth } from '@/auth';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { brand: true }
  });

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
