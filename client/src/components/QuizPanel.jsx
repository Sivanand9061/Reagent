import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle2, AlertCircle, Award, RotateCcw, Play, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

export default function QuizPanel({ challengeId, currentCode, onAddLogs, filterConcept }) {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editorCode, setEditorCode] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [answersStatus, setAnswersStatus] = useState([]); // Array of statuses
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    if (questions && questions[currentIdx]) {
      setEditorCode(questions[currentIdx].codeTemplate || '');
      setVerifyResult(null);
    }
  }, [questions, currentIdx]);

  // Regenerate quiz automatically if filterConcept changes
  useEffect(() => {
    if (filterConcept) {
      generateQuiz();
    }
  }, [filterConcept, challengeId]);

  const generateQuiz = async () => {
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setEditorCode('');
    setVerifyResult(null);
    setAnswersStatus([]);
    setScore(0);
    setQuizFinished(false);

    try {
      const response = await fetch('http://localhost:5000/api/mentor/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ challengeId, currentCode, filterConcept }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate code quiz');
      }

      const data = await response.json();
      setQuestions(data.challenges || []);
      if (data.logs) {
        onAddLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
      alert('Error generating code assessment quiz.');
      onAddLogs([`Quiz Agent Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    const currentQuestion = questions[currentIdx];
    if (!currentQuestion) return;

    try {
      // Define a custom lightweight assertion runner
      const assert = {
        equal: (actual, expected) => {
          if (actual !== expected) {
            throw new Error(`Expected ${expected}, but got ${actual}`);
          }
        }
      };

      // Wrap assertion checks
      const evaluator = new Function('assert', `
        ${editorCode}
        ${currentQuestion.tests}
      `);

      evaluator(assert);

      // Successfully passed the micro-challenge
      setVerifyResult({ success: true, message: '🎉 Correct! All assertions passed.' });

      // Save pass state if not already logged for this index
      if (answersStatus[currentIdx] === undefined) {
        setScore(prev => prev + 1);
        setAnswersStatus(prev => {
          const next = [...prev];
          next[currentIdx] = { isCorrect: true };
          return next;
        });
      }
    } catch (err) {
      setVerifyResult({ success: false, message: `❌ Verification failed: ${err.message}` });
      if (answersStatus[currentIdx] === undefined) {
        setAnswersStatus(prev => {
          const next = [...prev];
          next[currentIdx] = { isCorrect: false };
          return next;
        });
      }
    }
  };

  const handleNext = () => {
    setVerifyResult(null);
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setQuizFinished(true);
      triggerConfetti();
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const resetQuiz = () => {
    setQuestions([]);
    setQuizFinished(false);
    setCurrentIdx(0);
    setScore(0);
    setVerifyResult(null);
  };

  // 1. Initial Launch Screen
  if (questions.length === 0 && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.25rem', textAlign: 'center', padding: '2rem' }}>
        <HelpCircle size={48} style={{ color: 'var(--accent)' }} />
        <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Syntax & Logic Assessment</h3>
        <p style={{ maxWidth: '320px', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Complete 3 targeted coding micro-challenges. Modify starter code templates and verify your logic against live assertions!
        </p>
        <button onClick={generateQuiz} className="browse-btn" style={{ margin: 0, padding: '0.65rem 2rem', background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' }}>
          Launch Challenge Quiz
        </button>
      </div>
    );
  }

  // 2. Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
        <div className="cyber-loader"></div>
        <div className="loading-text" style={{ color: 'var(--accent)' }}>Quiz Agent: Formulating challenges...</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Synthesizing runnable coding templates tailored to your struggles.</p>
      </div>
    );
  }

  // 3. Quiz finished screen
  if (quizFinished) {
    return (
      <div className="quiz-complete-card glass-panel" style={{ padding: '2rem', textAlign: 'center', background: 'var(--surface-1)', margin: '1rem' }}>
        <div className="trophy-icon" style={{ marginBottom: '1rem' }}>
          <Award size={64} style={{ color: 'var(--momentum)' }} />
        </div>
        <h2 className="quiz-complete-title" style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Challenges Finished!</h2>
        <div className="score-display" style={{ margin: '1rem 0', fontSize: '1rem' }}>
          Your score:
          <span className="score-number" style={{ display: 'block', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{score} / {questions.length}</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '320px', margin: '0 auto 1.5rem auto' }}>
          {score === questions.length 
            ? 'Excellent! Perfect score! You have fully mastered these concepts.' 
            : 'Good effort! Read the explanations to lock in the coding concepts.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button onClick={generateQuiz} className="browse-btn" style={{ margin: 0, padding: '0.5rem 1.25rem', background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RotateCcw size={16} /> Retake Assessment
          </button>
          <button onClick={resetQuiz} className="settings-btn" style={{ padding: '0.5rem 1.25rem' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // 4. Active Quiz screen
  const currentQuestion = questions[currentIdx];

  return (
    <div className="quiz-container" style={{ padding: '0.5rem' }}>
      <div className="quiz-card glass-panel" style={{ padding: '1.25rem', background: 'var(--surface-1)' }}>
        
        {/* Concept target notification */}
        {filterConcept && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', fontWeight: 600, display: 'inline-block' }}>
            Targeting: {filterConcept} (selected concept)
          </div>
        )}

        <div className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>
          <span>Challenge {currentIdx + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>

        <h3 className="quiz-question" style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {currentQuestion?.title || 'Coding Task'}
        </h3>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: '0 0 1rem 0' }}>
          {currentQuestion?.instruction}
        </p>

        {/* Mini Editor Textarea */}
        <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'var(--surface-2)', fontSize: '0.7rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontFamily: 'monospace' }}>
            <span>micro_challenge.js</span>
          </div>
          <textarea
            value={editorCode}
            onChange={(e) => setEditorCode(e.target.value)}
            spellCheck="false"
            style={{
              width: '100%',
              height: '140px',
              padding: '0.75rem',
              background: '#1c1c22',
              color: '#EDEDF0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              border: 'none',
              resize: 'none',
              outline: 'none'
            }}
          />
        </div>

        {/* Verification Trigger Button */}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleVerify}
            style={{ margin: 0, padding: '0.5rem 1.25rem', fontSize: '0.82rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <Play size={12} /> Run & Verify
          </button>
        </div>

        {/* Verification Result Display */}
        {verifyResult && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-sm)', 
            fontSize: '0.85rem', 
            lineHeight: '1.5',
            background: verifyResult.success ? 'var(--accent-soft)' : 'rgba(220, 38, 38, 0.05)',
            border: verifyResult.success ? '1px solid var(--accent)' : '1px solid var(--danger)',
            color: verifyResult.success ? 'var(--text-primary)' : 'var(--danger)'
          }}>
            <div className="feedback-title" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
              {verifyResult.success ? 'Success!' : 'Verification Failed'}
            </div>
            <p className="feedback-desc" style={{ margin: 0, color: 'var(--text-primary)' }}>{verifyResult.message}</p>
            {verifyResult.success && currentQuestion?.explanation && (
              <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                <strong>Explanation:</strong> {currentQuestion.explanation}
              </p>
            )}
          </div>
        )}

        {/* Next Question Navigation Bar */}
        {answersStatus[currentIdx] !== undefined && (
          <div className="quiz-action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {verifyResult?.success ? 'Success! Ready to advance.' : 'Try correcting the bugs and verify again.'}
            </span>
            <button 
              onClick={handleNext} 
              className="browse-btn"
              style={{ margin: 0, padding: '0.4rem 1rem', background: 'var(--text-primary)', color: 'var(--surface-1)', fontSize: '0.8rem', border: '1px solid var(--text-primary)' }}
            >
              {currentIdx + 1 === questions.length ? 'Finish Quiz' : 'Next Challenge'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
