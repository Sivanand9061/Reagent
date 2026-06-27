import { adminDb } from './src/services/firebaseAdmin.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    const userId = "IEcrxoiznbRYfp5ZTr8oBp0Hrof2";
    console.log(`Checking subcollections for user: ${userId}`);
    const docRef = adminDb.collection('users').doc(userId);
    const collections = await docRef.listCollections();
    
    console.log(`Found ${collections.length} subcollection(s):`);
    for (const coll of collections) {
      console.log(`- Collection ID: ${coll.id}`);
      const docsSnap = await coll.get();
      console.log(`  Contains ${docsSnap.size} document(s):`);
      for (const d of docsSnap.docs) {
        console.log(`    📄 Doc ID: ${d.id} ->`, d.data());
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
