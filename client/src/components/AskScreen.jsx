import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, FileText, AlertTriangle, HelpCircle, ArrowRight, Eye, ShieldAlert } from 'lucide-react';

export default function AskScreen() {
  const { getAuthHeaders } = useAuth();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Q&A result state
  const [result, setResult] = useState(null);
  // Selected citation for viewing full chunk in right panel
  const [selectedCitation, setSelectedCitation] = useState(null);
  
  const rightPanelRef = useRef(null);
  const chatEndRef = useRef(null);

  // Load stalenessDays threshold from settings to send with request
  const getStalenessThreshold = () => {
    return parseInt(localStorage.getItem('stalenessDays')) || 90;
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setSelectedCitation(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://localhost:5000/api/qa/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          question: question.trim(),
          stalenessThresholdDays: getStalenessThreshold()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        // Auto-select first citation if available
        if (data.citations && data.citations.length > 0) {
          setSelectedCitation(data.citations[0]);
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get answer from AI.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during Q&A generation.');
    } finally {
      setLoading(false);
    }
  };

  // Scroll to citations or panels if selected
  const handleCitationClick = (citation) => {
    setSelectedCitation(citation);
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Render citation markers inline in the answer string
  const renderFormattedAnswer = (answerText, citations = []) => {
    if (!answerText) return null;
    
    // Replace citation markers like [1], [2] with clickable HTML elements
    const parts = answerText.split(/(\[\d+\])/g);
    
    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1]);
        const citation = citations[num - 1];
        if (citation) {
          return (
            <button
              key={index}
              onClick={() => handleCitationClick(citation)}
              className="inline-flex items-center justify-center px-1 py-0.5 mx-0.5 bg-brand-accent/10 border border-brand-accent/20 hover:bg-brand-accent hover:text-bg-primary text-text-primary text-[10px] font-bold rounded transition-colors focus:outline-none"
              title={`Source: ${citation.filename} - ${citation.heading}`}
            >
              {num}
            </button>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-bg-primary">
      
      {/* Left Pane: Q&A Chat */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border-subtle overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border-subtle flex-shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Ask</h2>
          <p className="text-sm text-text-secondary">Query your knowledge base with plain-English questions</p>
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-grow overflow-y-auto px-8 py-6 flex flex-col gap-6">
          
          {error && (
            <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded p-4 text-sm text-red-500 flex-shrink-0">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Ask Prompt Form */}
          <form onSubmit={handleAsk} className="flex gap-2 flex-shrink-0">
            <input
              type="text"
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-bg-secondary border border-border-subtle rounded text-sm focus:outline-none focus:border-border-strong text-text-primary placeholder:text-text-muted transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="bg-brand-accent hover:bg-brand-accent-hover text-bg-primary p-2.5 rounded transition-colors flex items-center justify-center disabled:opacity-50 focus:outline-none"
            >
              <Send size={16} />
            </button>
          </form>

          {/* Loader */}
          {loading && (
            <div className="flex flex-col gap-3 py-6">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                <span>Reading reference sources and formulating answer...</span>
              </div>
              <div className="h-2 w-3/4 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-2 w-1/2 bg-bg-tertiary rounded animate-pulse" />
            </div>
          )}

          {/* Q&A Result */}
          {result && (
            <div className="flex flex-col gap-6">
              
              {/* Conflict Callout (surface at the top above the answer) */}
              {result.conflict && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
                    <AlertTriangle size={14} />
                    Document Conflict Detected
                  </div>
                  <p className="text-sm text-text-primary font-medium">
                    {result.conflict}
                  </p>
                </div>
              )}

              {/* Main Answer Panel */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Answer</h4>
                
                {result.answer === 'No documents cover this question.' ? (
                  <div className="bg-bg-secondary border border-border-subtle rounded p-4 flex items-start gap-3">
                    <HelpCircle size={18} className="text-text-muted mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-text-secondary italic">
                      No documents cover this question. Please upload more reference documents with the relevant information.
                    </span>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                    {renderFormattedAnswer(result.answer, result.citations)}
                  </div>
                )}
              </div>

              {/* Citations List (receipts) */}
              {result.citations && result.citations.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-border-subtle pt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Sources cited</h4>
                    {result.staleWarning && (
                      <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                        <ShieldAlert size={12} />
                        outdated sources flagged
                      </span>
                    )}
                  </div>
                  
                  {/* Staleness Banner callout if warnings exist */}
                  {result.staleWarning && (
                    <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded p-3 text-xs text-amber-600">
                      <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{result.staleWarning}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {result.citations.map((cit, idx) => {
                      const isSelected = selectedCitation?.docId === cit.docId && selectedCitation?.chunkId === cit.chunkId;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleCitationClick(cit)}
                          className={`w-full text-left p-3 border rounded text-xs transition-colors flex items-center justify-between gap-3 focus:outline-none ${
                            isSelected 
                              ? 'border-brand-accent bg-brand-accent/5 text-text-primary' 
                              : 'border-border-subtle bg-bg-secondary hover:bg-bg-tertiary text-text-secondary'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 h-5 rounded-full bg-border-strong flex items-center justify-center text-[10px] font-bold text-text-primary flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold truncate">{cit.filename}</span>
                            <span className="text-text-muted truncate">&middot; {cit.heading}</span>
                          </div>
                          <Eye size={12} className="flex-shrink-0 text-text-muted" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          <div ref={chatEndRef} />
        </div>

      </div>

      {/* Right Pane: Document Chunk Viewer */}
      <div 
        ref={rightPanelRef}
        className="w-full md:w-[380px] lg:w-[440px] flex flex-col bg-bg-secondary overflow-hidden flex-shrink-0"
      >
        <div className="px-6 py-6 border-b border-border-subtle flex-shrink-0">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Source viewer</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Explore the raw cited chunk below</p>
        </div>

        <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
          {selectedCitation ? (
            <div className="flex flex-col gap-4">
              
              {/* Doc details */}
              <div className="flex items-start gap-2.5 p-3 bg-bg-primary border border-border-subtle rounded text-xs">
                <FileText size={16} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div className="flex flex-col gap-0.5 truncate">
                  <div className="font-semibold text-text-primary truncate">
                    {selectedCitation.filename}
                  </div>
                  <div className="text-[10px] text-text-secondary truncate">
                    Section: {selectedCitation.heading}
                  </div>
                </div>
              </div>

              {/* Cited Statement */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Cited claim</div>
                <blockquote className="border-l-2 border-brand-accent pl-3 text-xs italic text-text-secondary py-1 bg-bg-primary/40">
                  "{selectedCitation.claim}"
                </blockquote>
              </div>

              {/* Full Chunk Text with highlight */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Grounded context block</div>
                <div className="bg-bg-primary border border-border-subtle rounded p-4 text-xs leading-relaxed text-text-secondary whitespace-pre-wrap font-mono">
                  {selectedCitation.chunkText}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 gap-2 text-text-muted">
              <FileText size={24} />
              <p className="text-xs">Select a citation index or source to load context</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
