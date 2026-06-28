import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, Send, Sparkles, Brain, Award, Copy, ThumbsUp, ThumbsDown, 
  RotateCcw, Plus, Mic, ChevronDown, FileText, UploadCloud 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const renderMessageText = (text) => {
  if (!text) return '';
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : '';
      const code = match ? match[2] : part.slice(3, -3);
      return (
        <div key={index} style={{ 
          background: '#0d0d0d', 
          border: '1px solid #2a2a2a', 
          borderRadius: '8px', 
          margin: '0.75rem 0', 
          overflow: 'hidden',
          fontFamily: 'monospace'
        }}>
          {language && (
            <div style={{ 
              background: '#1a1a1a', 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.75rem', 
              color: '#888888', 
              borderBottom: '1px solid #2a2a2a',
              textTransform: 'uppercase',
              fontWeight: 600
            }}>
              {language}
            </div>
          )}
          <pre style={{ margin: 0, padding: '0.75rem 1rem', overflowX: 'auto', fontSize: '0.85rem', color: '#e3e3e3' }}>
            <code>{code.trim()}</code>
          </pre>
        </div>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export default function MentorPanel({ 
  challengeId, 
  currentCode, 
  onAddLogs,
  userStats,
  onRefreshStats,
  chatSessionId,
  documentVersion
}) {
  const { getAuthHeaders } = useAuth();
  const [mentorMode, setMentorMode] = useState('socratic'); // 'socratic' or 'direct'
  const [tone, setTone] = useState('casual'); // 'casual' or 'formal'
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModeAlert, setShowModeAlert] = useState(true);
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const [activeDocument, setActiveDocument] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load chat history and active document context when changing challenges or starting a new session
  useEffect(() => {
    let active = true;
    const loadChatHistory = async () => {
      setMessages([]);
      setActiveDocument(null);
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        
        // 1. Fetch active document context first
        const docRes = await fetch(`http://localhost:5000/api/mentor/document/${challengeId}`, { headers });
        if (docRes.ok && active) {
          const docData = await docRes.json();
          setActiveDocument(docData.document);
        }

        // 2. Fetch chat history
        const res = await fetch(`http://localhost:5000/api/mentor/chat/${challengeId}`, { headers });
        if (res.ok && active) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            const formatted = data.history.map(msg => {
              let date;
              if (msg.timestamp) {
                date = msg.timestamp._seconds 
                  ? new Date(msg.timestamp._seconds * 1000) 
                  : new Date(msg.timestamp);
              } else {
                date = new Date();
              }
              return {
                id: msg.id || Math.random(),
                sender: msg.sender,
                text: msg.text,
                timestamp: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
            });
            setMessages(formatted);
          } else {
            // Chat history is empty! Generate a Socratic welcome greeting from the AI.
            // Temporarily show a loading state in the message thread
            setMessages([{
              id: 'loading_welcome',
              sender: 'assistant',
              text: 'Socratic Mentor is joining the workspace...',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);

            const welcomeRes = await fetch('http://localhost:5000/api/mentor/explain', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({
                challengeId,
                message: '[SYSTEM_WELCOME_GREETING]',
                mentorMode: mentorMode,
                tone: mentorMode === 'direct' ? 'formal' : 'casual',
                history: [],
                currentTime: new Date().toString(),
                code: ''
              })
            });

            if (welcomeRes.ok && active) {
              const welcomeData = await welcomeRes.json();
              const welcomeText = welcomeData.explanation;

              const welcomeMsg = {
                id: Date.now(),
                sender: 'assistant',
                text: welcomeText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              setMessages([welcomeMsg]);

              // Save in Firestore chat history
              await fetch('http://localhost:5000/api/mentor/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({
                  challengeId,
                  chatSessionId,
                  sender: 'assistant',
                  text: welcomeText
                })
              });
            } else {
              setMessages([]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load session context:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadChatHistory();
    return () => {
      active = false;
    };
  }, [challengeId, chatSessionId, documentVersion]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(true);
    onAddLogs([`System: Uploading document "${file.name}"...`]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('challengeId', challengeId || 'sandbox');

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://localhost:5000/api/mentor/upload', {
        method: 'POST',
        headers: {
          ...headers
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setActiveDocument({ fileName: data.fileName });
        onAddLogs([`System: Document "${data.fileName}" uploaded and parsed successfully.`]);

        // Append system alert to chat
        const sysMsg = {
          id: Date.now(),
          sender: 'assistant',
          text: `📄 **Document Uploaded**: "${data.fileName}" has been uploaded and analyzed. I am now grounded in its content. Ask me any questions, and I will teach you and explain each topic! 🧠✨`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, sysMsg]);

        // Save system alert in chat history
        await fetch('http://localhost:5000/api/mentor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            challengeId,
            chatSessionId,
            sender: 'assistant',
            text: sysMsg.text
          })
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to upload document: ${err.message}`);
      onAddLogs([`Upload Error: ${err.message}`]);
    } finally {
      setUploadingDoc(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDeleteDocument = async () => {
    if (window.confirm(`Are you sure you want to remove the document "${activeDocument.fileName}"? The AI will stop referencing it.`)) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`http://localhost:5000/api/mentor/document/${challengeId}`, {
          method: 'DELETE',
          headers
        });
        if (res.ok) {
          setActiveDocument(null);
          onAddLogs(['System: Removed document context.']);

          // Append system alert to chat
          const sysMsg = {
            id: Date.now(),
            sender: 'assistant',
            text: `📄 **Document Context Removed**: The uploaded document has been removed. I will now guide you based on general programming standards.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, sysMsg]);

          // Save system alert in chat history
          await fetch('http://localhost:5000/api/mentor/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              challengeId,
              chatSessionId,
              sender: 'assistant',
              text: sysMsg.text
            })
          });
        }
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
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
    await fetchMentorship(userText, [...messages, userMsg]);
  };

  const fetchMentorship = async (questionText, currentHistory) => {
    setLoading(true);
    
    // Stop any active speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }

    try {
      const headers = await getAuthHeaders();

      // Save user message to database in background
      fetch('http://localhost:5000/api/mentor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          challengeId,
          chatSessionId,
          sender: 'user',
          text: questionText
        })
      }).catch(err => console.error('Failed to save user chat to DB:', err));

      const response = await fetch('http://localhost:5000/api/mentor/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ 
          code: currentCode || '',
          message: questionText, 
          mentorMode, 
          tone,
          challengeId,
          history: currentHistory.slice(-6).map(m => ({ sender: m.sender, text: m.text })),
          currentTime: new Date().toString(),
          lastActiveTime: userStats?.lastActiveTimestamp ? (userStats.lastActiveTimestamp._seconds ? new Date(userStats.lastActiveTimestamp._seconds * 1000).toString() : new Date(userStats.lastActiveTimestamp).toString()) : ''
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mentor feedback');
      }

      const data = await response.json();
      
      const assistantMsg = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: data.explanation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Save assistant response to database in background
      fetch('http://localhost:5000/api/mentor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          challengeId,
          chatSessionId,
          sender: 'assistant',
          text: data.explanation
        })
      }).catch(err => console.error('Failed to save assistant chat to DB:', err));

      if (data.logs) {
        onAddLogs(data.logs);
      }

    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: Date.now() + 2,
        sender: 'assistant',
        text: 'Failed to connect with your Coding Mentor. Please check your API keys or server connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
      onAddLogs([`Mentor Agent Error: ${err.message}`]);
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
    // Clean code formatting blocks for speech
    const cleanText = text.replace(/```[\s\S]*?```/g, '[code block omitted for voice feedback]');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    if (onAddLogs) onAddLogs(['System: Copied response to clipboard.']);
  };

  const actionBtnStyle = {
    background: 'transparent',
    border: 'none',
    padding: '6px',
    borderRadius: '4px',
    color: '#888888',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    marginRight: '0.25rem'
  };

  const handleHoverIn = (e) => {
    e.currentTarget.style.color = '#ffffff';
    e.currentTarget.style.background = '#2a2a2a';
  };

  const handleHoverOut = (e) => {
    e.currentTarget.style.color = '#888888';
    e.currentTarget.style.background = 'transparent';
  };

  const SunburstLoader = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
      <svg 
        className="loading-sunburst" 
        width="28" 
        height="28" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#f28d61" 
        strokeWidth="2" 
        strokeLinecap="round"
        style={{
          animation: 'spin 2s linear infinite'
        }}
      >
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <span style={{ fontSize: '0.78rem', color: '#888888', letterSpacing: '0.05em' }}>Claude is thinking...</span>
    </div>
  );

  return (
    <div className="mentor-dark-chat" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: '#181818', 
      color: '#e3e3e3',
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid #222222',
        background: '#181818',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#ffffff' }}>
            {challengeId === 'sandbox' ? 'Free Code Sandbox' : `Mentorship: ${challengeId.replace(/_/g, ' ').toUpperCase()}`}
          </span>
          <ChevronDown size={14} color="#888888" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => onAddLogs([`System: View code details.`])}
            style={{ background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Session Details"
          >
            <FileText size={16} />
          </button>
        </div>
      </div>

      {/* Messages list area */}
      <div style={{ 
        flexGrow: 1, 
        overflowY: 'auto', 
        padding: '2rem 1.5rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '2.5rem' 
      }}>
        <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
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
                {isUser ? (
                  /* User message bubble */
                  <div style={{ 
                    background: '#252525', 
                    color: '#ffffff', 
                    padding: '0.75rem 1.25rem', 
                    borderRadius: '1.25rem',
                    maxWidth: '80%',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid #333333'
                  }}>
                    {msg.text}
                  </div>
                ) : (
                  /* Assistant message plain (Serif text like screenshot) */
                  <div style={{ width: '100%' }}>
                    <div style={{
                      color: '#e3e3e3',
                      fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
                      fontSize: '1.05rem',
                      lineHeight: '1.75',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {renderMessageText(msg.text)}
                    </div>
                    
                    {/* Assistant Action Bar */}
                    {!msg.isError && (
                      <div style={{ display: 'flex', marginTop: '0.75rem', gap: '0.25rem', marginLeft: '-6px' }}>
                        <button 
                          onClick={() => handleCopy(msg.text)} 
                          style={actionBtnStyle} 
                          title="Copy text"
                          onMouseEnter={handleHoverIn}
                          onMouseLeave={handleHoverOut}
                        >
                          <Copy size={13} />
                        </button>
                        <button 
                          onClick={() => handleTTS(msg.id, msg.text)} 
                          style={actionBtnStyle} 
                          title={speakingMsgId === msg.id ? "Stop voice" : "Listen aloud"}
                          onMouseEnter={handleHoverIn}
                          onMouseLeave={handleHoverOut}
                        >
                          <Volume2 size={13} style={{ color: speakingMsgId === msg.id ? '#f28d61' : 'inherit' }} />
                        </button>
                        <button 
                          onClick={() => onAddLogs(['System: Upvoted mentor guidance.'])} 
                          style={actionBtnStyle} 
                          title="Good guidance"
                          onMouseEnter={handleHoverIn}
                          onMouseLeave={handleHoverOut}
                        >
                          <ThumbsUp size={13} />
                        </button>
                        <button 
                          onClick={() => onAddLogs(['System: Downvoted mentor guidance.'])} 
                          style={actionBtnStyle} 
                          title="Bad guidance"
                          onMouseEnter={handleHoverIn}
                          onMouseLeave={handleHoverOut}
                        >
                          <ThumbsDown size={13} />
                        </button>
                        <button 
                          onClick={() => {
                            const userMessages = messages.filter(m => m.sender === 'user');
                            if (userMessages.length > 0) {
                              const lastUserText = userMessages[userMessages.length - 1].text;
                              fetchMentorship(lastUserText, messages.slice(0, -1));
                            } else {
                              onAddLogs(['System: No prior questions to regenerate.']);
                            }
                          }} 
                          style={actionBtnStyle} 
                          title="Regenerate"
                          onMouseEnter={handleHoverIn}
                          onMouseLeave={handleHoverOut}
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Bottom Input Area */}
      <div style={{
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto 1.5rem auto',
        padding: '0 1rem',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {/* Warning/Guidance Banner */}
        {showModeAlert && (
          <div style={{
            background: '#1f1f1f',
            border: '1px solid #2d2d2d',
            borderRadius: '0.75rem',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: '#b0b0b0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: mentorMode === 'socratic' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                color: mentorMode === 'socratic' ? 'var(--accent-blue)' : 'var(--accent-purple)',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.7rem'
              }}>
                {mentorMode === 'socratic' ? 'Socratic Mode' : 'Direct Instructor'}
              </span>
              <span>AI will {mentorMode === 'socratic' ? 'give hints & guide you' : 'fix code directly'}.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                onClick={() => setMentorMode(prev => prev === 'socratic' ? 'direct' : 'socratic')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textDecoration: 'underline'
                }}
              >
                Change Mode
              </button>
              <button 
                onClick={() => setShowModeAlert(false)}
                style={{ background: 'transparent', border: 'none', color: '#666666', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Active Document Badge */}
        {activeDocument && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '0.75rem',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: '#10b981'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700 }}>📄 Active Document:</span>
              <span>{activeDocument.fileName}</span>
            </div>
            <button 
              type="button"
              onClick={handleDeleteDocument}
              style={{ background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              title="Remove document context"
              onMouseEnter={(e) => e.currentTarget.style.color = '#ff8787'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
            >
              ✕
            </button>
          </div>
        )}

        {/* Input box form */}
        <form onSubmit={handleSend} style={{
          background: '#222222',
          border: '1px solid #333333',
          borderRadius: '1.25rem',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          position: 'relative'
        }}>
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".pdf,.txt" 
            style={{ display: 'none' }} 
          />

          {/* Main textarea */}
          <textarea
            rows={1}
            placeholder={uploadingDoc ? "Parsing document..." : (loading ? "Mentor is writing..." : "Write a message...")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading || uploadingDoc}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              resize: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.92rem',
              lineHeight: '1.5',
              maxHeight: '150px',
              overflowY: 'auto',
              fontFamily: 'inherit',
              padding: 0
            }}
          />

          {/* Bottom Toolbar Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.25rem',
            borderTop: '1px solid #2d2d2d',
            paddingTop: '0.5rem'
          }}>
            {/* Left Button: Upload PDF/Document */}
            <button
              type="button"
              onClick={handleFileUploadClick}
              disabled={uploadingDoc || loading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: (uploadingDoc || loading) ? '#555555' : '#e0e0e0',
                cursor: (uploadingDoc || loading) ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
              title="Upload PDF or Text Document"
              onMouseEnter={(e) => { 
                if (!uploadingDoc && !loading) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                }
              }}
              onMouseLeave={(e) => { 
                if (!uploadingDoc && !loading) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }
              }}
            >
              {uploadingDoc ? (
                <>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '1.5px solid #555',
                    borderTopColor: 'var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} style={{ color: 'var(--accent)' }} />
                  <span>Upload Learning PDF</span>
                </>
              )}
            </button>

            {/* Right Buttons: Mic, Send */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', position: 'relative' }}>

              {/* Mic Icon */}
              <button
                type="button"
                onClick={() => {
                  onAddLogs(['System: Microphone voice input triggered.']);
                  alert('Voice dictation is starting... Speak your question now.');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888888',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                title="Voice Dictation"
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
              >
                <Mic size={15} />
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                style={{
                  background: (!inputValue.trim() || loading) ? '#2d2d2d' : '#ffffff',
                  color: (!inputValue.trim() || loading) ? '#555555' : '#000000',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (!inputValue.trim() || loading) ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  padding: 0
                }}
                title="Send Message"
              >
                <Send size={12} />
              </button>

            </div>
          </div>
        </form>
      </div>

    </div>
  );
}
