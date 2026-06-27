import React, { useEffect, useState } from 'react';
import { Globe, ThumbsUp, Eye, BookOpen, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PublicLibrary({ onOpenPublicPaper }) {
  const { getAuthHeaders } = useAuth();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPublicPapers();
  }, []);

  const loadPublicPapers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/public/papers');
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
      }
    } catch (err) {
      console.error('Failed to load public library:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (paperId) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`http://localhost:5000/api/public/papers/${paperId}/upvote`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const { upvoted } = await res.json();
        setPapers(prev => prev.map(p =>
          p.id === paperId
            ? { ...p, upvotes: p.upvotes + (upvoted ? 1 : -1) }
            : p
        ));
      }
    } catch (err) {
      console.error('Failed to upvote:', err);
    }
  };

  const filtered = papers.filter(p =>
    p.fileName?.toLowerCase().includes(search.toLowerCase()) ||
    p.concepts?.some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', flexGrow: 1, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={24} style={{ color: 'var(--accent-blue)' }} />
            Explore Course Catalog
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.92rem' }}>
            Browse and import peer-reviewed public documents shared by the research community.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search catalog or concepts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glossary-search"
            style={{ paddingLeft: '2.75rem', width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="cyber-loader" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', background: '#ffffff', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
          <Globe size={48} style={{ opacity: 0.3, color: 'var(--accent-blue)' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No results found</h3>
          <p style={{ maxWidth: '350px', fontSize: '0.9rem' }}>{search ? 'No catalog entries match your query.' : 'The public catalog is empty right now.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.5rem' }}>
          {filtered.map(paper => {
            const starRating = Math.min(4.0 + (paper.upvotes || 0) * 0.1, 5.0).toFixed(1);
            const reviewCount = (paper.upvotes || 0) + 12;
            const enrollments = (paper.views || 0) * 3 + 15;
            const difficulty = paper.numPages > 15 ? 'Advanced' : paper.numPages > 7 ? 'Intermediate' : 'Beginner';

            return (
              <div
                key={paper.id}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  background: '#ffffff',
                  boxShadow: 'var(--shadow-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)'
                }}
              >
                {/* Title & Metadata */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: difficulty === 'Advanced' ? 'var(--accent-rose)' : 'var(--accent-blue)', background: difficulty === 'Advanced' ? '#ffebe9' : '#e8f0fe', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {difficulty}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{paper.numPages} pages</span>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.4, color: 'var(--text-primary)', height: '2.8rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {paper.fileName}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#b4690e', fontWeight: 700 }}>{starRating}</span>
                    <span style={{ color: '#eb8a00', display: 'flex', gap: '1px' }}>
                      {'★'.repeat(Math.round(starRating)) + '☆'.repeat(5 - Math.round(starRating))}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>({reviewCount})</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    {enrollments} students enrolled · {paper.glossaryCount} glossary terms
                  </div>
                </div>

                {/* Concept tags */}
                {paper.concepts?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {paper.concepts.slice(0, 3).map((c, i) => (
                      <span key={i} style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: '#f1f3f5',
                        border: '1px solid #e4e8eb',
                        color: 'var(--text-primary)',
                      }}>
                        {c}
                      </span>
                    ))}
                    {paper.concepts.length > 3 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center', fontWeight: 500 }}>
                        +{paper.concepts.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-primary)' }}>
                  <button
                    onClick={() => onOpenPublicPaper(paper)}
                    className="browse-btn"
                    style={{ flex: 1, padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', marginTop: 0 }}
                  >
                    <BookOpen size={14} /> Study Material
                  </button>
                  <button
                    onClick={() => handleUpvote(paper.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-primary)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--text-primary)';
                      e.currentTarget.style.background = '#f1f3f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    👍 {paper.upvotes ?? 0}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
