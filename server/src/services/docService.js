import pdfParse from 'pdf-parse';
import { adminDb } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getAIChatCompletion } from './aiService.js';

/**
 * Parses file buffer based on mimetype.
 */
export async function parseFile(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  } else {
    // Text or Markdown
    return buffer.toString('utf-8');
  }
}

/**
 * Splits document text into chunks of ~300-500 words, respecting headings.
 */
export function chunkDocument(text) {
  const lines = text.split('\n');
  const tempChunks = [];
  let currentHeading = 'Introduction';
  let currentTextLines = [];

  for (let line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      if (currentTextLines.length > 0) {
        tempChunks.push({ heading: currentHeading, text: currentTextLines.join('\n').trim() });
        currentTextLines = [];
      }
      currentHeading = match[2].trim();
    } else {
      currentTextLines.push(line);
    }
  }
  if (currentTextLines.length > 0) {
    tempChunks.push({ heading: currentHeading, text: currentTextLines.join('\n').trim() });
  }

  const finalChunks = [];
  let chunkCount = 0;

  for (let chunk of tempChunks) {
    const words = chunk.text.split(/\s+/).filter(Boolean);
    if (words.length > 500) {
      // Split large heading sections into smaller paragraph groups
      const paragraphs = chunk.text.split(/\n\s*\n/);
      let currentGroup = [];
      let currentWordCount = 0;
      let partIndex = 1;

      for (let para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;
        const paraWords = trimmed.split(/\s+/).filter(Boolean).length;

        if (currentWordCount + paraWords > 400 && currentGroup.length > 0) {
          finalChunks.push({
            chunkId: `chunk_${chunkCount++}`,
            heading: `${chunk.heading} (Part ${partIndex++})`,
            text: currentGroup.join('\n\n')
          });
          currentGroup = [trimmed];
          currentWordCount = paraWords;
        } else {
          currentGroup.push(trimmed);
          currentWordCount += paraWords;
        }
      }
      if (currentGroup.length > 0) {
        finalChunks.push({
          chunkId: `chunk_${chunkCount++}`,
          heading: `${chunk.heading} (Part ${partIndex++})`,
          text: currentGroup.join('\n\n')
        });
      }
    } else {
      if (chunk.text.trim().length > 0) {
        finalChunks.push({
          chunkId: `chunk_${chunkCount++}`,
          heading: chunk.heading,
          text: chunk.text
        });
      }
    }
  }

  if (finalChunks.length === 0) {
    finalChunks.push({
      chunkId: 'chunk_0',
      heading: 'Introduction',
      text: text.trim() || '(Empty Document)'
    });
  }

  return finalChunks;
}

/**
 * Generates a 1-2 sentence AI summary of the document.
 */
export async function generateDocumentSummary(filename, text) {
  const systemInstruction = `You are a document analyzer. Your task is to generate a concise, 1-2 sentence summary of the uploaded document named "${filename}" based on its text content. Do not exceed 2 sentences. Be direct and objective.`;
  const prompt = `Document Name: ${filename}\n\nDocument Text:\n${text.substring(0, 8000)}`;

  try {
    const summary = await getAIChatCompletion({
      systemInstruction,
      prompt,
      temperature: 0.3
    });
    return summary;
  } catch (err) {
    console.error('Failed to generate AI summary:', err);
    return `A reference document titled ${filename}.`;
  }
}

/**
 * DB helper methods for Document management in Firestore.
 */
export const docDb = {
  async saveDoc(userId, { filename, summary, chunks }) {
    const docsRef = adminDb.collection('users').doc(userId).collection('documents');
    
    // Add to Firestore
    const docRef = await docsRef.add({
      filename,
      summary,
      chunks,
      uploadedAt: FieldValue.serverTimestamp()
    });

    const snap = await docRef.get();
    return { docId: snap.id, ...snap.data() };
  },

  async listDocs(userId) {
    const snap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('documents')
      .orderBy('uploadedAt', 'desc')
      .get();

    return snap.docs.map(doc => {
      const data = doc.data();
      // Exclude large chunks array when listing
      return {
        docId: doc.id,
        filename: data.filename,
        summary: data.summary,
        uploadedAt: data.uploadedAt ? (data.uploadedAt.toDate ? data.uploadedAt.toDate().toISOString() : data.uploadedAt) : new Date().toISOString()
      };
    });
  },

  async getDoc(userId, docId) {
    const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { docId: snap.id, ...snap.data() };
  },

  async deleteDoc(userId, docId) {
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('documents')
      .doc(docId)
      .delete();
    return true;
  }
};
