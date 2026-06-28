import express from 'express';
import multer from 'multer';
import { adminAuth } from './services/firebaseAdmin.js';
import { docDb, parseFile, chunkDocument, generateDocumentSummary } from './services/docService.js';
import { getAIChatCompletion } from './services/aiService.js';

const router = express.Router();

// Multer memory storage configuration (10MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Authentication middleware using Firebase Admin SDK
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. No token provided.' });
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
}

// Global Multer error handler for file size limits
const uploadHandler = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'The file exceeds the maximum size limit of 10MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// ─── DOCUMENT UPLOAD PIPELINE ──────────────────────────────────────────────────

/**
 * POST /api/docs/upload
 * Uploads, parses, chunks, summarizes, and stores a document.
 */
router.post('/docs/upload', requireAuth, uploadHandler, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const filename = req.file.originalname;
  const mimetype = req.file.mimetype;
  const buffer = req.file.buffer;

  try {
    // 1. Parse file content
    const text = await parseFile(buffer, mimetype);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'The uploaded file is empty or could not be parsed.' });
    }

    // 2. Split into chunks
    const chunks = chunkDocument(text);

    // 3. Generate document AI summary
    const summary = await generateDocumentSummary(filename, text);

    // 4. Save to Firestore
    const saved = await docDb.saveDoc(req.userId, {
      filename,
      summary,
      chunks
    });

    res.json({ success: true, docId: saved.docId, filename: saved.filename });
  } catch (err) {
    console.error('Document upload pipeline failed:', err);
    res.status(500).json({ error: `Upload pipeline failed: ${err.message}` });
  }
});

/**
 * GET /api/docs
 * Lists uploaded documents metadata.
 */
router.get('/docs', requireAuth, async (req, res) => {
  try {
    const docs = await docDb.listDocs(req.userId);
    res.json({ documents: docs });
  } catch (err) {
    console.error('List documents failed:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/docs/:docId
 * Deletes document metadata and its chunks.
 */
router.delete('/docs/:docId', requireAuth, async (req, res) => {
  try {
    await docDb.deleteDoc(req.userId, req.params.docId);
    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('Delete document failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── MULTI-DOCUMENT Q&A RETRIEVAL LOOP ──────────────────────────────────────────

/**
 * POST /api/qa/ask
 * Grounded Q&A query engine with two-step AI pipeline, citations, and conflict checks.
 */
router.post('/qa/ask', requireAuth, async (req, res) => {
  const { question } = req.body;
  const stalenessThresholdDays = parseInt(req.body.stalenessThresholdDays) || 90;
  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    // 1. Fetch user's study library
    const docs = await docDb.listDocs(req.userId);
    if (docs.length === 0) {
      return res.json({
        answer: 'No documents have been uploaded yet. Please upload documents in the library to ask questions.',
        citations: [],
        conflict: null,
        staleWarning: null
      });
    }

    // 2. Relevance Filtering: AI picks the top 3-5 documents
    let relevantDocIds = [];
    if (docs.length <= 3) {
      relevantDocIds = docs.map(d => d.docId);
    } else {
      const systemInstruction = `You are a document relevance filter. Given a user's question and a list of document summaries (each with a docId, filename, and summary), identify the top 3-5 documents that are most likely to contain the answers. Return ONLY a JSON array of the matching docIds, like: ["docId1", "docId2"]. Do not include any explanation or markdown formatting outside the JSON array.`;
      
      const docSummariesString = docs.map(d => `- docId: ${d.docId}\n  filename: ${d.filename}\n  summary: ${d.summary}`).join('\n\n');
      const prompt = `User Question: "${question}"\n\nDocument Summaries:\n${docSummariesString}`;

      const aiResponse = await getAIChatCompletion({
        systemInstruction,
        prompt,
        temperature: 0.1,
        jsonMode: true
      });

      try {
        const parsed = JSON.parse(aiResponse);
        relevantDocIds = Array.isArray(parsed) ? parsed : (parsed.relevantDocIds || parsed.docIds || Object.values(parsed)[0] || []);
      } catch (err) {
        console.error('Failed to parse document relevance filter JSON:', err, aiResponse);
        relevantDocIds = docs.slice(0, 3).map(d => d.docId); // fallback
      }
    }

    // 3. Fetch full chunks for selected docs
    const relevantDocs = [];
    for (const docId of relevantDocIds) {
      const docData = await docDb.getDoc(req.userId, docId);
      if (docData) {
        relevantDocs.push(docData);
      }
    }

    if (relevantDocs.length === 0) {
      return res.json({
        answer: 'No documents cover this question.',
        citations: [],
        conflict: null,
        staleWarning: null
      });
    }

    // 4. Grounded Q&A Generation
    const systemInstruction = `You are an AI assistant that answers questions grounded strictly in the provided document chunks. 
   
RULES:
1. Answer the question using ONLY the text chunks provided below. If the provided chunks do not contain enough information to answer the question, state clearly: "No documents cover this question." Do not fill in information from your general knowledge.
2. For every claim you make in your answer, you MUST attach an inline citation index like [1], [2], etc., corresponding to the document source.
3. Review the provided chunks carefully. If different documents or chunks contradict each other or present conflicting information on the question asked, you MUST explain this conflict in detail.
4. Return your output strictly as a JSON object with this exact schema:
{
  "answer": "The text answer with inline numbered citation markers (e.g. 'To configure settings, go to the Admin tab [1]...'). If you cannot answer, this should be 'No documents cover this question.'",
  "citations": [
    { "docId": "docId of the chunk", "chunkId": "chunkId of the chunk", "claim": "the specific claim or statement cited" }
  ],
  "conflict": "Describe the conflict between the documents if there is any contradiction, including which document says what, or null if there is no conflict."
}
Do not include any other text, markdown wrapper, or explanation outside the JSON object.`;

    const chunksString = relevantDocs.map(doc => {
      return doc.chunks.map(chunk => {
        return `=== START CHUNK ===\nDocument ID: ${doc.docId}\nFilename: ${doc.filename}\nChunk ID: ${chunk.chunkId}\nSection Heading: ${chunk.heading}\nText:\n${chunk.text}\n=== END CHUNK ===`;
      }).join('\n\n');
    }).join('\n\n');

    const prompt = `Question: "${question}"\n\nReference Document Chunks:\n${chunksString}`;

    const aiResponse = await getAIChatCompletion({
      systemInstruction,
      prompt,
      temperature: 0.2,
      jsonMode: true
    });

    let qnaResult = {
      answer: 'No documents cover this question.',
      citations: [],
      conflict: null
    };

    try {
      qnaResult = JSON.parse(aiResponse);
    } catch (err) {
      console.error('Failed to parse Q&A result JSON:', err, aiResponse);
      return res.status(500).json({ error: 'AI Q&A answer generation failed to return structured JSON.' });
    }

    // 5. Resolution & Staleness checks
    const docMap = {};
    const chunkHeadingMap = {};
    const chunkTextMap = {};
    
    relevantDocs.forEach(d => {
      docMap[d.docId] = {
        filename: d.filename,
        uploadedAt: d.uploadedAt ? (d.uploadedAt.toDate ? d.uploadedAt.toDate() : new Date(d.uploadedAt)) : new Date()
      };
      d.chunks.forEach(c => {
        chunkHeadingMap[`${d.docId}_${c.chunkId}`] = c.heading;
        chunkTextMap[`${d.docId}_${c.chunkId}`] = c.text;
      });
    });

    const resolvedCitations = (qnaResult.citations || []).map(cit => {
      const docInfo = docMap[cit.docId] || { filename: 'Unknown Document', uploadedAt: new Date() };
      const heading = chunkHeadingMap[`${cit.docId}_${cit.chunkId}`] || 'General Section';
      const chunkText = chunkTextMap[`${cit.docId}_${cit.chunkId}`] || '';
      return {
        docId: cit.docId,
        chunkId: cit.chunkId,
        claim: cit.claim,
        filename: docInfo.filename,
        heading: heading,
        chunkText: chunkText
      };
    });

    // Compute staleness (more than 90 days older than another cited doc)
    const citedDocIds = [...new Set(resolvedCitations.map(c => c.docId))];
    let staleWarning = null;
    
    if (citedDocIds.length > 1) {
      const dates = citedDocIds.map(id => ({
        id,
        filename: docMap[id]?.filename || 'Unknown',
        date: docMap[id]?.uploadedAt || new Date()
      })).filter(d => d.date);

      const warnings = [];
      for (let i = 0; i < dates.length; i++) {
        for (let j = 0; j < dates.length; j++) {
          if (i === j) continue;
          const diffTime = dates[j].date - dates[i].date; // difference in ms
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          if (diffDays > stalenessThresholdDays) {
            const daysRounded = Math.round(diffDays);
            warnings.push(`"${dates[i].filename}" is ${daysRounded} days older than "${dates[j].filename}"`);
          }
        }
      }
      if (warnings.length > 0) {
        staleWarning = `Warning: Some cited sources are outdated compared to others: ${warnings.join('; ')}.`;
      }
    }

    res.json({
      answer: qnaResult.answer || 'No documents cover this question.',
      citations: resolvedCitations,
      conflict: qnaResult.conflict || null,
      staleWarning: staleWarning
    });

  } catch (err) {
    console.error('Q&A ask pipeline failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
