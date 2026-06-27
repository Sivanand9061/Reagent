import React, { useState, useEffect } from 'react';
import { HelpCircle, ShieldAlert, Book, ArrowLeft, MessageSquare, Terminal, Columns, Code, Plus } from 'lucide-react';
import CodeEditor from './CodeEditor';
import MentorPanel from './MentorPanel';
import QuizPanel from './QuizPanel';
import CritiquePanel from './CritiquePanel';
import GlossarySidebar from './GlossarySidebar';
import SkillMap from './SkillMap';
import { useAuth } from '../context/AuthContext';

export default function SplitView({ 
  challengeId, 
  onExit, 
  onAddLogs, 
  logs, 
  userStats, 
  onRefreshStats,
  filterConcept,
  skillMap
}) {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState('explainer'); // 'explainer', 'quiz', 'critique', 'glossary'
  const [currentCode, setCurrentCode] = useState('');
  const [savedCode, setSavedCode] = useState('');
  const [layoutMode, setLayoutMode] = useState('split'); // 'split', 'code', 'chat'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [chatSessionId, setChatSessionId] = useState(Date.now());

  // Auto-route to quiz tab when a specific concept is targeted
  useEffect(() => {
    if (filterConcept) {
      setActiveTab('quiz');
    }
  }, [filterConcept]);

  const handleNewChat = async () => {
    setChatSessionId(Date.now());
    setActiveTab('explainer');
    if (onAddLogs) onAddLogs(['System: Started a new Socratic mentor session.']);
    try {
      const headers = await getAuthHeaders();
      await fetch(`http://localhost:5000/api/mentor/chat/${challengeId}`, {
        method: 'DELETE',
        headers
      });
    } catch (e) {
      console.error('Failed to clear database chat history on new session:', e);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load saved sandbox/challenge code on mount
  useEffect(() => {
    const fetchCode = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`http://localhost:5000/api/mentor/sandbox/${challengeId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.code) {
            setSavedCode(data.code);
            setCurrentCode(data.code);
          }
        }
      } catch (err) {
        console.error('Failed to load saved sandbox code:', err);
      }
    };
    
    const logStartActivity = async () => {
      try {
        const headers = await getAuthHeaders();
        await fetch('http://localhost:5000/api/mentor/log-activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            action: 'start_challenge',
            challengeId,
            metadata: { openedAt: new Date().toISOString() }
          })
        });
      } catch (err) {
        console.error('Failed to log challenge start activity:', err);
      }
    };

    fetchCode();
    logStartActivity();
  }, [challengeId]);

  const handleCodeChange = async (newCode) => {
    setCurrentCode(newCode);
    
    // Auto-save user code to backend database in background
    try {
      const headers = await getAuthHeaders();
      await fetch('http://localhost:5000/api/mentor/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ challengeId, code: newCode })
      });
    } catch (err) {
      console.error('Background code autosave failed:', err);
    }
  };

  const handleChallengeSuccess = async (cid, linesCount) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://localhost:5000/api/mentor/user-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ challengeId: cid, linesOfCode: linesCount })
      });

      if (res.ok) {
        const updatedStats = await res.json();
        if (onRefreshStats) onRefreshStats(updatedStats);
        onAddLogs([`System: Completed challenge "${cid}"! Added ${linesCount} lines written.`]);
      }
    } catch (err) {
      console.error('Failed to sync progress with DB:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', minHeight: 0, gap: '0px', overflow: 'hidden', padding: 0 }}>
      
      {/* Panels container */}
      <div className="workspace-container" style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: layoutMode === 'split' ? '0px' : '0px',
        flexGrow: 1,
        height: isMobile ? 'auto' : '0px',
        minHeight: 0,
        overflow: isMobile ? 'visible' : 'hidden'
      }}>
        {/* LEFT PANEL: Interactive Code Editor */}
        <div className="pdf-panel glass-panel" style={{ 
          display: layoutMode === 'chat' ? 'none' : 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          overflow: 'hidden',
          width: isMobile ? '100%' : (layoutMode === 'code' ? '100%' : 'calc(45% - 0.5rem)'),
          borderRadius: 0,
          border: 'none',
          borderRight: '1px solid var(--border)',
          flexShrink: 0
        }}>
          {/* Left Panel Top Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1.25rem',
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}>
            <button 
              onClick={onExit} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                fontSize: '0.85rem', 
                color: 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0
              }}
            >
              <ArrowLeft size={16} /> Back to Challenges
            </button>

            {/* Layout Toggles */}
            <div style={{ 
              display: 'flex', 
              background: 'var(--surface-2)', 
              padding: '0.15rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border)',
              gap: '0.25rem'
            }}>
              <button 
                onClick={() => setLayoutMode(prev => prev === 'code' ? 'split' : 'code')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: 'none',
                  background: layoutMode === 'code' ? 'var(--surface-1)' : 'transparent',
                  color: layoutMode === 'code' ? 'var(--accent)' : 'var(--text-secondary)',
                  boxShadow: layoutMode === 'code' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Code size={12} />
                Code Only
              </button>
              <button 
                onClick={() => setLayoutMode(prev => prev === 'chat' ? 'split' : 'chat')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: 'none',
                  background: layoutMode === 'chat' ? 'var(--surface-1)' : 'transparent',
                  color: layoutMode === 'chat' ? 'var(--accent)' : 'var(--text-secondary)',
                  boxShadow: layoutMode === 'chat' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <MessageSquare size={12} />
                Chat Only
              </button>
            </div>
          </div>

          {/* Collapsible Workspace Skill Map */}
          <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-1)', flexShrink: 0 }}>
            <details style={{ padding: '0.35rem 1.25rem' }}>
              <summary style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span> View Skill Map
              </summary>
              <div style={{ marginTop: '0.5rem', paddingBottom: '0.35rem' }}>
                <SkillMap skillMap={skillMap || {}} layout="strip" />
              </div>
            </details>
          </div>

          {/* Code writing section */}
          <div style={{ flexGrow: 1, padding: '0.5rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface-1)' }}>
            <CodeEditor 
              challengeId={challengeId}
              onCodeChange={handleCodeChange}
              onChallengeSuccess={handleChallengeSuccess}
              savedCode={savedCode}
              onRefreshStats={onRefreshStats}
            />
          </div>
        </div>

        {/* RIGHT PANEL: AI Learning & Mentorship Dashboard */}
        <div className="ai-panel glass-panel" style={{
          display: layoutMode === 'code' ? 'none' : 'flex',
          flexDirection: 'row', // Display sidebar and main content side-by-side
          height: '100%',
          width: isMobile ? '100%' : (layoutMode === 'chat' ? '100%' : 'calc(55% - 0.5rem)'),
          flexShrink: 0,
          background: 'var(--surface-0)',
          borderRadius: 0,
          border: 'none',
          overflow: 'hidden'
        }}>
          
          {/* Sleek Vertical Sidebar (Claude Style) */}
          <div style={{
            width: '64px',
            background: 'var(--surface-1)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 0',
            flexShrink: 0,
            height: '100%'
          }}>
            {/* Top Section: Plus & Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
              
              {/* New Chat Button */}
              <button 
                onClick={handleNewChat}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="New Chat Session"
              >
                <Plus size={18} />
              </button>

              {/* Spacer Line */}
              <div style={{ width: '24px', height: '1px', background: 'var(--border)' }} />

              {/* AI Mentor Tab */}
              <button 
                onClick={() => setActiveTab('explainer')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: activeTab === 'explainer' ? 'var(--accent)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: activeTab === 'explainer' ? 700 : 500,
                  width: '100%'
                }}
                title="AI Mentor Chat"
              >
                <MessageSquare size={18} />
                <span>Chat</span>
              </button>

              {/* Quiz Tab */}
              <button 
                onClick={() => setActiveTab('quiz')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: activeTab === 'quiz' ? 'var(--accent)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: activeTab === 'quiz' ? 700 : 500,
                  width: '100%'
                }}
                title="Practice Quiz"
              >
                <HelpCircle size={18} />
                <span>Quiz</span>
              </button>

              {/* Critique Tab */}
              <button 
                onClick={() => setActiveTab('critique')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: activeTab === 'critique' ? 'var(--accent)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: activeTab === 'critique' ? 700 : 500,
                  width: '100%'
                }}
                title="Code Critique"
              >
                <ShieldAlert size={18} />
                <span>Critique</span>
              </button>

              {/* Glossary Tab */}
              <button 
                onClick={() => setActiveTab('glossary')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: activeTab === 'glossary' ? 'var(--accent)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: activeTab === 'glossary' ? 700 : 500,
                  width: '100%'
                }}
                title="Syntax Cheat Sheet"
              >
                <Book size={18} />
                <span>Cheat</span>
              </button>
            </div>

            {/* Bottom Section: Avatar placeholder */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                {(userStats?.displayName || 'R').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Main Area inside AI Panel (Right of Sidebar) */}
          <div style={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            overflow: 'hidden', 
            background: 'var(--surface-0)' 
          }}>
            {/* Show Code Editor button when AI panel is full screen (Chat Only) */}
            {layoutMode === 'chat' && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                padding: '0.75rem 1.25rem',
                background: 'var(--surface-1)',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setLayoutMode('split')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0
                  }}
                >
                  <ArrowLeft size={16} /> Restore Split View (Show Code)
                </button>
              </div>
            )}
            
            {/* Tab Body Contents */}
            <div className="ai-panel-body" style={{ flexGrow: 1, overflow: 'hidden', padding: 0, background: 'var(--surface-0)' }}>
              {activeTab === 'explainer' && (
                <MentorPanel
                  challengeId={challengeId}
                  currentCode={currentCode}
                  onAddLogs={onAddLogs}
                  userStats={userStats}
                  onRefreshStats={onRefreshStats}
                  chatSessionId={chatSessionId}
                />
              )}

              {activeTab === 'quiz' && (
                <QuizPanel
                  challengeId={challengeId}
                  currentCode={currentCode}
                  onAddLogs={onAddLogs}
                  filterConcept={filterConcept}
                  onRefreshStats={onRefreshStats}
                />
              )}

              {activeTab === 'critique' && (
                <CritiquePanel
                  code={currentCode}
                  challengeId={challengeId}
                  onAddLogs={onAddLogs}
                />
              )}

              {activeTab === 'glossary' && (
                <GlossarySidebar />
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
