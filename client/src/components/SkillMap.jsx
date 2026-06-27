import React from 'react';

export const CONCEPTS = [
  'variables',
  'arrays',
  'math',
  'loops',
  'conditionals',
  'strings',
  'regex',
  'general_logic'
];

const CONCEPT_LABELS = {
  variables: 'Variables & Scope',
  arrays: 'Array Operations',
  math: 'Numeric Math',
  loops: 'Loops & Iterations',
  conditionals: 'Control Flow',
  strings: 'String Operations',
  regex: 'Regex Matching',
  general_logic: 'General Logic'
};

export default function SkillMap({ skillMap = {}, onConceptClick, layout = 'strip' }) {
  const getRampColor = (score) => {
    if (score < 0.25) return 'var(--skill-ramp-0)';
    if (score < 0.50) return 'var(--skill-ramp-1)';
    if (score < 0.75) return 'var(--skill-ramp-2)';
    if (score < 0.95) return 'var(--skill-ramp-3)';
    return 'var(--skill-ramp-4)';
  };

  const getStatusText = (score) => {
    if (score < 0.25) return 'Not started';
    if (score < 0.50) return 'Early';
    if (score < 0.75) return 'Developing';
    if (score < 0.95) return 'Solid';
    return 'Mastered';
  };

  if (layout === 'grid') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
        {CONCEPTS.map(concept => {
          const score = skillMap[concept] !== undefined ? skillMap[concept] : 0.0;
          const percentage = Math.round(score * 100);
          
          return (
            <div 
              key={concept}
              onClick={() => onConceptClick && onConceptClick(concept)}
              style={{
                padding: '1.25rem',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: onConceptClick ? 'pointer' : 'default',
                transition: 'var(--transition-smooth)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
              className="glass-panel"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {CONCEPT_LABELS[concept] || concept}
                </span>
                <div 
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: getRampColor(score),
                    flexShrink: 0
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{getStatusText(score)}</span>
                  <span style={{ fontWeight: 600 }}>{percentage}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: getRampColor(score), transition: 'width 0.3s ease-out' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback / default: Strip layout
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '0.25rem 0' }}>
      {CONCEPTS.map(concept => {
        const score = skillMap[concept] !== undefined ? skillMap[concept] : 0.0;
        
        return (
          <div 
            key={concept}
            onClick={() => onConceptClick && onConceptClick(concept)}
            tabIndex={0}
            title={`${CONCEPT_LABELS[concept] || concept}: ${Math.round(score * 100)}% (${getStatusText(score)})`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.75rem',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: onConceptClick ? 'pointer' : 'default',
              transition: 'var(--transition-smooth)',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              if (onConceptClick) e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'none';
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div 
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '3px',
                backgroundColor: getRampColor(score),
                transition: 'background-color 0.3s ease-out',
                flexShrink: 0
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {concept}
            </span>
          </div>
        );
      })}
    </div>
  );
}
