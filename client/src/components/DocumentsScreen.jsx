import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, FileText, Trash2, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

export default function DocumentsScreen() {
  const { getAuthHeaders } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://localhost:5000/api/docs', { headers });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      } else {
        throw new Error('Failed to retrieve document library.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not load documents list.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccessMsg('');
    setUploading(true);

    // 10MB size limit check
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setError('The file exceeds the maximum size limit of 10MB.');
      setUploading(false);
      return;
    }

    // Supported formats check
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.txt') && !name.endsWith('.md')) {
      setError('Supported formats are PDF, TXT, or Markdown (.md).');
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Add temporary document in processing state to the list
    const tempDocId = 'temp-' + Date.now();
    const tempDoc = {
      docId: tempDocId,
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary: 'Summarizing document content...',
      status: 'processing'
    };
    setDocuments(prev => [tempDoc, ...prev]);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://localhost:5000/api/docs/upload', {
        method: 'POST',
        headers: {
          ...headers
        },
        body: formData
      });

      if (res.ok) {
        setSuccessMsg(`"${file.name}" uploaded successfully.`);
        // Reload list to get the real stored documents with correct summaries
        await fetchDocuments();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete upload.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Upload failed.');
      // Remove the temp document on failure
      setDocuments(prev => prev.filter(d => d.docId !== tempDocId));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document? This will remove its search context.')) {
      return;
    }

    setError('');
    setSuccessMsg('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`http://localhost:5000/api/docs/${docId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.docId !== docId));
        setSuccessMsg('Document deleted successfully.');
      } else {
        throw new Error('Failed to delete document.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not delete document.');
    }
  };

  // Format uploaded dates beautifully
  const formatDate = (isoStr) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Unknown date';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      
      {/* Header */}
      <div className="px-8 py-6 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Documents</h2>
          <p className="text-sm text-text-secondary">Upload reference files to build your grounded knowledge base</p>
        </div>
        <button
          onClick={fetchDocuments}
          className="p-2 border border-border-subtle bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded transition-colors focus:outline-none"
          title="Refresh library"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Panel content */}
      <div className="flex-grow overflow-y-auto px-8 py-6 flex flex-col gap-6">
        
        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded p-4 text-sm text-red-500">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="flex items-start gap-3 bg-green-500/5 border border-green-500/10 rounded p-4 text-sm text-green-500">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Upload Card */}
        <div className="border border-dashed border-border-strong bg-bg-secondary rounded p-8 flex flex-col items-center justify-center text-center gap-3">
          <UploadCloud size={32} className="text-text-muted" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Upload reference files</p>
            <p className="text-xs text-text-muted mt-1">PDF, TXT, or Markdown up to 10MB</p>
          </div>
          
          <label className="mt-2 bg-brand-accent hover:bg-brand-accent-hover text-bg-primary text-xs font-semibold py-2 px-4 rounded cursor-pointer transition-colors flex items-center gap-2">
            <span>Choose file</span>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          
          {uploading && (
            <div className="text-xs text-text-secondary animate-pulse mt-1">
              Parsing and chunking document, please wait...
            </div>
          )}
        </div>

        {/* Documents List */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Uploaded materials</h3>
          
          {loading && documents.length === 0 ? (
            <div className="text-sm text-text-muted italic py-4">Loading document library...</div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-text-muted italic py-4">No documents cover this library yet. Use the upload card above to add references.</div>
          ) : (
            <div className="border border-border-subtle rounded divide-y divide-border-subtle">
              {documents.map((doc) => (
                <div key={doc.docId} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4 bg-bg-secondary hover:bg-bg-tertiary transition-colors">
                  <div className="flex items-start gap-3">
                    <FileText size={18} className="text-text-secondary mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                        {doc.filename}
                        {doc.status === 'processing' && (
                          <span className="text-[10px] font-semibold bg-brand-accent/15 text-text-primary px-1.5 py-0.5 rounded animate-pulse">
                            processing
                          </span>
                        )}
                        {!doc.status && (
                          <span className="text-[10px] font-semibold bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">
                            ready
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-secondary line-clamp-2 md:max-w-[480px]">
                        {doc.summary}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 flex-shrink-0 text-xs">
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Calendar size={12} />
                      {formatDate(doc.uploadedAt)}
                    </div>
                    <button
                      onClick={() => handleDelete(doc.docId)}
                      className="p-1.5 text-text-muted hover:text-red-500 rounded hover:bg-red-500/5 transition-colors focus:outline-none"
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
