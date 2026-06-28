import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut, ShieldAlert } from 'lucide-react';

export default function SettingsScreen() {
  const { currentUser, logout } = useAuth();
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  // Staleness threshold state
  const [stalenessDays, setStalenessDays] = useState(() => {
    return parseInt(localStorage.getItem('stalenessDays')) || 90;
  });

  // Apply theme class
  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleStalenessChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setStalenessDays(val);
    localStorage.setItem('stalenessDays', val);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary p-8">
      <div className="max-w-[600px] flex flex-col gap-8">
        
        {/* Title */}
        <div className="flex flex-col gap-1 border-b border-border-subtle pb-4">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Settings</h2>
          <p className="text-sm text-text-secondary">Manage your workspace configuration and preferences</p>
        </div>

        {/* Account Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Account</h3>
          <div className="bg-bg-secondary border border-border-subtle rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-text-primary">
                {currentUser?.displayName || 'User'}
              </div>
              <div className="text-xs text-text-secondary">
                {currentUser?.email || 'No email associated'}
              </div>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 border border-border-subtle bg-bg-primary hover:bg-bg-tertiary text-text-primary rounded text-xs font-medium transition-colors focus:outline-none"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>

        {/* Display Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Appearance</h3>
          <div className="bg-bg-secondary border border-border-subtle rounded p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-text-primary">Theme</div>
              <div className="text-xs text-text-secondary">Switch between light and dark visual aesthetics</div>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 border border-border-subtle bg-bg-primary hover:bg-bg-tertiary text-text-primary rounded transition-colors focus:outline-none"
              title="Toggle theme mode"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Q&A Engine Configuration */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Q&A Engine Settings</h3>
          
          <div className="bg-bg-secondary border border-border-subtle rounded p-4 flex flex-col gap-4">
            <div>
              <div className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-text-secondary" />
                Staleness warning threshold
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                Flag documents cited in the same answer when one is older than another by this many days
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="7"
                max="365"
                value={stalenessDays}
                onChange={handleStalenessChange}
                className="flex-1 accent-brand-accent cursor-pointer bg-border-strong rounded-lg appearance-none h-1"
              />
              <div className="w-16 text-right">
                <span className="text-sm font-semibold text-text-primary">{stalenessDays}</span>
                <span className="text-xs text-text-muted ml-0.5">d</span>
              </div>
            </div>
            
            <p className="text-[11px] text-text-muted">
              Citations referencing documents uploaded more than {stalenessDays} days apart will display an inline staleness warning.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
