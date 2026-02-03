const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function generateSku(name, index) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const suffix = String(index + 1).padStart(4, '0');
  return `${base || 'ITEM'}-${suffix}`;
}

async function main() {
  const filePath = path.resolve(__dirname, '../inventory.txt');
  const content = fs.readFileSync(filePath, 'utf8');

  const rawLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  console.log(`Found ${rawLines.length} inventory lines`);

  const cleanedNames = rawLines
    .map((line) => {
      // Strip leading numeric index like "123 " if present
      const withoutIndex = line.replace(/^\d+\s+/, '').trim();
      return withoutIndex.length > 0 ? withoutIndex : line;
    });

  const uniqueNames = Array.from(new Set(cleanedNames));
  console.log(`Seeding ${uniqueNames.length} unique products`);

  for (let i = 0; i < uniqueNames.length; i++) {
    const name = uniqueNames[i];
    const sku = generateSku(name, i);

    await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        name,
        sku,
        cost: 0,
        price: 0,
        stock: {
          create: {
            quantity: 0,
          },
        },
      },
    });

    if ((i + 1) % 50 === 0 || i === uniqueNames.length - 1) {
      console.log(`Processed ${i + 1}/${uniqueNames.length}`);
    }
  }

  console.log('Inventory seeding complete.');
}

main()
  .catch((e) => {
    console.error('Error seeding inventory', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
