import React, { useState } from 'react';
import { X, Key, ShieldAlert } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('x-gemini-key') || '');
  const [groqKey, setGroqKey] = useState(localStorage.getItem('x-groq-key') || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('x-gemini-key', geminiKey.trim());
    localStorage.setItem('x-groq-key', groqKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>
            <Key size={22} className="logo-icon" style={{ padding: '0.25rem', width: '28px', height: '28px' }} />
            API Configurations
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-group">
          <label className="settings-label">Gemini API Key</label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="settings-input"
          />
        </div>

        <div className="settings-group">
          <label className="settings-label">Groq API Key</label>
          <input
            type="password"
            placeholder="gsk_..."
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            className="settings-input"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
          <ShieldAlert size={28} style={{ flexShrink: 0, color: 'var(--accent-purple)' }} />
          <span>
            Keys are stored locally in your browser cache (localStorage) and sent only in headers.
            If left blank, the server will fall back to its internal <code>.env</code> file keys.
          </span>
        </div>

        <button onClick={handleSave} className="settings-save-btn">
          {saved ? 'Settings Saved!' : 'Save Configurations'}
        </button>
      </div>
    </div>
  );
}
