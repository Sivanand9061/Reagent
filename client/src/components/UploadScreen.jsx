import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, AlertCircle, Library, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UploadScreen({ onUploadSuccess, onStartChallenge }) {
  const { getAuthHeaders } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState(0); // 0 = idle, 1 = uploading, 3 = finished
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentPapers, setRecentPapers] = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState('sandbox');
  const fileInputRef = useRef(null);

  // Fetch library documents from the database on mount
  useEffect(() => {
    fetchRecentPapers();
  }, []);

  const fetchRecentPapers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('http://localhost:5000/api/mentor/documents', { headers });
      if (response.ok) {
        const data = await response.json();
        setRecentPapers(data);
      }
    } catch (err) {
      console.error('Failed to retrieve history:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const getChallengeLabel = (cid) => {
    switch (cid) {
      case 'sum': return 'Module 1: Calculate Sum';
      case 'fizzbuzz': return 'Module 2: FizzBuzz';
      case 'palindrome': return 'Module 3: Palindrome';
      default: return 'Free Code Sandbox';
    }
  };

  const processFile = async (file) => {
    if (file.type !== 'application/pdf') {
      setErrorMessage('Unsupported file type. Please upload a valid PDF document.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setUploadStage(1); // Stage 1: Uploading
    setStatusMessage('Uploading and parsing PDF document...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('challengeId', selectedChallenge);

    try {
      const headers = await getAuthHeaders();
      const uploadRes = await fetch('http://localhost:5000/api/mentor/upload', {
        method: 'POST',
        headers: {
          ...headers
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Failed to upload and parse PDF');
      }

      const uploadData = await uploadRes.json();
      setUploadStage(3); // Ingestion Complete
      
      // Success callback to parent App
      if (onUploadSuccess) {
        onUploadSuccess();
      }

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during file parsing.');
      setLoading(false);
      setUploadStage(0);
    }
  };

  const handleResumePaper = (challengeId) => {
    if (onStartChallenge) {
      onStartChallenge(challengeId);
    }
  };

  const handleDeletePaper = async (e, challengeId) => {
    e.stopPropagation(); // Avoid triggering click resume
    if (!window.confirm('Are you sure you want to permanently remove this document context?')) {
      return;
    }
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`http://localhost:5000/api/mentor/document/${challengeId}`, {
        method: 'DELETE',
        headers
      });
      if (response.ok) {
        setRecentPapers(prev => prev.filter(p => p.challengeId !== challengeId));
      }
    } catch (err) {
      console.error('Failed to delete paper:', err);
    }
  };

  return (
    <div className="upload-screen-container" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Document Ingestion & RAG Library</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Upload text materials or coding specification guides to reference during coding challenges.</p>
      </div>

      <div className="upload-workspace-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        
        {/* Left Side: Upload Card drop-zone */}
        <div 
          className={`upload-card glass-panel drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!loading ? triggerFileInput : undefined}
          style={{ 
            height: '100%', 
            minHeight: '400px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            cursor: !loading ? 'pointer' : 'default',
            padding: '2rem'
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="file-input"
            accept=".pdf"
            disabled={loading}
            style={{ display: 'none' }}
          />

          {loading ? (
            <div className="loading-wrapper" style={{ width: '100%', maxWidth: '350px', textAlign: 'left', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.25rem' }}>
                <div className="cyber-loader" style={{ width: '28px', height: '28px', borderWidth: '2px', borderTopColor: 'var(--accent)', borderRadius: '50%' }}></div>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Processing Document</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: 700 }}>●</span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{statusMessage}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Challenge Selector */}
              <div 
                onClick={(e) => e.stopPropagation()} 
                style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '320px', margin: '0 auto 2rem auto' }}
              >
                <label style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Grounding Workspace Target:
                </label>
                <select 
                  value={selectedChallenge} 
                  onChange={(e) => setSelectedChallenge(e.target.value)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="sandbox">Free Code Sandbox</option>
                  <option value="sum">Module 1: Calculate Sum</option>
                  <option value="fizzbuzz">Module 2: FizzBuzz Challenge</option>
                  <option value="palindrome">Module 3: Palindrome Checker</option>
                </select>
              </div>

              <div className="upload-icon-wrapper" style={{ margin: '0 auto', color: 'var(--accent)' }}>
                <UploadCloud size={52} />
              </div>
              <h2 className="upload-title" style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem auto 0.25rem auto', color: 'var(--text-primary)' }}>Analyze PDF Context</h2>
              <p className="upload-subtitle" style={{ margin: '0 auto 1.5rem auto', color: 'var(--text-secondary)', fontSize: '0.88rem', textAlign: 'center' }}>
                Drag & drop your PDF file here, or click to browse files
              </p>
              <button className="browse-btn" style={{ margin: '0 auto' }}>Select PDF Document</button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <FileText size={14} /> PDF format supported, max size 10MB
              </p>
            </>
          )}

          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-rose)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              maxWidth: '350px',
              margin: '1.5rem auto 0 auto'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Side: My Study Library */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          <h3 style={{ 
            fontSize: '0.82rem', 
            color: 'var(--text-secondary)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Library size={15} style={{ color: 'var(--accent)' }} />
            Active Grounding Documents ({recentPapers.length})
          </h3>
          
          {!loading && recentPapers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.5rem' }}>
              {recentPapers.map((paper) => (
                <div 
                  key={paper.challengeId}
                  onClick={() => handleResumePaper(paper.challengeId)}
                  className="glass-panel" 
                  style={{ 
                    padding: '1rem 1.25rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.92rem',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden', marginRight: '1rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {paper.fileName}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {getChallengeLabel(paper.challengeId)} • Uploaded {paper.uploadedAt ? new Date(paper.uploadedAt).toLocaleDateString() : 'recently'}
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDeletePaper(e, paper.challengeId)} 
                    style={{ 
                      padding: '0.45rem', 
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.15)',
                      color: 'var(--accent-rose)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Delete Document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-1)', height: '100%', minHeight: '320px' }}>
              <Library size={40} style={{ opacity: 0.3, marginBottom: '0.75rem', color: 'var(--accent)' }} />
              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No documents uploaded yet</p>
              <p style={{ fontSize: '0.82rem', maxWidth: '240px' }}>Choose a challenge, upload a PDF on the left, and start learning with your document reference.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
