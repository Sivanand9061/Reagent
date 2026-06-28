import React, { useState, useEffect } from 'react';
import { FileText, Send, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import DocumentsScreen from './components/DocumentsScreen';
import AskScreen from './components/AskScreen';
import SettingsScreen from './components/SettingsScreen';

export default function App() {
  const { currentUser, logout } = useAuth();
  const [activeView, setActiveView] = useState('documents'); // 'documents' | 'ask' | 'settings'

  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Apply dark mode class to document element on mount/change
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Auth guard: Redirect if user is not signed in
  if (!currentUser) {
    return <AuthScreen />;
  }

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      
      {/* ─── LEFT RAIL NAVIGATION ──────────────────────────────────────────────── */}
      <div className="w-64 bg-bg-secondary border-r border-border-subtle flex flex-col justify-between flex-shrink-0 selection:bg-brand-accent selection:text-bg-primary">
        
        {/* Top: Branding & Navigation Links */}
        <div className="flex flex-col gap-8 py-6">
          
          {/* Logo / App Name */}
          <div className="px-6 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-accent flex items-center justify-center text-bg-primary font-bold text-xs select-none">
              R
            </div>
            <span className="font-bold tracking-tight text-sm text-text-primary">Reagent Academy</span>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 flex flex-col gap-1">
            <button
              onClick={() => setActiveView('documents')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors focus:outline-none ${
                activeView === 'documents'
                  ? 'bg-brand-accent text-bg-primary'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              <FileText size={14} />
              <span>Documents</span>
            </button>

            <button
              onClick={() => setActiveView('ask')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors focus:outline-none ${
                activeView === 'ask'
                  ? 'bg-brand-accent text-bg-primary'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              <Send size={14} />
              <span>Ask</span>
            </button>

            <button
              onClick={() => setActiveView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors focus:outline-none ${
                activeView === 'settings'
                  ? 'bg-brand-accent text-bg-primary'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              <Settings size={14} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom: Profile & Controls */}
        <div className="border-t border-border-subtle p-4 flex flex-col gap-3">
          
          {/* User profile details */}
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-text-primary truncate">
                {currentUser.displayName || 'User'}
              </span>
              <span className="text-[10px] text-text-muted truncate">
                {currentUser.email}
              </span>
            </div>
            
            {/* Quick theme switcher */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors focus:outline-none"
              title="Toggle dark/light mode"
            >
              {darkMode ? <Sun size={12} /> : <Moon size={12} />}
            </button>
          </div>

          {/* Quick Sign Out Action */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-red-500/5 hover:text-red-500 text-text-secondary text-[11px] font-medium transition-colors focus:outline-none"
          >
            <LogOut size={12} />
            <span>Sign out</span>
          </button>
        </div>

      </div>

      {/* ─── ACTIVE VIEW DISPLAY ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeView === 'documents' && <DocumentsScreen />}
        {activeView === 'ask' && <AskScreen />}
        {activeView === 'settings' && <SettingsScreen />}
      </div>

    </div>
  );
}
