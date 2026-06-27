import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Volume2, Sparkles, Send, HelpCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ExplainerPanel({ 
  selectedSnippet, 
  concepts, 
  exploredConcepts, 
  activeSectionContent,
  onExploreConcept, 
  onAddLogs,
  userKeys 
}) {
  const { getAuthHeaders } = useAuth();
  const [difficulty, setDifficulty] = useState('simple'); // 'simple' or 'advanced'
  const [tone, setTone] = useState('casual'); // 'casual' or 'formal'
  
  // Chat messages history
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: "👋 Welcome! I'm your AI Study Tutor. Highlight any text in the paper on the left, click a core concept badge above, or ask any question below (even simple ones!) to start our discussion! 🧠✨",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle new highlighted snippet
  useEffect(() => {
    if (selectedSnippet) {
      // Check if last message was already about this snippet to prevent loops
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.text.includes(selectedSnippet)) return;

      handleSnippetHighlight(selectedSnippet);
    }
  }, [selectedSnippet]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSnippetHighlight = async (snippet) => {
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: `Please explain this passage from the paper:\n"${snippet}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSnippet: true
    };
    
    setMessages(prev => [...prev, userMsg]);
    await fetchExplanation(snippet, [...messages, userMsg]);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userText = inputValue;
    setInputValue('');

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    await fetchExplanation(userText, [...messages, userMsg]);
  };

  const fetchExplanation = async (questionText, currentHistory) => {
    setLoading(true);
    
    // Stop any active speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }

    try {
      const response = await fetch('http://localhost:5000/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ 
          text: questionText, 
          difficulty, 
          tone,
          context: activeSectionContent || '',
          history: currentHistory.slice(-6).map(m => ({ sender: m.sender, text: m.text })) // Send last 6 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate explanation');
      }

      const data = await response.json();
      
      const assistantMsg = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: data.explanation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      if (data.logs) {
        onAddLogs(data.logs);
      }

      // Mark explored concepts in parent
      const matchedConcept = concepts.find(c => 
        questionText.toLowerCase().includes(c.toLowerCase()) || 
        c.toLowerCase().includes(questionText.toLowerCase())
      );
      
      if (matchedConcept) {
        onExploreConcept(matchedConcept, data.explanation);
      } else {
        const conceptName = questionText.length > 25 ? questionText.substring(0, 25) + '...' : questionText;
        onExploreConcept(conceptName, data.explanation);
      }

    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: Date.now() + 2,
        sender: 'assistant',
        text: 'Failed to generate explanation. Please verify your connection or API keys.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
      onAddLogs([`Explainer Agent Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  // Text-To-Speech Playback
  const handleTTS = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleDifficultyChange = (e) => {
    const value = e.target.value === '0' ? 'simple' : 'advanced';
    setDifficulty(value);
  };

  return (
    <div className="explainer-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* Session Progress Tracker */}
      <div className="progress-card">
        <div className="progress-header">
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Session Progress</span>
          <span>{exploredConcepts.length} / {Math.max(concepts.length, 8)} concepts explored</span>
        </div>
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${Math.min((exploredConcepts.length / Math.max(concepts.length, 8)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Interactive Key Concepts Selector */}
      {concepts.length > 0 && (
        <div className="glass-panel" style={{ padding: '0.85rem', background: '#ffffff' }}>
          <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', letterSpacing: '0.04em' }}>
            <Sparkles size={13} style={{ color: 'var(--accent-purple)' }} />
            Core concepts to explore
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '72px', overflowY: 'auto' }}>
            {concepts.map((concept, idx) => {
              const isExplored = exploredConcepts.some(c => c.name === concept);
              return (
                <button
                  key={idx}
                  onClick={() => handleSnippetHighlight(concept)}
                  disabled={loading}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    border: '1px solid',
                    borderColor: isExplored ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-primary)',
                    background: isExplored ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-app)',
                    color: isExplored ? '#10b981' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    cursor: 'pointer'
                  }}
                >
                  {isExplored ? '✓' : '•'} {concept}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Control panel: Difficulty and Tone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem', background: 'var(--bg-surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
        {/* Difficulty */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', justifyContent: 'center' }}>
          <div className="difficulty-label" style={{ fontSize: '0.78rem' }}>
            <span style={{ fontWeight: 600 }}>Explain Level:</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
              {difficulty === 'simple' ? 'ELI12' : 'PhD'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="1"
            value={difficulty === 'simple' ? 0 : 1}
            onChange={handleDifficultyChange}
            className="difficulty-slider"
            style={{ marginTop: '0.2rem' }}
          />
        </div>

        {/* Tone Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', justifyContent: 'center', borderLeft: '1px solid var(--border-primary)', paddingLeft: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tutor Persona:</span>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: 'var(--radius-sm)', padding: '2px', gap: '2px', marginTop: '0.1rem' }}>
            <button
              onClick={() => setTone('casual')}
              style={{
                flex: 1,
                padding: '0.25rem 0.4rem',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                background: tone === 'casual' ? '#ffffff' : 'transparent',
                color: tone === 'casual' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                boxShadow: tone === 'casual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px'
              }}
            >
              🎭 Casual
            </button>
            <button
              onClick={() => setTone('formal')}
              style={{
                flex: 1,
                padding: '0.25rem 0.4rem',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                background: tone === 'formal' ? '#ffffff' : 'transparent',
                color: tone === 'formal' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                boxShadow: tone === 'formal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px'
              }}
            >
              🎓 Formal
            </button>
          </div>
        </div>
      </div>

      {/* Chat Room Area */}
      <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff', minHeight: '260px' }}>
        
        {/* Messages list */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '85%', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                  {/* Icon */}
                  {!isUser && (
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: tone === 'casual' ? 'var(--accent-purple)' : 'var(--text-primary)', 
                      color: 'white', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {tone === 'casual' ? '🎭' : '🎓'}
                    </div>
                  )}

                  <div 
                    style={{ 
                      padding: '0.75rem 1rem', 
                      borderRadius: 'var(--radius-md)', 
                      background: isUser ? 'var(--bg-surface-hover)' : 'var(--bg-app)', 
                      color: 'var(--text-primary)',
                      border: isUser ? 'none' : '1px solid var(--border-primary)',
                      fontSize: '0.92rem',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      position: 'relative'
                    }}
                  >
                    {msg.text}
                    
                    {/* TTS Trigger inside assistant bubble */}
                    {!isUser && !msg.isError && (
                      <button 
                        onClick={() => handleTTS(msg.id, msg.text)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginLeft: '0.5rem',
                          padding: '2px',
                          borderRadius: '4px',
                          color: speakingMsgId === msg.id ? 'var(--accent-purple)' : 'var(--text-muted)',
                          verticalAlign: 'middle',
                          cursor: 'pointer'
                        }}
                        title={speakingMsgId === msg.id ? "Stop voice" : "Listen aloud"}
                      >
                        <Volume2 size={13} className={speakingMsgId === msg.id ? 'speaking' : ''} />
                      </button>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', padding: '0 0.5rem' }}>
                  {msg.timestamp}
                </span>
              </div>
            );
          })}
          
          {loading && (
            <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '85%' }}>
              <div style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                background: 'var(--text-primary)', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                flexShrink: 0
              }}>
                🤖
              </div>
              <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-app)', border: '1px solid var(--border-primary)' }}>
                <div className="cyber-loader" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tutor is typing...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSend} style={{ display: 'flex', padding: '0.75rem', borderTop: '1px solid var(--border-primary)', gap: '0.5rem', background: 'var(--bg-app)' }}>
          <input
            type="text"
            placeholder={loading ? "Tutor is drafting response..." : "Ask any follow-up question about this paper..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            className="settings-input"
            style={{ flexGrow: 1, padding: '0.5rem 1rem', fontSize: '0.9rem', background: '#ffffff' }}
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim() || loading} 
            className="browse-btn" 
            style={{ 
              margin: 0, 
              padding: '0.5rem 1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'var(--accent-blue)', 
              borderColor: 'var(--accent-blue)',
              opacity: (!inputValue.trim() || loading) ? 0.6 : 1
            }}
          >
            <Send size={15} />
          </button>
        </form>

      </div>
    </div>
  );
}
