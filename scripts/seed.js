const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'pos.db');
const SEED_PATH = path.join(__dirname, '..', 'data', 'seed-products.json');
const force = process.argv.includes('--force');

function loadSeedProducts() {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed file not found: ${SEED_PATH}`);
  }
  const products = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  if (!Array.isArray(products) || !products.length) {
    throw new Error('Seed file must contain a non-empty array of products.');
  }
  return products;
}

function seedDatabase(db, products, { replace = false } = {}) {
  return new Promise((resolve, reject) => {
    const runInsert = () => {
      const insert = db.prepare(
        'INSERT INTO products (id, name, sku, barcode, category, price, stock, image, description, cost, threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      products.forEach((product) => {
        insert.run(
          product.id,
          product.name,
          product.sku,
          product.barcode,
          product.category,
          product.price,
          product.stock,
          product.image || null,
          product.description || null,
          product.cost || 0,
          product.threshold || 0
        );
      });

      insert.finalize((finalizeErr) => {
        if (finalizeErr) return reject(finalizeErr);
        console.log(`Seeded ${products.length} product(s) into the database.`);
        resolve(products.length);
      });
    };

    if (replace) {
      db.run('DELETE FROM products', (deleteErr) => {
        if (deleteErr) return reject(deleteErr);
        runInsert();
      });
      return;
    }

    db.get('SELECT COUNT(*) AS count FROM products', (countErr, row) => {
      if (countErr) return reject(countErr);
      if (row.count > 0) {
        console.log(`Database already has ${row.count} product(s). Skipping seed.`);
        return resolve(0);
      }
      runInsert();
    });
  });
}

async function main() {
  const products = loadSeedProducts();
  const db = new sqlite3.Database(DB_PATH);

  try {
    await seedDatabase(db, products, { replace: force });
  } finally {
    db.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { loadSeedProducts, seedDatabase, SEED_PATH };
