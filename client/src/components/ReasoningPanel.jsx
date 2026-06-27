import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronUp, ChevronDown } from 'lucide-react';

export default function ReasoningPanel({ logs }) {
  const [isOpen, setIsOpen] = useState(false);
  const consoleEndRef = useRef(null);

  useEffect(() => {
    // Scroll console log to bottom when open or on new logs
    if (isOpen && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const formatTimestamp = (index) => {
    // Generate logical timestamps based on log index to look authentic
    const now = new Date();
    now.setSeconds(now.getSeconds() - (logs.length - index) * 2);
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className={`reasoning-panel ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="reasoning-header" onClick={() => setIsOpen(!isOpen)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={14} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Agent Reasoning Console</span>
          {logs.length > 0 && (
            <span className="log-count-badge">
              {logs.length}
            </span>
          )}
        </span>
        <button className="toggle-btn" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          {isOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      {isOpen && (
        <div className="reasoning-logs">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              <span style={{ color: 'var(--border-active)', marginRight: '0.4rem', fontWeight: 600 }}>
                [{formatTimestamp(index)}]
              </span>
              <span>{log}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="log-entry">
              <span style={{ color: 'var(--border-active)', marginRight: '0.4rem', fontWeight: 600 }}>
                [{new Date().toLocaleTimeString()}]
              </span>
              <span>Console idle. Upload a paper or highlight text to trigger agents.</span>
            </div>
          )}
          <div ref={consoleEndRef} />
        </div>
      )}
    </div>
  );
}

