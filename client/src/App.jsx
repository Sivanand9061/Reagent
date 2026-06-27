import React, { useState, useEffect } from 'react';
import { 
  Home, Compass, Award, Settings, LogOut, Moon, Sun, 
  Cpu, ChevronRight, Play, CheckCircle2, Code, UploadCloud 
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import SplitView from './components/SplitView';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import SkillMap from './components/SkillMap';
import UploadScreen from './components/UploadScreen';

export default function App() {
  const { currentUser, logout, getAuthHeaders } = useAuth();
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'skillmap', 'modules', 'workspace'
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [filterConcept, setFilterConcept] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  
  const [userStats, setUserStats] = useState({
    challengesCompleted: [],
    linesOfCodeWritten: 0,
    conceptsMastered: 0
  });

  const [roadmap, setRoadmap] = useState(null);
  const [sessionContext, setSessionContext] = useState(null);

  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Authenticate guard
  if (!currentUser) {
    return <AuthScreen />;
  }

  // Load user data on mount
  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser]);

  // Lock body scroll in workspace view
  useEffect(() => {
    if (activeView === 'workspace') {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [activeView]);

  const loadUserData = async () => {
    console.log("App: loadUserData triggered.");
    try {
      const headers = await getAuthHeaders();
      
      // 1. Fetch user stats
      const statsRes = await fetch('http://localhost:5000/api/mentor/user-stats', { headers });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        console.log("App: Successfully loaded user stats:", stats);
        setUserStats(stats);
      } else {
        console.warn("App: Failed to fetch user stats. Code:", statsRes.status);
      }

      // 2. Fetch context and roadmap
      const roadmapRes = await fetch('http://localhost:5000/api/mentor/roadmap', { headers });
      if (roadmapRes.ok) {
        const data = await roadmapRes.json();
        console.log("App: Successfully loaded active context and roadmap:", data);
        setRoadmap(data.roadmap || null);
        setSessionContext(data.context || null);
      } else {
        console.warn("App: Failed to fetch active context/roadmap. Code:", roadmapRes.status);
      }
    } catch (err) {
      console.error('App: Failed to load user data:', err);
    }
  };

  const handleAddLogs = (newLogs) => {
    setLogs((prev) => [...prev, ...newLogs]);
  };

  const handleRefreshStats = (newStats) => {
    console.log("App: handleRefreshStats invoked with:", newStats);
    if (newStats) {
      setUserStats(newStats);
    }
    loadUserData(); // Fetch updated context and skillmap
  };

  const handleStartChallenge = (cid, concept = null) => {
    setFilterConcept(concept);
    setActiveChallenge(cid);
    setActiveView('workspace');
  };

  return (
    <div className={`app-container ${activeView === 'workspace' ? 'workspace-mode' : ''}`} style={activeView === 'workspace' ? { height: '100vh', overflow: 'hidden' } : {}}>
      
      {/* Collapsible Persistent Sidebar Left Rail */}
      <aside className="app-sidebar">
        <div className="sidebar-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.85rem', marginBottom: '1rem', flexShrink: 0 }}>
            <div className="logo-icon" style={{ background: 'var(--accent)', padding: '0.4rem', borderRadius: 'var(--radius-sm)' }}>
              <Cpu size={18} style={{ color: 'white' }} />
            </div>
            <span className="sidebar-label" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              Reagent
            </span>
          </div>

          <button 
            onClick={() => setActiveView('dashboard')} 
            className={`sidebar-link ${activeView === 'dashboard' ? 'active' : ''}`}
            title="Dashboard"
          >
            <Home size={18} />
            <span className="sidebar-label">Dashboard</span>
          </button>

          <button 
            onClick={() => {
              if (!activeChallenge) setActiveChallenge('sandbox');
              setActiveView('workspace');
            }} 
            className={`sidebar-link ${activeView === 'workspace' ? 'active' : ''}`}
            title="Code Sandbox"
          >
            <Code size={18} />
            <span className="sidebar-label">Code Sandbox</span>
          </button>

          <button 
            onClick={() => setActiveView('skillmap')} 
            className={`sidebar-link ${activeView === 'skillmap' ? 'active' : ''}`}
            title="Skill Map"
          >
            <Award size={18} />
            <span className="sidebar-label">Skill Map</span>
          </button>

          <button 
            onClick={() => setActiveView('modules')} 
            className={`sidebar-link ${activeView === 'modules' ? 'active' : ''}`}
            title="Modules"
          >
            <Compass size={18} />
            <span className="sidebar-label">Modules</span>
          </button>

          <button 
            onClick={() => setActiveView('upload')} 
            className={`sidebar-link ${activeView === 'upload' ? 'active' : ''}`}
            title="Upload Document"
          >
            <UploadCloud size={18} />
            <span className="sidebar-label">Upload PDF</span>
          </button>

          {/* Sidebar Footer Controls */}
          <div className="sidebar-footer">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="sidebar-link"
              title={darkMode ? "Light Mode" : "Dark Mode"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span className="sidebar-label">{darkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>

            <button 
              onClick={() => setShowSettings(true)} 
              className="sidebar-link"
              title="API Settings"
            >
              <Settings size={18} />
              <span className="sidebar-label">API Keys</span>
            </button>

            <button 
              onClick={logout} 
              className="sidebar-link sidebar-link-danger"
              title="Sign Out"
            >
              <LogOut size={18} />
              <span className="sidebar-label">Sign Out</span>
            </button>

            <div className="sidebar-user-info">
              <div className="sidebar-avatar">
                {(currentUser.displayName || 'R').charAt(0).toUpperCase()}
              </div>
              <div className="sidebar-label" style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', overflow: 'hidden' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentUser.displayName || 'Developer'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentUser.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav">
        <button
          onClick={() => setActiveView('dashboard')}
          className={`mobile-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
        >
          <Home size={20} />
          <span>Home</span>
        </button>
        <button
          onClick={() => setActiveView('skillmap')}
          className={`mobile-nav-item ${activeView === 'skillmap' ? 'active' : ''}`}
        >
          <Award size={20} />
          <span>Skills</span>
        </button>
        <button
          onClick={() => setActiveView('modules')}
          className={`mobile-nav-item ${activeView === 'modules' ? 'active' : ''}`}
        >
          <Compass size={20} />
          <span>Modules</span>
        </button>
        <button
          onClick={() => setActiveView('upload')}
          className={`mobile-nav-item ${activeView === 'upload' ? 'active' : ''}`}
        >
          <UploadCloud size={20} />
          <span>Upload</span>
        </button>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="mobile-nav-item"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span>Theme</span>
        </button>
      </nav>

      {/* Main Page Layout Wrapper */}
      <main style={{ display: 'flex', flexGrow: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: '100vh', paddingBottom: activeView === 'workspace' ? '0px' : '64px' }}>
        {globalLoading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--surface-0)', opacity: 0.8, backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div className="cyber-loader" />
          </div>
        )}

        {/* Dynamic View Mounts */}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: activeView === 'workspace' ? 'hidden' : 'auto', height: activeView === 'workspace' ? '100vh' : 'auto' }}>
          {activeView === 'dashboard' && (
            <Dashboard 
              onStartChallenge={handleStartChallenge} 
            />
          )}

          {activeView === 'skillmap' && (
            <SkillMapView 
              userStats={{ ...userStats, skillMap: sessionContext?.skillMap || {}, recentStruggles: sessionContext?.recentStruggles || [] }} 
            />
          )}

          {activeView === 'modules' && (
            <ModulesView 
              roadmap={roadmap} 
              userStats={userStats} 
              onStartChallenge={handleStartChallenge}
            />
          )}

          {activeView === 'upload' && (
            <UploadScreen 
              onUploadSuccess={() => {
                setActiveView('dashboard');
                loadUserData();
              }}
            />
          )}

          {activeView === 'workspace' && (
            <SplitView 
              challengeId={activeChallenge || 'sandbox'} 
              onExit={() => setActiveView('dashboard')}
              onAddLogs={handleAddLogs} 
              logs={logs}
              userStats={userStats}
              onRefreshStats={handleRefreshStats}
              filterConcept={filterConcept}
              skillMap={sessionContext?.skillMap || {}}
              recentStruggles={sessionContext?.recentStruggles || []}
            />
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

// ─── NESTED SUB-VIEWS ──────────────────────────────────────────────────────────

function SkillMapView({ userStats }) {
  return (
    <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Concept Skill Map</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          This map visualizes your current topic mastery based on direct sandbox activity and quiz results.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)' }}>
        <SkillMap skillMap={userStats?.skillMap || {}} recentStruggles={userStats?.recentStruggles || []} layout="grid" />
      </div>

      {userStats?.recentStruggles?.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Recent Struggles</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {userStats.recentStruggles.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '0.5rem 0', borderBottom: idx < userStats.recentStruggles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.concept}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{s.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModulesView({ roadmap, userStats, onStartChallenge }) {
  const [search, setSearch] = useState('');
  if (!roadmap) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <Compass size={48} style={{ color: 'var(--text-muted)' }} />
        <h3 style={{ color: 'var(--text-primary)' }}>No Roadmap Generated</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '320px', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Go to the Dashboard and enter your target career role to generate a personalized learning roadmap.
        </p>
      </div>
    );
  }

  const completed = userStats?.challengesCompleted || [];
  const filteredModules = roadmap.modules.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase()) || 
    m.description.toLowerCase().includes(search.toLowerCase()) ||
    m.skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Roadmap Modules</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Browse all coding stages generated for your target career role: <strong>{roadmap.jobRole}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
        <input 
          type="text" 
          placeholder="Search modules or skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredModules.map((m, idx) => {
          const isCompleted = completed.includes(m.challengeId);
          const isNext = !isCompleted && (idx === 0 || completed.includes(roadmap.modules[idx - 1]?.challengeId));
          const isLocked = !isCompleted && !isNext;

          return (
            <div 
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                opacity: isLocked ? 0.6 : 1
              }}
              className="glass-panel"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '80%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    color: isCompleted ? 'var(--success)' : isNext ? 'var(--accent)' : 'var(--text-muted)',
                    textTransform: 'uppercase'
                  }}>
                    {isCompleted ? '✓ Completed' : isNext ? '● In Progress' : '○ Locked'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    • {m.language || 'javascript'}
                  </span>
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{m.title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{m.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {m.skills?.map(s => (
                    <span key={s} style={{ fontSize: '0.72rem', background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                {isCompleted ? (
                  <button 
                    onClick={() => onStartChallenge(m.challengeId)}
                    className="settings-btn"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                  >
                    Review Code
                  </button>
                ) : isNext ? (
                  <button 
                    onClick={() => onStartChallenge(m.challengeId)}
                    className="browse-btn"
                    style={{ margin: 0, fontSize: '0.8rem', padding: '0.4rem 1.25rem', background: 'var(--accent)', borderColor: 'var(--accent)' }}
                  >
                    Start
                  </button>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Locked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
