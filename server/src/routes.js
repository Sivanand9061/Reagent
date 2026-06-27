import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { adminAuth } from './services/firebaseAdmin.js';
import { runCodeMentorAgent, runCodeQuizAgent, runCodeCritiqueAgent, runRoadmapGeneratorAgent, runMicroChallengeAgent, runSessionSummarizerAgent } from './agents/agents.js';
import { db } from './services/dbService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function getConceptsForChallenge(challengeId) {
  const mapping = {
    sum: ['variables', 'arrays', 'math'],
    fizzbuzz: ['loops', 'conditionals'],
    palindrome: ['strings', 'regex'],
    sandbox: ['general_logic']
  };
  return mapping[challengeId] || ['general_logic'];
}

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────

/**
 * Firebase token verification middleware.
 * Attaches req.userId to every authenticated request.
 */
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

function getUserKeysFromHeaders(req) {
  return {
    geminiKey: req.headers['x-gemini-key'] || '',
    groqKey: req.headers['x-groq-key'] || '',
  };
}

// ─── AI CODE MENTOR ROUTES ────────────────────────────────────────────────────

router.post('/mentor/explain', requireAuth, async (req, res) => {
  const { code, message, mentorMode, tone, history, currentTime, challengeId } = req.body;
  const userKeys = getUserKeysFromHeaders(req);
  const logs = ['Server: Received mentorship request.'];

  try {
    // 1. Fetch user's session context
    const sessionContext = await db.getUserContext(req.userId);

    // Fetch active document context if any exists for this challenge
    const activeDoc = await db.getUserDocument(req.userId, challengeId || 'sandbox');

    // 2. Log this current question action to database activity logs
    await db.logUserActivity(req.userId, 'ask_mentor', challengeId || 'sandbox', { 
      message: message?.substring(0, 100),
      hasCodeInEditor: !!code,
      hasDocumentContext: !!activeDoc
    });

    // 3. Call AI mentor agent, passing the sessionContext and document context
    const response = await runCodeMentorAgent({
      code: code || '',
      message: message || '',
      mentorMode: mentorMode || 'socratic',
      tone: tone || 'casual',
      history: history || [],
      currentTime: currentTime || '',
      sessionContext,
      activeDoc,
      userKeys,
      logCallback: (l) => logs.push(l)
    });
    res.json({ explanation: response, logs });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Mentorship explanation failed.', logs: [...logs, `Error: ${err.message}`] });
  }
});

router.post('/mentor/quiz', requireAuth, async (req, res) => {
  const { challengeId, currentCode, filterConcept } = req.body;
  const userKeys = getUserKeysFromHeaders(req);
  const logs = ['Server: Received micro-challenge request.'];

  try {
    // Fetch user context for targeted challenges
    let sessionContext = await db.getUserContext(req.userId);
    
    if (filterConcept) {
      // Prepend the targeted concept to recentStruggles so that the AI generator focuses on it
      sessionContext = {
        ...sessionContext,
        recentStruggles: [
          { concept: filterConcept, detail: 'User selected concept for targeted practice', at: new Date().toISOString() },
          ...(sessionContext.recentStruggles || [])
        ]
      };
    }

    // Log quiz generation
    await db.logUserActivity(req.userId, 'start_quiz', challengeId || 'sandbox', { hasCode: !!currentCode, targetedConcept: filterConcept });

    const challenges = await runMicroChallengeAgent(sessionContext, userKeys, (l) => logs.push(l));
    res.json({ challenges, logs });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Micro-challenge generation failed.', logs: [...logs, `Error: ${err.message}`] });
  }
});

router.post('/mentor/critique', requireAuth, async (req, res) => {
  const { code, challengeId } = req.body;
  const userKeys = getUserKeysFromHeaders(req);
  const logs = ['Server: Received code critique/review request.'];

  try {
    // Fetch context for skill map adaptive depth
    const context = await db.getUserContext(req.userId);
    const skillMap = context?.skillMap || {};

    // Log review request
    await db.logUserActivity(req.userId, 'request_critique', challengeId || 'sandbox', { codeLength: code?.length || 0 });

    const critiques = await runCodeCritiqueAgent(code || '', challengeId || 'sandbox', userKeys, (l) => logs.push(l), skillMap);
    res.json({ critiques, logs });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Critique failed.', logs: [...logs, `Error: ${err.message}`] });
  }
});

// ─── USER PROGRESS STATS ROUTES ───────────────────────────────────────────────

router.get('/mentor/user-stats', requireAuth, async (req, res) => {
  try {
    const oldStats = await db.getUserStats(req.userId);
    // Update the last active timestamp to current time in background
    await db.updateLastActive(req.userId);
    res.json(oldStats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve coding statistics.' });
  }
});

router.post('/mentor/user-stats', requireAuth, async (req, res) => {
  const { challengeId, linesOfCode } = req.body;
  try {
    // Log completion
    await db.logUserActivity(req.userId, 'challenge_completed', challengeId, { linesOfCode });

    const updatedStats = await db.updateUserStats(req.userId, { challengeId, linesOfCode });

    // Update context
    const concepts = getConceptsForChallenge(challengeId);
    await db.updateContextAfterSubmission(req.userId, { challengeId, concepts, verdict: 'pass' });

    res.json(updatedStats);
  } catch (err) {
    console.error('Failed to update user stats:', err);
    res.status(500).json({ error: 'Failed to update coding statistics.' });
  }
});

// ─── DYNAMIC CAREER ROADMAP GENERATION ────────────────────────────────────────

router.post('/mentor/roadmap', requireAuth, async (req, res) => {
  const { jobRole } = req.body;
  const userKeys = getUserKeysFromHeaders(req);
  if (!jobRole) {
    return res.status(400).json({ error: 'jobRole is required.' });
  }

  try {
    // 1. Log activity
    await db.logUserActivity(req.userId, 'generate_roadmap', 'sandbox', { jobRole });

    // 2. Call roadmap generator agent
    const roadmap = await runRoadmapGeneratorAgent(jobRole, userKeys);

    // 3. Save roadmap to database
    await db.saveUserRoadmap(req.userId, roadmap);

    // Initialize or reset session context for module 1
    if (roadmap.modules && roadmap.modules.length > 0) {
      const firstModule = roadmap.modules[0];
      await db.updateUserContext(req.userId, {
        activeNode: {
          moduleId: firstModule.challengeId,
          title: firstModule.title,
          difficulty: 'beginner',
          language: firstModule.language || 'javascript'
        },
        skillMap: {},
        recentStruggles: [],
        lastSessionSummary: `Welcome to your roadmap for ${roadmap.jobRole}.`
      });
    }

    res.json({ success: true, roadmap });
  } catch (err) {
    console.error('Roadmap generation failed:', err);
    res.status(500).json({ error: err.message || 'Failed to generate career roadmap.' });
  }
});

router.get('/mentor/roadmap', requireAuth, async (req, res) => {
  try {
    const roadmap = await db.getUserRoadmap(req.userId);
    const context = await db.getUserContext(req.userId);
    res.json({ roadmap, context });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve career roadmap.' });
  }
});

router.delete('/mentor/roadmap', requireAuth, async (req, res) => {
  try {
    // Log activity
    await db.logUserActivity(req.userId, 'clear_roadmap', 'sandbox', {});
    await db.clearUserRoadmap(req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear career roadmap.' });
  }
});

// ─── SANDBOX CODE SAVING ──────────────────────────────────────────────────────

router.post('/mentor/sandbox', requireAuth, async (req, res) => {
  const { challengeId, code } = req.body;
  if (!challengeId || code === undefined) {
    return res.status(400).json({ error: 'challengeId and code are required.' });
  }
  try {
    await db.saveSandboxCode(req.userId, challengeId, code);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save sandbox code.' });
  }
});

router.get('/mentor/sandbox/:challengeId', requireAuth, async (req, res) => {
  try {
    const code = await db.getSandboxCode(req.userId, req.params.challengeId);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve sandbox code.' });
  }
});

// ─── CHAT HISTORY PERSISTENCE ROUTES ──────────────────────────────────────────

router.post('/mentor/chat', requireAuth, async (req, res) => {
  const { challengeId, chatSessionId, sender, text } = req.body;
  if (!sender || !text) {
    return res.status(400).json({ error: 'sender and text are required.' });
  }
  try {
    await db.saveChatMessage(req.userId, challengeId || 'sandbox', { chatSessionId, sender, text });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save chat message.' });
  }
});

router.get('/mentor/chat/:challengeId', requireAuth, async (req, res) => {
  try {
    const history = await db.getChatHistory(req.userId, req.params.challengeId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve chat history.' });
  }
});

router.delete('/mentor/chat/:challengeId', requireAuth, async (req, res) => {
  try {
    await db.clearChatHistory(req.userId, req.params.challengeId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chat history.' });
  }
});

// ─── DOCUMENT UPLOAD & RAG PERSISTENCE ROUTES ──────────────────────────────────

router.post('/mentor/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { challengeId } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    let text = '';
    const fileName = req.file.originalname;
    
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text;
    } else {
      text = req.file.buffer.toString('utf8');
    }

    await db.saveUserDocument(req.userId, challengeId || 'sandbox', {
      fileName,
      text,
      uploadedAt: new Date().toISOString()
    });

    // Update activeDocument pointer in context
    await db.updateUserContext(req.userId, {
      activeDocument: { docId: 'active', filename: fileName }
    });

    res.json({ success: true, fileName, message: 'Document uploaded and parsed successfully!' });
  } catch (err) {
    console.error('File parsing error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse file.' });
  }
});

router.get('/mentor/document/:challengeId', requireAuth, async (req, res) => {
  try {
    const doc = await db.getUserDocument(req.userId, req.params.challengeId);
    res.json({ document: doc ? { fileName: doc.fileName, uploadedAt: doc.uploadedAt } : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve document info.' });
  }
});

router.delete('/mentor/document/:challengeId', requireAuth, async (req, res) => {
  try {
    await db.clearUserDocument(req.userId, req.params.challengeId);
    
    // Clear activeDocument pointer in context
    await db.updateUserContext(req.userId, {
      activeDocument: null
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// ─── GENERIC ACTIVITY LOGGING ENDPOINT ───────────────────────────────────────

router.post('/mentor/log-activity', requireAuth, async (req, res) => {
  const { action, challengeId, metadata } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });
  try {
    await db.logUserActivity(req.userId, action, challengeId || 'sandbox', metadata || {});

    // Update context on fail
    if (action === 'submit_fail') {
      const concepts = getConceptsForChallenge(challengeId);
      await db.updateContextAfterSubmission(req.userId, { challengeId, concepts, verdict: 'fail' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save user action log.' });
  }
router.post('/mentor/session-end', requireAuth, async (req, res) => {
  const userKeys = getUserKeysFromHeaders(req);
  try {
    // Fetch user's activity logs (last 30 logs)
    const logs = await db.getUserActivityLogs(req.userId, 30);
    
    if (logs && logs.length > 0) {
      // Generate summary
      const summary = await runSessionSummarizerAgent(logs, userKeys);
      
      // Write summary to context
      await db.updateUserContext(req.userId, {
        lastSessionSummary: summary
      });
      
      return res.json({ success: true, summary });
    }
    
    res.json({ success: true, message: 'No logs to summarize.' });
  } catch (err) {
    console.error('Session end summarization failed:', err);
    res.status(500).json({ error: 'Failed to process session end summary.' });
  }
});

// ─── COMPATIBILITY ROUTES (to prevent dashboard breaks) ───────────────────────

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const profile = await db.getUserStats(req.userId);
    res.json({
      profile: {
        id: req.userId,
        displayName: profile.displayName || 'Developer',
        email: profile.email || '',
        papersCount: profile.challengesCompleted?.length || 0, // Mock papersCount
        quizzesTaken: profile.conceptsMastered || 0,           // Mock quizzesTaken
        conceptsExplored: profile.linesOfCodeWritten || 0      // Mock conceptsExplored
      },
      quizHistory: []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

export default router;
