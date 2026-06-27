import { adminDb } from './src/services/firebaseAdmin.js';
import { db } from './src/services/dbService.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    console.log("Connecting to Firestore...");
    const usersSnap = await adminDb.collection('users').get();
    
    if (usersSnap.empty) {
      console.log("❌ No users found in database!");
      return;
    }
    
    console.log(`Found ${usersSnap.size} user(s). Listing profiles:`);
    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      console.log(`\n👤 User ID: ${doc.id}`);
      console.log(`Stats profile:`, userData);
      
      // Get context
      const contextRef = adminDb.collection('users').doc(doc.id).collection('context').doc('active');
      const contextSnap = await contextRef.get();
      if (contextSnap.exists) {
        console.log(`🧠 Session Context:`, contextSnap.data());
      } else {
        console.log(`🧠 Session Context: (Not found)`);
      }
    }
  } catch (err) {
    console.error("Error executing query:", err);
  }
}

run();
