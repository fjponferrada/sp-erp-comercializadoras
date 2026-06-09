import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'SUPERADMIN' && role !== 'COMPANYADMIN') {
    redirect('/');
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      brand: true,
      channel: true,
      assignedBrands: true,
      companies: true,
    }
  });

  const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
  const companies = await prisma.company.findMany({ orderBy: { name: 'asc' }, include: { brands: true } });
  const channels = await prisma.channel.findMany({ orderBy: { name: 'asc' } });

  return <UsersClient initialUsers={users} brands={brands} companies={companies} channels={channels} />
}
