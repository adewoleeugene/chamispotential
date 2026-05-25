// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv/config');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding database...');

    const adminPassword = await bcrypt.hash('admin', 12);
    await prisma.user.upsert({
        where: { email: 'admin@rms.com' },
        update: {},
        create: {
            email: 'admin@rms.com',
            name: 'Restaurant Admin',
            password: adminPassword,
            role: 'admin',
            mustChangePassword: true,
        },
    });

    console.log('✅ Seeding complete!');
    console.log('  Admin: admin@rms.com / admin');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
