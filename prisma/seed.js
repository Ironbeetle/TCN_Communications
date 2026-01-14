import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('555BXc6.1aVb', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'tcnadmin@tataskweyak.com' },
    update: {},
    create: {
      email: 'tcnadmin@tataskweyak.com',
      password: adminPassword,
      first_name: 'Tataskweyak',
      last_name: 'Admin',
      department: 'BAND_OFFICE',
      role: 'ADMIN'
    }
  })
  console.log('✅ Created admin user:', admin.email)

  // Create staff user
  const staffPassword = await bcrypt.hash('tcn$taFF306', 10)
  const staff = await prisma.user.upsert({
    where: { email: 'tcnstaff@tataskweyak.com' },
    update: {},
    create: {
      email: 'tcnstaff@tataskweyak.com',
      password: staffPassword,
      first_name: 'Staff',
      last_name: 'Person',
      department: 'BAND_OFFICE',
      role: 'STAFF'
    }
  })
  console.log('✅ Created staff user:', staff.email)

  console.log('')
  console.log('🎉 Seeding complete!')
  console.log('')
  console.log('Test accounts:')
  console.log('  Admin: admin@tataskweyak.com / 555BXc6.1aVb')
  console.log('  Staff: staff@tataskweyak.com / tcn$taFF306')
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
