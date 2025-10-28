import { migrateUserVerification } from '../src/scripts/migrateUserVerification';

console.log('🚀 Starting user verification migration...');

migrateUserVerification()
  .then(({ success, updatedCount, error }) => {
    if (success) {
      console.log(`✅ Successfully migrated ${updatedCount} users.`);
      process.exit(0);
    } else {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Unexpected error during migration:', error);
    process.exit(1);
  });
