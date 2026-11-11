import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function run(): Promise<void> {
  console.log('\n🔄 Migration: chat_conversation_reads (staff unread tracking)\n');

  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_conversation_reads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_user_id INT NOT NULL,
      conversation_id INT NOT NULL,
      last_read_message_id INT NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_chat_read_staff_conv (staff_user_id, conversation_id),
      FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
      INDEX idx_chat_read_staff (staff_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('  ✓ chat_conversation_reads is present\n');
  console.log('✅ Done.\n');
}

export default run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
