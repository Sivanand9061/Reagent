import { db } from './src/services/dbService.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    const userId = "IEcrxoiznbRYfp5ZTr8oBp0Hrof2";
    console.log("Calling db.getUserContext...");
    const ctx = await db.getUserContext(userId);
    console.log("Result:", ctx);
    
    console.log("Calling db.updateContextAfterSubmission (verdict: fail)...");
    const updated = await db.updateContextAfterSubmission(userId, { challengeId: 'sum', concepts: ['variables', 'math'], verdict: 'fail' });
    console.log("Updated Result:", updated);
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

run();
