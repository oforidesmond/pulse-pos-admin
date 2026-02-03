const { execSync } = require('child_process');

function shouldRunMigrations() {
  if (process.env.RUN_PRISMA_MIGRATIONS === 'true') return true;
  if (process.env.VERCEL_ENV === 'production') return true;
  return false;
}

function main() {
  if (!shouldRunMigrations()) {
    console.log(
      'Skipping Prisma migrations (set RUN_PRISMA_MIGRATIONS=true to enable for this environment).'
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set; cannot run Prisma migrations.');
  }

  console.log('Running Prisma migrations (prisma migrate deploy)...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}

main();
