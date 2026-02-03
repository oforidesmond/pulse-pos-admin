const { PrismaClient } = require('@prisma/client');
let bcrypt = null;
try {
  bcrypt = require('bcryptjs');
} catch (err) {
  // bcryptjs not installed — will seed plaintext passwords (not recommended for production)
}

const prisma = new PrismaClient();

const users = [
  { fullName: 'Desmond', email: 'desmond@example.com', username: 'desmond', password: 'superadmin', role: 'SUPER_ADMIN' },
  { fullName: 'Sika', email: 'sika@example.com', username: 'sika', password: '2008', role: 'ADMIN', needsPasswordChange: true },
  { fullName: 'Aziz', email: 'aziz@example.com', username: 'aziz', password: 'aziz55', role: 'ATTENDANT' },
  { fullName: 'James', email: 'james@example.com', username: 'james', password: 'james55', role: 'ATTENDANT' },
  { fullName: 'Jane', email: 'jane@example.com', username: 'jane', password: 'jane55', role: 'ATTENDANT' },
];

async function hashPassword(password) {
  if (!bcrypt) return password;
  return await bcrypt.hash(password, 10);
}

async function main() {
  for (const u of users) {
    const hashed = await hashPassword(u.password);
    const data = {
      fullName: u.fullName,
      email: u.email,
      username: u.username,
      password: hashed,
      role: u.role,
      needsPasswordChange: Boolean(u.needsPasswordChange),
    };

    // Upsert by username (username is unique in the schema)
    await prisma.user.upsert({
      where: { username: u.username },
      update: data,
      create: data,
    });
    console.log(`Upserted user: ${u.username}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
