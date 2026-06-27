import React, { useEffect, useState, useRef } from 'react';
import { 
  Award, Code, Brain, Play, Compass, Trash2, ArrowRight, 
  Lock, CheckCircle2, ChevronRight, RefreshCw 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CHALLENGES } from './CodeEditor';
import SkillMap from './SkillMap';

export default function Dashboard({ onStartChallenge }) {
  const { currentUser, getAuthHeaders } = useAuth();
  const [profile, setProfile] = useState({
    challengesCompleted: [],
    linesOfCodeWritten: 0,
    conceptsMastered: 0
  });
  const [roadmap, setRoadmap] = useState(null);
  const [sessionContext, setSessionContext] = useState(null);
  const [jobRoleInput, setJobRoleInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const roleInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
      // 1. Fetch user stats
      const statsRes = await fetch('http://localhost:5000/api/mentor/user-stats', { headers });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setProfile(stats);
      }
      
      // 2. Fetch active career roadmap and context
      const roadmapRes = await fetch('http://localhost:5000/api/mentor/roadmap', { headers });
      if (roadmapRes.ok) {
        const data = await roadmapRes.json();
        setRoadmap(data.roadmap || null);
        setSessionContext(data.context || null);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRoadmap = async (e) => {
    e.preventDefault();
    if (!jobRoleInput.trim() || generating) return;
    
    setGenerating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://localhost:5000/api/mentor/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ jobRole: jobRoleInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setRoadmap(data.roadmap);
      } else {
        const errData = await res.json();
        alert(`Failed to analyze market and build roadmap: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to the roadmap generator.');
    } finally {
      setGenerating(false);
    }
  };

  const handleResetRoadmap = async () => {
    if (window.confirm("Are you sure you want to reset your career journey? This will delete your custom generated roadmap nodes.")) {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('http://localhost:5000/api/mentor/roadmap', {
          method: 'DELETE',
          headers
        });
        if (res.ok) {
          setRoadmap(null);
          setJobRoleInput('');
        }
      } catch (err) {
        console.error('Failed to reset roadmap:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const getNextModule = () => {
    if (!roadmap || !roadmap.modules) return null;
    const completed = profile.challengesCompleted || [];
    return roadmap.modules.find(m => !completed.includes(m.challengeId));
  };

  const nextModule = getNextModule();
  const completedCount = roadmap?.modules?.filter(m => profile.challengesCompleted?.includes(m.challengeId)).length || 0;
  
  const handleCTAClick = () => {
    if (nextModule) {
      onStartChallenge(nextModule.challengeId);
    } else if (roadmap) {
      // All completed, launch sandbox
      onStartChallenge('sandbox');
    } else {
      // Focus role input
      if (roleInputRef.current) {
        roleInputRef.current.focus();
        roleInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="cyber-loader" />
      </div>
    );
  }

  if (generating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1.5rem', background: '#f7f9fb', padding: '2rem' }}>
        <div className="cyber-loader" style={{ width: '60px', height: '60px' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>Scraping Live 2026 Job Market Requirements...</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '450px', textAlign: 'center', lineHeight: 1.5 }}>
          Please hold on while our AI analyzes current hiring requirements and designs a structured, 4-step programming curriculum tailored specifically to your goal.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '2rem', flexGrow: 1, overflowY: 'auto', background: 'var(--surface-0)', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      
      {/* 1. Welcoming Hero Banner */}
      <div className="glass-panel" style={{ 
        padding: '2.5rem', 
        background: 'linear-gradient(135deg, #1e1e1e 0%, #111111 100%)', 
        color: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: 'none'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent)' }}>
            Reagent Academy
          </span>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25, fontFamily: 'var(--font-display)' }}>
            {roadmap ? (
              nextModule ? (
                <>Welcome back, {currentUser?.displayName || 'Developer'}!<br />Ready to tackle <span style={{ color: 'var(--accent)' }}>{nextModule.title}</span>?</>
              ) : (
                <>Congratulations, {currentUser?.displayName || 'Developer'}!<br />You've fully completed the <span style={{ color: 'var(--success)' }}>{roadmap.jobRole}</span> journey! 🏆</>
              )
            ) : (
              <>Welcome, {currentUser?.displayName || 'Developer'}!<br />Ready to design your career roadmap?</>
            )}
          </h2>
        </div>
        
        <p style={{ color: '#a0a0a0', fontSize: '0.92rem', lineHeight: 1.5, maxWidth: '550px', margin: 0 }}>
          {roadmap ? (
            nextModule ? (
              sessionContext?.lastSessionSummary ? (
                <><strong>Last practice session:</strong> {sessionContext.lastSessionSummary}</>
              ) : (
                `You are currently progressing through the ${roadmap.jobRole} curriculum. You have completed ${completedCount} of 4 steps. Continue your coding modules now.`
              )
            ) : (
              `You've mastered all core assessment nodes for ${roadmap.jobRole}. Use the Free Code Sandbox to continue your practice, build projects, and review with your AI mentor!`
            )
          ) : (
            `Kickstart your personalized learning program. Type in your target software role below. Our AI will scrape real-world job market data to generate a custom 4-stage coding path.`
          )}
        </p>

        {/* Start button only if no roadmap exists */}
        {!roadmap && (
          <div>
            <button 
              onClick={handleCTAClick}
              style={{
                background: '#ffffff',
                color: '#000000',
                padding: '0.75rem 1.75rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              Get Started
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* 1.5. Clickable Skill Map strip (Only if roadmap exists) */}
      {roadmap && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>
            Your concept mastery map (Click a cell to target it in micro-challenges)
          </h4>
          <SkillMap 
            skillMap={sessionContext?.skillMap || {}} 
            onConceptClick={(concept) => {
              if (nextModule) {
                onStartChallenge(nextModule.challengeId, concept);
              } else {
                onStartChallenge('sandbox', concept);
              }
            }} 
            layout="strip" 
          />
        </div>
      )}

      {/* 2. Target Job Role Scraper Input (Only if no roadmap generated) */}
      {!roadmap && (
        <div className="glass-panel" style={{ padding: '2rem', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
              <Compass size={20} style={{ color: 'var(--accent)' }} />
              Scrape Market & Generate Career Roadmap
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Enter the exact career position you want to target (e.g. AI Engineer, React Frontend Developer, DevOps Architect).
            </p>
          </div>

          <form onSubmit={handleGenerateRoadmap} style={{ display: 'flex', gap: '0.75rem' }}>
            <input 
              ref={roleInputRef}
              type="text" 
              placeholder="e.g. AI Engineer, Fullstack Node Developer, Data Analyst..." 
              value={jobRoleInput}
              onChange={(e) => setJobRoleInput(e.target.value)}
              style={{
                flexGrow: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.9rem',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)'
              }}
            />
            <button 
              type="submit"
              disabled={!jobRoleInput.trim()}
              style={{
                background: !jobRoleInput.trim() ? 'var(--surface-2)' : 'var(--text-primary)',
                color: !jobRoleInput.trim() ? 'var(--text-muted)' : 'var(--surface-1)',
                padding: '0.75rem 1.75rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: !jobRoleInput.trim() ? 'default' : 'pointer',
                border: '1px solid var(--border)'
              }}
            >
              Analyze & Scrape
            </button>
          </form>
        </div>
      )}

      {/* 3. Visual Timeline Roadmap Node Graph (Only if roadmap exists) */}
      {roadmap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Target Path: <span style={{ color: 'var(--accent)' }}>{roadmap.jobRole}</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Completed {completedCount} / 4 assessment nodes.
              </p>
            </div>
            <button 
              onClick={handleResetRoadmap}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                color: 'var(--danger)',
                fontWeight: 600,
                background: 'transparent',
                border: '1px solid var(--border)',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Trash2 size={12} />
              Reset Path
            </button>
          </div>

          {/* Vertical Timeline container */}
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            paddingLeft: '1.5rem'
          }}>
            {/* Thread Line connecting circles */}
            <div style={{
              position: 'absolute',
              top: '1.5rem',
              bottom: '1.5rem',
              left: 'calc(1.5rem + 7px)',
              width: '2px',
              background: 'var(--border)',
              zIndex: 1
            }} />

            {roadmap.modules.map((mod, index) => {
              const isCompleted = profile.challengesCompleted?.includes(mod.challengeId);
              const isActive = !isCompleted && (!nextModule || nextModule.challengeId === mod.challengeId);
              const isLocked = !isCompleted && !isActive;

              return (
                <div 
                  key={mod.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1.5rem',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  {/* Timeline Circle Bullet */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0, background: 'var(--surface-0)', borderRadius: '50%' }}>
                    {isCompleted ? (
                      /* Completed node: Filled circle success color */
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--success)',
                        border: '2px solid var(--success)'
                      }} />
                    ) : isActive ? (
                      /* Active node: Half-filled circle with accent color */
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: '2px solid var(--accent)',
                        background: 'linear-gradient(90deg, var(--accent) 50%, transparent 50%)',
                        boxShadow: '0 0 0 3px var(--accent-soft)'
                      }} />
                    ) : (
                      /* Locked node: Empty circle outline */
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: '2px solid var(--border-strong)',
                        backgroundColor: 'transparent'
                      }} />
                    )}
                  </div>

                  {/* Roadmap Node Card */}
                  <div 
                    className="glass-panel" 
                    style={{
                      flexGrow: 1,
                      padding: '1.5rem',
                      background: 'var(--surface-1)',
                      borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                      boxShadow: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: isLocked ? 0.6 : 1,
                      gap: '1.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                            {mod.title}
                          </h4>
                          {isCompleted && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--success)', background: 'var(--surface-2)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              Mastered
                            </span>
                          )}
                          {isActive && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              Current Node
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mod.description}
                        </p>
                      </div>

                      {/* Skills Tags */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {mod.skills?.map((skill, si) => (
                          <span key={si} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 500 }}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Launch Action Button */}
                    <div style={{ flexShrink: 0 }}>
                      {isLocked ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Locked</span>
                      ) : (
                        <button
                          onClick={() => onStartChallenge(mod.challengeId)}
                          style={{
                            background: isActive ? 'var(--accent)' : 'transparent',
                            color: isActive ? '#ffffff' : 'var(--text-primary)',
                            border: isActive ? 'none' : '1px solid var(--border-strong)',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          {isCompleted ? 'Review Code' : (mod.challengeId === 'sandbox' ? 'Open Sandbox' : 'Solve Code')}
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 4. Global Stats Footer Summary (Only if roadmap exists) */}
      {roadmap && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-display)' }}>Lines Written</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.2rem' }}>{profile.linesOfCodeWritten}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-display)' }}>Mastery Count</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>{profile.conceptsMastered}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-display)' }}>Roadmap Progress</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--momentum)', marginTop: '0.2rem' }}>{Math.round((completedCount / 4) * 100)}%</p>
          </div>
        </div>
      )}

    </div>
  );
}
