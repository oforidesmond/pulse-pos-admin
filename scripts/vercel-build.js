const { execSync } = require('child_process');

function shouldRunMigrations() {
  return process.env.RUN_PRISMA_MIGRATIONS === 'true';
}

function shouldIgnoreMigrationErrors() {
  return process.env.IGNORE_PRISMA_MIGRATION_ERRORS === 'true';
}

function main() {
  if (!shouldRunMigrations()) {
    console.log(
      'Skipping Prisma migrations (set RUN_PRISMA_MIGRATIONS=true to enable for this build).'
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set; cannot run Prisma migrations.');
  }

  console.log('Running Prisma migrations (prisma migrate deploy)...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (err) {
    if (shouldIgnoreMigrationErrors()) {
      console.warn(
        'Prisma migrations failed, but IGNORE_PRISMA_MIGRATION_ERRORS=true so the build will continue.'
      );
      return;
    }
    throw err;
  }
}

main();
