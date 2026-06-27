import React, { useState } from 'react';
import { ShieldCheck, MessageSquareWarning, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CritiquePanel({ code, challengeId, onAddLogs }) {
  const { getAuthHeaders } = useAuth();
  const [critiques, setCritiques] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateCritique = async () => {
    setLoading(true);
    setCritiques([]);

    try {
      const response = await fetch('http://localhost:5000/api/mentor/critique', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ code, challengeId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate code review');
      }

      const data = await response.json();
      setCritiques(data.critiques);
      if (data.logs) {
        onAddLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching code review critiques.');
      onAddLogs([`Critique Agent Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  // 1. Initial Call-to-action screen
  if (critiques.length === 0 && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.25rem', textAlign: 'center', padding: '2rem' }}>
        <ShieldCheck size={48} style={{ color: 'var(--accent-purple)' }} />
        <h3>AI Code Reviewer</h3>
        <p style={{ maxWidth: '350px', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Analyze your editor code. The Critique Agent will check Big O time/space complexity, check for security bugs, and suggest optimizations.
        </p>
        <button onClick={generateCritique} className="browse-btn" disabled={!code.trim()}>
          Run Code Review
        </button>
      </div>
    );
  }

  // 2. Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem' }}>
        <div className="cyber-loader"></div>
        <div className="loading-text" style={{ color: 'var(--accent-purple)' }}>
          Review Agent: Analyzing code complexity...
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Calculating Big O efficiency parameters and scanning logic flow.</p>
      </div>
    );
  }

  // 3. Render Critiques
  return (
    <div className="critique-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-purple)' }} />
          Code Optimization Insights
        </h4>
        <button 
          onClick={generateCritique} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}
          className="settings-btn"
        >
          <RefreshCcw size={12} /> Re-Review
        </button>
      </div>

      {critiques.map((critique, idx) => (
        <div key={idx} className="critique-card glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-purple)', background: '#ffffff', marginBottom: '0.75rem' }}>
          <div className="critique-card-title" style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            {idx + 1}. {critique.title}
          </div>
          <div className="critique-card-desc" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {critique.description}
          </div>
        </div>
      ))}
    </div>
  );
}
