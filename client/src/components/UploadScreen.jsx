import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, AlertCircle, Library, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UploadScreen({ onUploadSuccess }) {
  const { getAuthHeaders } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState(0); // 0 = idle, 1 = uploading, 2 = parsing, 3 = lexicon
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentPapers, setRecentPapers] = useState([]);
  const fileInputRef = useRef(null);

  // Fetch library documents from the database on mount
  useEffect(() => {
    fetchRecentPapers();
  }, []);

  const fetchRecentPapers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('http://localhost:5000/api/papers', { headers });
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

  const processFile = async (file) => {
    if (file.type !== 'application/pdf') {
      setErrorMessage('Unsupported file type. Please upload a valid PDF research paper.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setUploadStage(1); // Stage 1: Uploading
    setStatusMessage('Uploading PDF paper to server...');

    const formData = new FormData();
    formData.append('file', file);

    const accumulatedLogs = [];

    try {
      // 1. PDF Upload & Parse
      const uploadRes = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Failed to upload and parse PDF');
      }

      const uploadData = await uploadRes.json();
      if (uploadData.logs) accumulatedLogs.push(...uploadData.logs);

      setUploadStage(2); // Stage 2: Extracting sections
      setStatusMessage('Extractor Agent: Structuring sections, glossary, and concepts...');

      // 2. Section Extraction
      const extractRes = await fetch('http://localhost:5000/api/extract-sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ 
          text: uploadData.text,
          fileName: file.name,
          numPages: uploadData.numPages
        }),
      });

      if (!extractRes.ok) {
        const errorData = await extractRes.json();
        throw new Error(errorData.error || 'Failed to extract sections');
      }

      const extractData = await extractRes.json();
      if (extractData.logs) accumulatedLogs.push(...extractData.logs);

      setUploadStage(3); // Stage 3: Indexing Lexicon/Finalizing

      // Success callback to parent App
      onUploadSuccess({
        paperId: extractData.paperId,
        fileName: file.name,
        rawText: uploadData.text,
        numPages: uploadData.numPages,
        sections: extractData.sections,
        concepts: extractData.concepts,
        glossary: extractData.glossary,
        logs: accumulatedLogs
      });

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during file parsing.');
      setLoading(false);
      setUploadStage(0);
    }
  };

  const handleResumePaper = async (paperId) => {
    setLoading(true);
    setUploadStage(2); // Directly show structuring/loading
    setStatusMessage('Loading paper and history from database...');
    try {
      const response = await fetch(`http://localhost:5000/api/papers/${paperId}`, {
        headers: await getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to load paper details.');
      }
      
      const data = await response.json();
      
      // Success callback
      onUploadSuccess({
        paperId: data.id,
        fileName: data.fileName,
        rawText: data.rawText,
        numPages: data.numPages,
        sections: data.sections,
        concepts: data.concepts,
        glossary: data.glossary,
        exploredConcepts: data.exploredConcepts || [],
        logs: [
          `Server: Loaded paper "${data.fileName}" from database history.`,
          `Server: Restored ${data.exploredConcepts?.length || 0} previously explored concepts.`
        ]
      });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resume paper.');
      setLoading(false);
      setUploadStage(0);
    }
  };

  const handleDeletePaper = async (e, paperId) => {
    e.stopPropagation(); // Avoid triggering click upload browse
    if (!window.confirm('Are you sure you want to permanently delete this paper and all session history?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:5000/api/papers/${paperId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      if (response.ok) {
        setRecentPapers(prev => prev.filter(p => p.id !== paperId));
      }
    } catch (err) {
      console.error('Failed to delete paper:', err);
    }
  };

  return (
    <div className="upload-screen-container" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      <div className="upload-workspace-layout">
        {/* Left Side: Upload Card drop-zone */}
        <div 
          className={`upload-card glass-panel drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!loading ? triggerFileInput : undefined}
          style={{ height: '100%', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: !loading ? 'pointer' : 'default' }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="file-input"
            accept=".pdf"
            disabled={loading}
          />

          {loading ? (
            <div className="loading-wrapper" style={{ width: '100%', maxWidth: '350px', textAlign: 'left', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.25rem' }}>
                <div className="cyber-loader" style={{ width: '28px', height: '28px' }}></div>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Ingesting Research Paper</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', opacity: uploadStage >= 1 ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <span style={{ fontSize: '1rem', color: uploadStage > 1 ? 'var(--accent-emerald)' : 'var(--accent-blue)', fontWeight: 700 }}>
                    {uploadStage > 1 ? '✓' : '●'}
                  </span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>Uploading PDF document...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', opacity: uploadStage >= 2 ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <span style={{ fontSize: '1rem', color: uploadStage > 2 ? 'var(--accent-emerald)' : uploadStage === 2 ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {uploadStage > 2 ? '✓' : uploadStage === 2 ? '●' : '○'}
                  </span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>Extracting document sections...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', opacity: uploadStage >= 3 ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <span style={{ fontSize: '1rem', color: uploadStage >= 3 ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {uploadStage >= 3 ? '●' : '○'}
                  </span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>AI Agent: Indexing glossary terms...</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="upload-icon-wrapper" style={{ margin: '0 auto' }}>
                <UploadCloud size={60} />
              </div>
              <h2 className="upload-title">Analyze Research Paper</h2>
              <p className="upload-subtitle" style={{ margin: '0 auto 1.5rem auto' }}>
                Drag & drop your PDF file here, or click to browse files
              </p>
              <button className="browse-btn" style={{ margin: '0 auto' }}>Select PDF Document</button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', gap: '0.25rem' }}>
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
              marginTop: '1rem',
              fontSize: '0.9rem',
              maxWidth: '350px',
              margin: '1rem auto 0 auto'
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
            <Library size={15} style={{ color: 'var(--accent-purple)' }} />
            My Study Library ({recentPapers.length})
          </h3>
          
          {!loading && recentPapers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '380px', paddingRight: '0.5rem' }}>
              {recentPapers.map((paper) => (
                <div 
                  key={paper.id}
                  onClick={() => handleResumePaper(paper.id)}
                  className="glass-panel" 
                  style={{ 
                    padding: '1rem 1.25rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: '#ffffff',
                    border: '1px solid var(--border-primary)',
                    fontSize: '0.92rem',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-primary)'}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden', marginRight: '1rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {paper.fileName}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Uploaded {new Date(paper.createdAt).toLocaleDateString()} • {paper.numPages} pages
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDeletePaper(e, paper.id)} 
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff', height: '100%', minHeight: '320px' }}>
              <Library size={40} style={{ opacity: 0.3, marginBottom: '0.75rem', color: 'var(--accent-purple)' }} />
              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No papers uploaded yet</p>
              <p style={{ fontSize: '0.82rem', maxWidth: '240px' }}>Upload a research PDF on the left to start analyzing it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
