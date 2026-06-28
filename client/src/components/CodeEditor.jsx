import React, { useState, useEffect, useRef } from 'react';
import { Play, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STARTER_CODES = {
  javascript: `// Write any JavaScript code here!\nconst message = "Hello, Reagent Academy!";\nconsole.log(message);\n\nfunction greet(name) {\n  return "Hi, " + name + "! 👋";\n}\n\nconsole.log(greet("Developer"));`,
  python: `# Write Python code here!\nmessage = "Hello, Python in Reagent!"\nprint(message)\n\ndef greet(name):\n    return f"Hi, {name}! 🐍"\n\nprint(greet("Developer"))`,
  html: `<!-- Write HTML/CSS here! -->\n<div class="card">\n  <h1>Welcome to Reagent! 🎨</h1>\n  <p>This is a live visual preview of your HTML and CSS code.</p>\n  <button onclick="alert('Hello from HTML!')">Click Me</button>\n</div>\n\n<style>\n  .card {\n    padding: 2rem;\n    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n    color: white;\n    border-radius: 12px;\n    text-align: center;\n    box-shadow: 0 10px 15px rgba(0,0,0,0.1);\n    font-family: sans-serif;\n  }\n  button {\n    padding: 0.6rem 1.5rem;\n    background: white;\n    color: #764ba2;\n    border: none;\n    border-radius: 6px;\n    font-weight: bold;\n    margin-top: 1rem;\n    cursor: pointer;\n    transition: transform 0.1s;\n  }\n  button:hover {\n    transform: scale(1.05);\n  }\n</style>`
};

export const CHALLENGES = [
  {
    id: 'sum',
    title: 'Calculate Sum of Array',
    difficulty: 'Easy',
    description: 'Write a function `sumArray(numbers)` that takes an array of numbers and returns their sum. If the array is empty, return 0.',
    starterCode: `function sumArray(numbers) {\n  // Write your code here\n  \n  return 0;\n}\n\n// Test cases\nconsole.log("Sum [1, 2, 3]:", sumArray([1, 2, 3])); // Should output 6\nconsole.log("Sum []:", sumArray([])); // Should output 0`,
    testFn: (sumArray) => {
      if (typeof sumArray !== 'function') throw new Error('sumArray is not defined or is not a function');
      if (sumArray([1, 2, 3]) !== 6) throw new Error('sumArray([1, 2, 3]) should return 6');
      if (sumArray([]) !== 0) throw new Error('sumArray([]) should return 0');
      if (sumArray([-1, 5]) !== 4) throw new Error('sumArray([-1, 5]) should return 4');
      return true;
    }
  },
  {
    id: 'fizzbuzz',
    title: 'FizzBuzz Challenge',
    difficulty: 'Medium',
    description: 'Write a function `fizzBuzz(n)` that returns an array of strings from 1 to n. But for multiples of three, add "Fizz" instead of the number, for multiples of five, add "Buzz", and for multiples of both, add "FizzBuzz".',
    starterCode: `function fizzBuzz(n) {\n  // Write your code here\n  \n  return [];\n}\n\n// Test cases\nconsole.log("FizzBuzz 5:", fizzBuzz(5)); \n// Should output: [1, 2, "Fizz", 4, "Buzz"]`,
    testFn: (fizzBuzz) => {
      if (typeof fizzBuzz !== 'function') throw new Error('fizzBuzz is not defined or is not a function');
      const res = fizzBuzz(5);
      if (!Array.isArray(res) || res.length !== 5) throw new Error('fizzBuzz(5) should return an array of 5 items');
      if (res[2] !== 'Fizz') throw new Error('Index 2 should be "Fizz"');
      if (res[4] !== 'Buzz') throw new Error('Index 4 should be "Buzz"');
      const res15 = fizzBuzz(15);
      if (res15[14] !== 'FizzBuzz') throw new Error('Index 14 should be "FizzBuzz"');
      return true;
    }
  },
  {
    id: 'palindrome',
    title: 'Palindrome Checker',
    difficulty: 'Medium',
    description: 'Write a function `isPalindrome(str)` that checks whether a passed string is a palindrome (reads the same backward as forward, case-insensitive, ignoring non-alphanumeric characters).',
    starterCode: `function isPalindrome(str) {\n  // Write your code here\n  \n  return false;\n}\n\n// Test cases\nconsole.log("racecar:", isPalindrome("racecar")); // true\nconsole.log("hello:", isPalindrome("hello")); // false\nconsole.log("A man, a plan, a canal. Panama:", isPalindrome("A man, a plan, a canal. Panama")); // true`,
    testFn: (isPalindrome) => {
      if (typeof isPalindrome !== 'function') throw new Error('isPalindrome is not defined or is not a function');
      if (isPalindrome("racecar") !== true) throw new Error('isPalindrome("racecar") should return true');
      if (isPalindrome("hello") !== false) throw new Error('isPalindrome("hello") should return false');
      if (isPalindrome("A man, a plan, a canal. Panama") !== true) throw new Error('isPalindrome with punctuation should return true');
      return true;
    }
  },
  {
    id: 'sandbox',
    title: 'Free Code Sandbox',
    difficulty: 'Any',
    description: 'Welcome to the Sandbox! Write any JavaScript code here, run it to see results, and talk to your Socratic AI mentor to learn coding features.',
    starterCode: `// Write any JavaScript code here!\nconst message = "Hello, Reagent Academy!";\nconsole.log(message);\n\nfunction greet(name) {\n  return "Hi, " + name + "! 👋";\n}\n\nconsole.log(greet("Developer"));`,
    testFn: () => true
  }
];

export default function CodeEditor({ challengeId, onCodeChange, onChallengeSuccess, savedCode, onRefreshStats }) {
  const { getAuthHeaders } = useAuth();
  const challenge = CHALLENGES.find(c => c.id === challengeId) || CHALLENGES[3];
  
  // Multi-language sandbox states
  const [language, setLanguage] = useState('javascript');
  const [pyodideInstance, setPyodideInstance] = useState(null);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState('console'); // 'console' | 'preview'
  const [previewHtml, setPreviewHtml] = useState('');
  
  const [code, setCode] = useState(savedCode || challenge.starterCode);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [instructionsCollapsed, setInstructionsCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(true);
  const lineCounterRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (challengeId === 'sandbox') {
      setCode(savedCode || STARTER_CODES[language]);
    } else {
      setCode(savedCode || challenge.starterCode);
      setLanguage('javascript');
    }
    setConsoleLogs([]);
    setTestResult(null);
    setConsoleCollapsed(true);
    setActiveConsoleTab('console');
  }, [challengeId, savedCode]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const template = STARTER_CODES[newLang];
    setCode(template);
    if (onCodeChange) onCodeChange(template);
    setConsoleLogs([]);
    setTestResult(null);
    if (newLang === 'html') {
      setActiveConsoleTab('preview');
      setConsoleCollapsed(false);
    } else {
      setActiveConsoleTab('console');
      setConsoleCollapsed(true);
    }
  };

  const handleTextareaChange = (e) => {
    const val = e.target.value;
    setCode(val);
    if (onCodeChange) onCodeChange(val);
  };

  const handleScroll = (e) => {
    if (lineCounterRef.current) {
      lineCounterRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Pyodide dynamic script loader
  const loadPyodideScript = () => {
    return new Promise((resolve, reject) => {
      if (window.loadPyodide) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  const runCode = async () => {
    const logs = [];

    // Factual Audit Logging: Save 'run_code' action in background
    const logRunActivity = async () => {
      try {
        const headers = await getAuthHeaders();
        await fetch('http://localhost:5000/api/mentor/log-activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            action: 'run_code',
            challengeId: challenge.id,
            metadata: { 
              linesOfCode: code.split('\n').filter(l => l.trim().length > 0).length,
              language 
            }
          })
        });
      } catch (err) {
        console.error('Failed to log code run activity:', err);
      }
    };
    logRunActivity();

    // 1. HTML/CSS visual rendering
    if (language === 'html') {
      setPreviewHtml(code);
      setConsoleLogs(['System: Web preview updated successfully.']);
      setActiveConsoleTab('preview');
      setConsoleCollapsed(false);
      return ['System: Web preview updated successfully.'];
    }

    // 2. Python in-browser Pyodide run
    if (language === 'python') {
      setPyodideLoading(true);
      setConsoleLogs(['System: Initializing Python 3.x runtime in-browser...']);
      setConsoleCollapsed(false);

      try {
        await loadPyodideScript();
        let py = pyodideInstance;
        if (!py) {
          py = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
          });
          setPyodideInstance(py);
        }

        const pyOutputs = [];
        py.setStdout({
          batched: (text) => pyOutputs.push(text)
        });
        py.setStderr({
          batched: (text) => pyOutputs.push('❌ Python Error: ' + text)
        });

        await py.runPythonAsync(code);
        
        if (pyOutputs.length === 0) {
          pyOutputs.push('System: Python code executed successfully. (No output printed)');
        }
        setConsoleLogs(pyOutputs);
      } catch (err) {
        setConsoleLogs([`❌ Python Execution Error: ${err.message}`]);
      } finally {
        setPyodideLoading(false);
      }
      return;
    }

    // 3. JavaScript local evaluation
    const customConsole = {
      log: (...args) => {
        logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
      },
      error: (...args) => {
        logs.push('❌ Error: ' + args.join(' '));
      },
      warn: (...args) => {
        logs.push('⚠️ Warning: ' + args.join(' '));
      }
    };

    let compileErr = false;
    try {
      const runner = new Function('console', `
        try {
          ${code}
        } catch (err) {
          console.error(err.message + " (line " + (err.lineNumber || 'unknown') + ")");
        }
      `);
      
      runner(customConsole);
      if (logs.length === 0) {
        logs.push('System: JavaScript code executed successfully. (No output printed)');
      }
    } catch (compileErrObj) {
      compileErr = true;
      logs.push(`❌ Syntax/Compilation Error: ${compileErrObj.message}`);
    }

    setConsoleLogs(logs);
    if (logs.length > 1 || compileErr) {
      setConsoleCollapsed(false);
    }
    return logs;
  };

  const verifyCode = () => {
    // 1. Run console logs first
    runCode();

    // 2. Run unit tests
    try {
      let fnToTest = null;
      if (challenge.id !== 'sandbox') {
        const testRunner = new Function(`
          ${code}
          if (typeof ${challenge.id === 'sum' ? 'sumArray' : challenge.id === 'fizzbuzz' ? 'fizzBuzz' : 'isPalindrome'} !== 'undefined') {
            return ${challenge.id === 'sum' ? 'sumArray' : challenge.id === 'fizzbuzz' ? 'fizzBuzz' : 'isPalindrome'};
          }
          return null;
        `);
        fnToTest = testRunner();
      }

      if (challenge.id === 'sandbox') {
        setTestResult({ success: true, message: 'Sandbox run complete!' });
        
        // Audit log for sandbox submission
        const logSandboxSubmit = async () => {
          try {
            const headers = await getAuthHeaders();
            await fetch('http://localhost:5000/api/mentor/log-activity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({
                action: 'submit_sandbox',
                challengeId: challenge.id,
                metadata: { linesOfCode: code.split('\n').filter(l => l.trim().length > 0).length }
              })
            });
          } catch (e) {}
        };
        logSandboxSubmit();
        return;
      }

      if (!fnToTest) {
        throw new Error(`Function not defined in editor. Make sure your function is named correctly.`);
      }

      const success = challenge.testFn(fnToTest);
      if (success) {
        setTestResult({ success: true, message: '🎉 Excellent! All test cases passed successfully.' });
        
        const linesCount = code.split('\n').filter(l => l.trim().length > 0).length;
        if (onChallengeSuccess) {
          onChallengeSuccess(challenge.id, linesCount);
        }

        // Factual Audit Logging: Save 'submit_success' in background
        const logSuccessActivity = async () => {
          try {
            const headers = await getAuthHeaders();
            await fetch('http://localhost:5000/api/mentor/log-activity', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...headers
              },
              body: JSON.stringify({
                action: 'submit_success',
                challengeId: challenge.id,
                metadata: { linesOfCode: linesCount }
              })
            });
          } catch (err) {
            console.error('Failed to log submit success activity:', err);
          }
        };
        logSuccessActivity();
      }
    } catch (testErr) {
      setTestResult({ success: false, message: `❌ Tests Failed: ${testErr.message}` });
      setConsoleCollapsed(false); // Expand console drawer to display failure message

      // Factual Audit Logging: Save 'submit_fail' in background
      const logFailActivity = async () => {
        console.log("CodeEditor: logFailActivity triggered. Posting submit_fail...");
        try {
          const headers = await getAuthHeaders();
          const res = await fetch('http://localhost:5000/api/mentor/log-activity', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers
            },
            body: JSON.stringify({
              action: 'submit_fail',
              challengeId: challenge.id,
              metadata: { error: testErr.message, linesOfCode: code.split('\n').filter(l => l.trim().length > 0).length }
            })
          });
          console.log("CodeEditor: submit_fail response status:", res.status);
          if (res.ok && onRefreshStats) {
            console.log("CodeEditor: calling onRefreshStats()...");
            onRefreshStats();
          }
        } catch (err) {
          console.error('CodeEditor: Failed to log submit fail activity:', err);
        }
      };
      logFailActivity();
    }
  };

  const resetCode = () => {
    if (window.confirm('Are you sure you want to reset the editor to the starter template?')) {
      setCode(challenge.starterCode);
      setConsoleLogs([]);
      setTestResult(null);
      if (onCodeChange) onCodeChange(challenge.starterCode);
    }
  };

  // Generate line numbers column
  const lines = code.split('\n');
  const lineCount = Math.max(lines.length, 1);

  const getDifficultyLetter = (diff) => {
    if (diff === 'Easy') return 'B';
    if (diff === 'Medium') return 'I';
    if (diff === 'Hard' || diff === 'Advanced') return 'A';
    return 'A'; // e.g. 'Any' -> 'A'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', overflow: 'hidden', background: 'var(--surface-1)' }}>
      
      {/* Lesson / Instructions Panel */}
      <div className="glass-panel" style={{ 
        padding: instructionsCollapsed ? '0.4rem 0.75rem' : '0.75rem 1rem', 
        background: 'var(--surface-1)', 
        flexShrink: 0,
        transition: 'all 0.12s ease'
      }}>
        {instructionsCollapsed ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Instructions: <strong style={{ color: 'var(--text-primary)' }}>{challenge.title}</strong>
            </span>
            <button 
              onClick={() => setInstructionsCollapsed(false)}
              style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
            >
              Show Instructions
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{challenge.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span 
                  className="section-badge" 
                  style={{ 
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.72rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700
                  }}
                  title={`Difficulty: ${challenge.difficulty}`}
                >
                  {getDifficultyLetter(challenge.difficulty)}
                </span>
                <button 
                  onClick={() => setInstructionsCollapsed(true)}
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Hide
                </button>
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4', whiteSpace: 'pre-wrap', margin: 0 }}>
              {challenge.description}
            </p>
          </>
        )}
      </div>

      {/* Editor & Console Split View */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.5rem' }}>
        
        {/* Code Editor Container */}
        <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: '#1c1c22', borderColor: 'var(--border)', overflow: 'hidden', borderRadius: 'var(--radius-md)', minHeight: '150px' }}>
          {/* Editor Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', background: '#15151a', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                {language === 'javascript' ? 'javascript_sandbox.js' : language === 'python' ? 'python_sandbox.py' : 'index.html'}
              </span>
              
              {challenge.id === 'sandbox' && (
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    outline: 'none',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python 3</option>
                  <option value="html">HTML/CSS</option>
                </select>
              )}
            </div>

            <button onClick={resetCode} title="Reset code template" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>

          {/* Interactive Writing Area */}
          <div style={{ display: 'flex', flexGrow: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
            
            {/* Line numbers counter */}
            <div 
              ref={lineCounterRef}
              style={{
                width: '40px',
                padding: '0.75rem 0',
                background: '#15151a',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                textAlign: 'right',
                paddingRight: '0.65rem',
                borderRight: '1px solid var(--border)',
                userSelect: 'none',
                overflow: 'hidden',
                flexShrink: 0,
                height: '100%',
                minHeight: '100%'
              }}
            >
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Input Textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={handleTextareaChange}
              onScroll={handleScroll}
              spellCheck="false"
              style={{
                flexGrow: 1,
                height: '100%',
                minHeight: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#EDEDF0',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                border: 'none',
                resize: 'none',
                outline: 'none',
                overflowY: 'auto',
                whiteSpace: 'pre',
                wordWrap: 'normal'
              }}
            />

          </div>
        </div>

        {/* Action Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}>
          <button 
            onClick={runCode}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              padding: '0.5rem 1.25rem', 
              background: 'transparent', 
              border: '1px solid var(--border-strong)', 
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Play size={14} /> Run Code
          </button>
          
          <button 
            onClick={verifyCode}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              padding: '0.5rem 1.5rem', 
              background: 'var(--accent)', 
              border: 'none', 
              color: 'white',
              margin: 0,
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Check size={14} /> Submit & Test
          </button>
        </div>

        {/* Console / Output Drawer */}
        <div 
          className="glass-panel" 
          style={{ 
            height: consoleCollapsed ? '80px' : (activeConsoleTab === 'preview' ? '380px' : '220px'), 
            background: 'var(--surface-2)', 
            borderColor: 'var(--border)', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            borderRadius: 'var(--radius-md)', 
            flexShrink: 0,
            transition: 'height 0.15s ease'
          }}
        >
          {/* Console Header (Clickable to collapse/expand) */}
          <div 
            onClick={() => setConsoleCollapsed(!consoleCollapsed)}
            style={{ 
              padding: '0.4rem 1rem', 
              background: 'var(--surface-1)', 
              borderBottom: '1px solid var(--border)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0
            }}
          >
            {/* Tabs list inside Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveConsoleTab('console');
                  setConsoleCollapsed(false);
                }}
                style={{ 
                  fontSize: '0.72rem', 
                  color: activeConsoleTab === 'console' ? 'var(--accent)' : 'var(--text-secondary)', 
                  fontWeight: 750, 
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: activeConsoleTab === 'console' ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingBottom: '0.2rem',
                  transition: 'all 0.15s ease'
                }}
              >
                Console Output
              </span>
              
              {language === 'html' && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveConsoleTab('preview');
                    setConsoleCollapsed(false);
                  }}
                  style={{ 
                    fontSize: '0.72rem', 
                    color: activeConsoleTab === 'preview' ? 'var(--accent)' : 'var(--text-secondary)', 
                    fontWeight: 750, 
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: activeConsoleTab === 'preview' ? '2px solid var(--accent)' : '2px solid transparent',
                    paddingBottom: '0.2rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Live Preview
                </span>
              )}
            </div>

            {testResult && (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: testResult.success ? 'var(--success)' : 'var(--danger)' }}>
                {testResult.message}
              </span>
            )}
          </div>
          
          {/* Output Content Body */}
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: activeConsoleTab === 'preview' ? '#ffffff' : 'transparent' }}>
            {activeConsoleTab === 'preview' ? (
              // HTML Live visual preview iframe
              !consoleCollapsed && (
                <iframe
                  title="Visual Live Preview"
                  srcDoc={previewHtml}
                  sandbox="allow-scripts"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#ffffff'
                  }}
                />
              )
            ) : (
              // Standard Console Logs
              <div style={{ flexGrow: 1, padding: '0.75rem 1rem', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: '1.4', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {pyodideLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', paddingBottom: '0.5rem' }}>
                    <div className="cyber-loader" style={{ width: '14px', height: '14px', borderWidth: '1.5px', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                    <span>Loading Python in-browser runtime environment (Pyodide)...</span>
                  </div>
                )}
                
                {consoleCollapsed ? (
                  // Collapsed Mode: show only the very last console output line
                  consoleLogs.length > 0 ? (
                    <div style={{ 
                      color: consoleLogs[consoleLogs.length - 1].startsWith('❌') ? 'var(--danger)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {consoleLogs[consoleLogs.length - 1]}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Console idle. Click 'Run Code' to execute.
                    </div>
                  )
                ) : (
                  // Expanded Mode: show full logs list
                  <>
                    {consoleLogs.map((log, index) => (
                      <div 
                        key={index} 
                        style={{ 
                          color: log.startsWith('❌') ? 'var(--danger)' : log.startsWith('⚠️') ? 'var(--momentum)' : log.startsWith('System') ? 'var(--text-muted)' : 'var(--text-primary)',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {log}
                      </div>
                    ))}
                    {consoleLogs.length === 0 && !pyodideLoading && (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Console idle. Click 'Run Code' or 'Submit & Test' to execute.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
