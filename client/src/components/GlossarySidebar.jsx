import React, { useState } from 'react';
import { Search, Book } from 'lucide-react';

const CHEAT_SHEET = [
  { term: 'Function Declaration', definition: 'function greet(name) {\n  return "Hello " + name;\n}' },
  { term: 'Arrow Function', definition: 'const greet = (name) => `Hello ${name}`;' },
  { term: 'Array Map', definition: 'const doubled = array.map(x => x * 2);\n// Transforms each element and returns a new array.' },
  { term: 'Array Filter', definition: 'const evens = array.filter(x => x % 2 === 0);\n// Returns a new array with elements passing the condition.' },
  { term: 'Array Reduce', definition: 'const sum = array.reduce((acc, curr) => acc + curr, 0);\n// Accumulates array values into a single result.' },
  { term: 'For Loop', definition: 'for (let i = 0; i < array.length; i++) {\n  console.log(array[i]);\n}' },
  { term: 'Ternary Operator', definition: 'const status = age >= 18 ? "adult" : "minor";\n// Shorthand syntax for standard if-else condition.' },
  { term: 'Template Literals', definition: 'const greeting = `Hello, ${name}!`;\n// Embed expression variables inside backtick strings.' },
  { term: 'Object Destructuring', definition: 'const { name, age } = user;\n// Unpacks properties of an object into local variables.' },
  { term: 'Async/Await', definition: 'async function fetchCode() {\n  const res = await fetch(url);\n  return res.json();\n}' }
];

export default function GlossarySidebar() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = CHEAT_SHEET.filter(item => 
    item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glossary-container">
      {/* Search Input */}
      <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search syntax cheat sheet..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glossary-search"
          style={{ paddingLeft: '2.5rem' }}
        />
        <Search 
          size={16} 
          style={{ 
            position: 'absolute', 
            left: '1rem', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-muted)' 
          }} 
        />
      </div>

      {/* Syntax List */}
      <div className="glossary-list" style={{ marginTop: '0.5rem' }}>
        {filteredItems.map((item, idx) => (
          <div key={idx} className="glossary-item" style={{ background: '#ffffff', border: '1px solid var(--border-primary)', padding: '1rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
            <span className="glossary-term" style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
              {item.term}
            </span>
            <pre 
              style={{ 
                fontFamily: 'monospace', 
                fontSize: '0.8rem', 
                background: 'var(--bg-surface-hover)', 
                padding: '0.5rem', 
                borderRadius: '4px', 
                color: 'var(--text-primary)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                margin: 0
              }}
            >
              {item.definition}
            </pre>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem' }}>
            <Book size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>No matching terms found in cheat sheet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
