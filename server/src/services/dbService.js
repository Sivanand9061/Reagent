import { adminDb } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Firestore-backed database service.
 * All data is scoped under users/{userId}/papers/{paperId}
 * and mirrored to publicPapers/{paperId} when made public.
 */
export const db = {

  // ─── PAPERS ────────────────────────────────────────────────────────────────

  async savePaper(userId, { fileName, rawText, numPages, sections, concepts, glossary }) {
    const papersRef = adminDb.collection('users').doc(userId).collection('papers');

    // Check if paper with same filename already exists for this user
    const existing = await papersRef.where('fileName', '==', fileName).limit(1).get();

    if (!existing.empty) {
      // Update existing record
      const docRef = existing.docs[0].ref;
      await docRef.update({
        rawText,
        numPages,
        sections,
        concepts,
        glossary,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const updated = await docRef.get();
      return { id: updated.id, ...updated.data() };
    }

    // Create new paper record
    const newDoc = await papersRef.add({
      userId,
      fileName,
      rawText,
      numPages,
      sections,
      concepts,
      glossary,
      isPublic: false,
      views: 0,
      upvotes: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Increment user paper count
    await adminDb.collection('users').doc(userId).update({
      papersCount: FieldValue.increment(1),
    });

    const created = await newDoc.get();
    return { id: created.id, ...created.data() };
  },

  async getPaper(userId, paperId) {
    const docRef = adminDb.collection('users').doc(userId).collection('papers').doc(paperId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  },

  async listPapers(userId) {
    const snap = await adminDb
      .collection('users').doc(userId).collection('papers')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(doc => {
      const { rawText, sections, ...meta } = doc.data();
      return { id: doc.id, ...meta };
    });
  },

  async deletePaper(userId, paperId) {
    const paperRef = adminDb.collection('users').doc(userId).collection('papers').doc(paperId);
    const paper = await paperRef.get();

    if (paper.exists && paper.data().isPublic) {
      // Remove from public library too
      await adminDb.collection('publicPapers').doc(paperId).delete();
    }

    // Delete all subcollection docs (exploredConcepts)
    const concepts = await paperRef.collection('exploredConcepts').get();
    const batch = adminDb.batch();
    concepts.docs.forEach(d => batch.delete(d.ref));
    batch.delete(paperRef);
    await batch.commit();

    // Decrement user paper count
    await adminDb.collection('users').doc(userId).update({
      papersCount: FieldValue.increment(-1),
    });

    return true;
  },

  // ─── PUBLIC LIBRARY ────────────────────────────────────────────────────────

  async setPublic(userId, paperId, isPublic) {
    const paperRef = adminDb.collection('users').doc(userId).collection('papers').doc(paperId);
    const snap = await paperRef.get();
    if (!snap.exists) throw new Error('Paper not found');

    await paperRef.update({ isPublic, updatedAt: FieldValue.serverTimestamp() });

    if (isPublic) {
      const data = snap.data();
      // Mirror lightweight metadata to publicPapers collection
      await adminDb.collection('publicPapers').doc(paperId).set({
        paperId,
        userId,
        fileName: data.fileName,
        numPages: data.numPages,
        concepts: data.concepts,
        glossaryCount: data.glossary?.length || 0,
        views: data.views || 0,
        upvotes: data.upvotes || 0,
        publishedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Remove from public library
      await adminDb.collection('publicPapers').doc(paperId).delete();
    }

    return true;
  },

  async listPublicPapers() {
    const snap = await adminDb
      .collection('publicPapers')
      .orderBy('publishedAt', 'desc')
      .limit(50)
      .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getPublicPaper(paperId) {
    const publicRef = adminDb.collection('publicPapers').doc(paperId);
    const publicSnap = await publicRef.get();
    if (!publicSnap.exists) return null;
    const { userId } = publicSnap.data();

    const paperRef = adminDb.collection('users').doc(userId).collection('papers').doc(paperId);
    const paperSnap = await paperRef.get();
    if (!paperSnap.exists) return null;
    return { id: paperSnap.id, ...paperSnap.data() };
  },


  async incrementViews(paperId) {
    await adminDb.collection('publicPapers').doc(paperId).update({
      views: FieldValue.increment(1),
    });
  },

  async toggleUpvote(userId, paperId) {
    const upvoteRef = adminDb.collection('publicPapers').doc(paperId)
      .collection('upvoters').doc(userId);
    const snap = await upvoteRef.get();

    if (snap.exists) {
      await upvoteRef.delete();
      await adminDb.collection('publicPapers').doc(paperId).update({
        upvotes: FieldValue.increment(-1),
      });
      return { upvoted: false };
    } else {
      await upvoteRef.set({ upvotedAt: FieldValue.serverTimestamp() });
      await adminDb.collection('publicPapers').doc(paperId).update({
        upvotes: FieldValue.increment(1),
      });
      return { upvoted: true };
    }
  },

  // ─── SESSION CONCEPTS ──────────────────────────────────────────────────────

  async saveSessionConcept(userId, paperId, conceptName, explanation) {
    const conceptsRef = adminDb
      .collection('users').doc(userId)
      .collection('papers').doc(paperId)
      .collection('exploredConcepts');

    const existing = await conceptsRef.where('conceptName', '==', conceptName).limit(1).get();

    if (!existing.empty) {
      await existing.docs[0].ref.update({
        explanation,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await conceptsRef.add({
        conceptName,
        explanation,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Increment global concepts counter on user profile
      await adminDb.collection('users').doc(userId).update({
        conceptsExplored: FieldValue.increment(1),
      });
    }

    return true;
  },

  async getSessionConcepts(userId, paperId) {
    const snap = await adminDb
      .collection('users').doc(userId)
      .collection('papers').doc(paperId)
      .collection('exploredConcepts')
      .orderBy('createdAt', 'asc')
      .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // ─── QUIZ SCORES ───────────────────────────────────────────────────────────

  async saveQuizScore(userId, paperId, score, total) {
    const record = await adminDb.collection('quizScores').add({
      userId,
      paperId,
      score,
      total,
      percentage: Math.round((score / total) * 100),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Increment user quizzesTaken counter
    await adminDb.collection('users').doc(userId).update({
      quizzesTaken: FieldValue.increment(1),
    });

    const snap = await record.get();
    return { id: snap.id, ...snap.data() };
  },

  async getQuizScores(userId, paperId) {
    const snap = await adminDb
      .collection('quizScores')
      .where('userId', '==', userId)
      .where('paperId', '==', paperId)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getUserQuizHistory(userId) {
    const snap = await adminDb
      .collection('quizScores')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // ─── USER PROFILE ──────────────────────────────────────────────────────────

  async getUserProfile(userId) {
    const snap = await adminDb.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  },

  // ─── CODING ACADEMY ────────────────────────────────────────────────────────

  async getUserStats(userId) {
    const docRef = adminDb.collection('users').doc(userId);
    const snap = await docRef.get();
    if (!snap.exists) {
      const defaultProfile = {
        challengesCompleted: [],
        linesOfCodeWritten: 0,
        conceptsMastered: 0,
        lastActiveTimestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      };
      await docRef.set(defaultProfile);
      return defaultProfile;
    }
    const data = snap.data();
    return {
      challengesCompleted: data.challengesCompleted || [],
      linesOfCodeWritten: data.linesOfCodeWritten || 0,
      conceptsMastered: data.conceptsMastered || 0,
      lastActiveTimestamp: data.lastActiveTimestamp || null,
      createdAt: data.createdAt || null
    };
  },

  async updateUserStats(userId, { challengeId, linesOfCode }) {
    const docRef = adminDb.collection('users').doc(userId);
    const snap = await docRef.get();
    
    const updates = {
      lastActiveTimestamp: FieldValue.serverTimestamp()
    };
    
    if (linesOfCode) {
      updates.linesOfCodeWritten = FieldValue.increment(linesOfCode);
    }
    
    if (challengeId) {
      const currentCompleted = snap.exists ? (snap.data().challengesCompleted || []) : [];
      if (!currentCompleted.includes(challengeId)) {
        updates.challengesCompleted = FieldValue.arrayUnion(challengeId);
        updates.conceptsMastered = FieldValue.increment(1);
      }
    }
    
    if (snap.exists) {
      await docRef.update(updates);
    } else {
      await docRef.set({
        challengesCompleted: challengeId ? [challengeId] : [],
        linesOfCodeWritten: linesOfCode || 0,
        conceptsMastered: challengeId ? 1 : 0,
        lastActiveTimestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      });
    }
    
    return this.getUserStats(userId);
  },

  async updateLastActive(userId) {
    const docRef = adminDb.collection('users').doc(userId);
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.update({
        lastActiveTimestamp: FieldValue.serverTimestamp()
      });
    } else {
      await docRef.set({
        challengesCompleted: [],
        linesOfCodeWritten: 0,
        conceptsMastered: 0,
        lastActiveTimestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      });
    }
  },

  async saveSandboxCode(userId, challengeId, code) {
    const codeRef = adminDb.collection('users').doc(userId).collection('sandboxCode').doc(challengeId);
    await codeRef.set({
      code,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  },

  async getSandboxCode(userId, challengeId) {
    const codeRef = adminDb.collection('users').doc(userId).collection('sandboxCode').doc(challengeId);
    const snap = await codeRef.get();
    if (!snap.exists) return null;
    return snap.data().code;
  },

  async logUserActivity(userId, action, challengeId, metadata = {}) {
    const logsRef = adminDb.collection('users').doc(userId).collection('activityLogs');
    await logsRef.add({
      action,
      challengeId: challengeId || 'sandbox',
      metadata,
      timestamp: FieldValue.serverTimestamp()
    });
    return true;
  },

  async getUserActivityLogs(userId, limit = 50) {
    const snap = await adminDb
      .collection('users').doc(userId)
      .collection('activityLogs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(doc => {
      const data = doc.data();
      const date = data.timestamp?._seconds 
        ? new Date(data.timestamp._seconds * 1000) 
        : (data.timestamp ? new Date(data.timestamp) : new Date());
      
      return {
        id: doc.id,
        action: data.action,
        challengeId: data.challengeId,
        metadata: data.metadata || {},
        timestamp: date.toISOString(),
        formattedText: `[${date.toLocaleString()}] Action: ${data.action} | Challenge: ${data.challengeId} | Details: ${JSON.stringify(data.metadata || {})}`
      };
    });
  },

  async saveChatMessage(userId, challengeId, { chatSessionId, sender, text }) {
    const chatRef = adminDb
      .collection('users').doc(userId)
      .collection('challenges').doc(challengeId || 'sandbox')
      .collection('chatHistory');

    await chatRef.add({
      chatSessionId: String(chatSessionId || ''),
      sender,
      text,
      timestamp: FieldValue.serverTimestamp()
    });
    return true;
  },

  async getChatHistory(userId, challengeId, limit = 100) {
    const snap = await adminDb
      .collection('users').doc(userId)
      .collection('challenges').doc(challengeId || 'sandbox')
      .collection('chatHistory')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        sender: data.sender,
        text: data.text,
        chatSessionId: data.chatSessionId,
        timestamp: data.timestamp
      };
    });
  },

  async clearChatHistory(userId, challengeId) {
    const chatRef = adminDb
      .collection('users').doc(userId)
      .collection('challenges').doc(challengeId || 'sandbox')
      .collection('chatHistory');

    const snap = await chatRef.get();
    const batch = adminDb.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return true;
  },

  async saveUserDocument(userId, challengeId, { fileName, text, uploadedAt }) {
    const docRef = adminDb
      .collection('users').doc(userId)
      .collection('challenges').doc(challengeId || 'sandbox')
      .collection('documents').doc('active');
    await docRef.set({
      fileName,
      text,
      uploadedAt,
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  },

  async getUserDocument(userId, challengeId) {
    const docRef = adminDb
      .collection('users').doc(userId)
      .collection('challenges').doc(challengeId || 'sandbox')
      .collection('documents').doc('active');
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data();
  },

  async clearUserDocument(userId, challengeId) {
    const docRef = adminDb
      .collection('users').doc(userId)
      .collection('challenges').doc(challengeId || 'sandbox')
      .collection('documents').doc('active');
    await docRef.delete();
    return true;
  },

  async saveUserRoadmap(userId, roadmap) {
    const docRef = adminDb
      .collection('users').doc(userId)
      .collection('roadmap').doc('active');
    await docRef.set({
      ...roadmap,
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  },

  async getUserRoadmap(userId) {
    const docRef = adminDb
      .collection('users').doc(userId)
      .collection('roadmap').doc('active');
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data();
  },

  async clearUserRoadmap(userId) {
    const docRef = adminDb
      .collection('users').doc(userId)
      .collection('roadmap').doc('active');
    await docRef.delete();
    return true;
  },

  // ─── SESSION CONTEXT ───────────────────────────────────────────────────────

  async getUserContext(userId) {
    const docRef = adminDb.collection('users').doc(userId).collection('context').doc('active');
    const snap = await docRef.get();
    if (!snap.exists) {
      const defaultContext = {
        activeNode: {
          moduleId: 'sum',
          title: 'Variable & Numeric Summing',
          difficulty: 'beginner',
          language: 'javascript'
        },
        skillMap: {},
        recentStruggles: [],
        lastSessionSummary: '',
        activeDocument: null,
        updatedAt: FieldValue.serverTimestamp()
      };
      await docRef.set(defaultContext);
      return defaultContext;
    }
    return snap.data();
  },

  async updateUserContext(userId, updates) {
    const docRef = adminDb.collection('users').doc(userId).collection('context').doc('active');
    await docRef.set({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return this.getUserContext(userId);
  },

  async updateContextAfterSubmission(userId, { challengeId, concepts = [], verdict }) {
    const context = await this.getUserContext(userId);
    const skillMap = { ...(context.skillMap || {}) };
    let recentStruggles = [...(context.recentStruggles || [])];

    const targetConcepts = concepts && concepts.length > 0 ? concepts : ['general_logic'];

    for (const concept of targetConcepts) {
      const currentVal = skillMap[concept] !== undefined ? skillMap[concept] : 0.0;
      if (verdict === 'pass') {
        const increment = 0.15;
        skillMap[concept] = Math.min(1.0, currentVal + increment);
        recentStruggles = recentStruggles.filter(s => s.concept !== concept);
      } else {
        const decrement = 0.05;
        skillMap[concept] = Math.max(0.0, currentVal - decrement);
        const exists = recentStruggles.some(s => s.concept === concept);
        if (!exists) {
          recentStruggles.push({
            concept,
            detail: `Failed challenge ${challengeId}`,
            at: new Date().toISOString()
          });
        }
      }
    }

    if (recentStruggles.length > 10) {
      recentStruggles = recentStruggles.slice(-10);
    }

    await this.updateUserContext(userId, { skillMap, recentStruggles });
    return this.getUserContext(userId);
  }
};

