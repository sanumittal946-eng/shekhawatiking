/**
 * Generate a bcrypt hash for an admin password.
 * Usage: npm run hash-password -- yourpassword
 *        node scripts/hash-password.js yourpassword
 *
 * Copy the output into .env as ADMIN_PASSWORD_HASH=...
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- <password>');
  process.exit(1);
}

const ROUNDS = 12;

bcrypt.hash(password, ROUNDS).then((hash) => {
  console.log('\nBcrypt hash (12 rounds):\n');
  console.log(hash);
  console.log('\nAdd to your .env file:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\nRemove ADMIN_PASSWORD from .env in production.\n');
});
