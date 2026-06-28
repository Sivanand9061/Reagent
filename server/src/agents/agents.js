import { getAIChatCompletion } from '../services/aiService.js';

/**
 * 1. Extractor Agent
 * Analyzes the raw text of a research paper and breaks it into logical sections,
 * identifies 8-10 key concepts (for progress tracking), and builds a glossary of technical terms.
 */
export async function runExtractorAgent(rawText, userKeys = {}, logCallback = () => {}) {
  logCallback('Extractor Agent: Initializing paper structure analysis...');
  
  const systemInstruction = `You are an expert academic text extractor. Your task is to analyze the text of a research paper and extract its structure, key concepts, and a glossary of technical terms.
You must return a JSON object with the following structure:
{
  "sections": {
    "Abstract": "content...",
    "Introduction": "content...",
    "Methodology": "content...",
    "Results": "content...",
    "Discussion": "content...",
    "Conclusion": "content..."
  },
  "concepts": [
    "Key Concept 1",
    "Key Concept 2"
  ],
  "glossary": [
    { "term": "Technical Term", "definition": "A concise, clear definition of the term." }
  ]
}

Rules:
1. "sections": Group the text into its natural sections. Standard scientific sections include Abstract, Introduction, Methodology/Methods, Results, Discussion, Conclusion. If the paper uses custom headers (e.g. "Related Work", "Background", "Implementation Details", "Proof"), use those as keys instead of forcing standard names. The content must be exact extracts or close edits of the text under those headings.
2. "concepts": Extract a list of exactly 8-10 core technical concepts, methodologies, or theories introduced or discussed in the paper. These will be used to track the user's reading progress.
3. "glossary": Extract 10-15 complex, technical, or domain-specific terms from the paper and provide a simple, 1-sentence definition for each.
4. Output MUST be valid JSON, conforming strictly to the structure above. No preamble, markdown syntax (like \`\`\`json), or tail comments.`;

  // Since rawText might be extremely long, we will truncate it to the first 40,000 characters to fit in context windows if needed.
  // Standard models handle this easily.
  const sampleText = rawText.length > 40000 
    ? rawText.substring(0, 40000) + "\n\n[TEXT TRUNCATED FOR CONTEXT LIMITS]"
    : rawText;

  const prompt = `Here is the research paper text:\n\n${sampleText}\n\nAnalyze and extract the structure, 8-10 concepts, and 10-15 glossary items now.`;
  
  logCallback('Extractor Agent: Sending chunk to AI for structure, concept, and glossary extraction...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.1,
    jsonMode: true,
    userKeys
  });

  try {
    logCallback('Extractor Agent: Processing response...');
    // Strip markdown blocks if any returned despite instructions
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    
    // Ensure fallback properties exist
    if (!data.sections || typeof data.sections !== 'object') data.sections = { "Full Text": rawText };
    if (!data.concepts || !Array.isArray(data.concepts)) data.concepts = ["Introduction to the paper"];
    if (!data.glossary || !Array.isArray(data.glossary)) data.glossary = [];
    
    logCallback('Extractor Agent: Successfully structured paper!');
    return data;
  } catch (error) {
    console.error("Failed to parse Extractor Agent output:", resultText);
    logCallback('Extractor Agent Error: Failed to parse structured output. Creating fallback sections.');
    
    // Create a fallback structure if AI JSON parsing failed completely
    return {
      sections: {
        "Full Text": rawText.substring(0, 10000) + "..."
      },
      concepts: ["Read Abstract", "Read Introduction", "Analyze Methodology", "Examine Results"],
      glossary: []
    };
  }
}

/**
 * 2. Explainer Agent
 * Explains a concept or highlighted text snippet in plain or advanced language.
 */
export async function runExplainerAgent(textSnippet, difficulty = 'simple', userKeys = {}, logCallback = () => {}, context = '', history = [], tone = 'formal') {
  logCallback(`Explainer Agent: Starting explanation generation (Difficulty: ${difficulty}, Tone: ${tone})...`);
  
  let systemInstruction = `You are a helpful and expert academic explainer agent. Your goal is to explain complex research text or scientific concepts.
Rules:
1. Explain the text in plain, clear language. Use analogical reasoning where helpful.
2. Keep your explanation under 200 words.
3. Align with the requested difficulty level:
   - "simple": Explain like I'm 12 (ELI12). Use simple everyday vocabulary, high-level intuition, and vivid real-world analogies.
   - "advanced": Explain like a PhD student. Retain technical accuracy, mention relevant methodologies/statistics, and use precise academic terms, but explain them clearly.
4. Align with the requested tone:
   - "formal": Adopt a professional, objective, academic tone. Be precise and rigorous.
   - "casual": Adopt a friendly, helpful, highly conversational, and casual tone. Use matching, suitable, and trendy emojis (e.g. 🧠, ✨, 🚀, 🔬, 🤓, 🙌) to make the explanation feel interactive, encouraging, and easy to read.`;

  if (context) {
    systemInstruction += `\n\n5. Context Rule: You are provided with context from the research paper. Prioritize answering the question based on this context.
6. Out-of-Context Rule: If the user asks a question that is completely unrelated to the research paper, its topics, or scientific concepts in general:
   - Do NOT reject the question coldly. Give a very generous, brief answer to their question (be friendly and helpful).
   - Then, immediately and gently bridge back to the research paper, prompting them to ask a question related to the document's concepts or sections.
   - Example: "That's a fun question! 🍕 While pizza is amazing, let's get back to the paper. We're exploring neural networks here. Ask me anything about how they model these layers!"`;
  }

  let prompt = '';
  if (history && history.length > 0) {
    const historyString = history.map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');
    prompt = `Here is the conversation history:\n${historyString}\n\n`;
  }
  
  if (context) {
    const truncatedContext = context.length > 10000 ? context.substring(0, 10000) + '...' : context;
    prompt += `Here is the relevant context from the research paper:\n"""\n${truncatedContext}\n"""\n\n`;
  }
  
  prompt += `User Question: "${textSnippet}"\n\nPlease provide your explanation or answer now.`;
  
  logCallback('Explainer Agent: Submitting explanation request...');
  const explanation = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.3,
    jsonMode: false,
    userKeys
  });
  
  logCallback('Explainer Agent: Explanation ready.');
  return explanation;
}

/**
 * 3. Quiz Agent
 * Generates 3 questions (with options and explanations) based on concepts and explanations explored in this session.
 */
export async function runQuizAgent(sessionConcepts, userKeys = {}, logCallback = () => {}) {
  logCallback('Quiz Agent: Formulating active recall quiz questions based on session concepts...');
  
  const systemInstruction = `You are an educational assessment agent. Your task is to generate quiz questions to test the user's active recall of the concepts they have read in their current session.
You must return a JSON object with the following structure:
{
  "questions": [
    {
      "id": 1,
      "question": "A clear, specific question testing a concept they read.",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "The exact string match of the correct option",
      "explanation": "Explanation of why this choice is correct and others are not."
    }
  ]
}

Rules:
1. Generate exactly 3 multiple-choice questions.
2. The questions must be directly based on the concepts provided.
3. Make options plausible but distinct. The correct answer must be unambiguous.
4. Output MUST be valid JSON, conforming strictly to the structure above. No markdown formatting.`;

  const conceptsString = sessionConcepts.map((c, i) => `Concept ${i + 1}:\nName/Snippet: ${c.name}\nExplanation: ${c.explanation}`).join('\n\n');
  const prompt = `Here are the concepts explored by the user in this session:\n\n${conceptsString}\n\nGenerate the 3 quiz questions now.`;

  logCallback('Quiz Agent: Sending prompt to AI...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.5,
    jsonMode: true,
    userKeys
  });

  try {
    logCallback('Quiz Agent: Processing quiz questions response...');
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error("Invalid structure");
    }
    
    logCallback('Quiz Agent: Quiz questions generated successfully!');
    return data.questions;
  } catch (error) {
    console.error("Failed to parse Quiz Agent output:", resultText);
    logCallback('Quiz Agent Error: Parsing failed. Returning fallback questions.');
    
    return [
      {
        id: 1,
        question: "What is the primary contribution of the research paper you just explored?",
        type: "multiple-choice",
        options: ["Introducing a new methodology", "Refuting historical models", "Providing a review of literature", "Applying a standard method to a new dataset"],
        answer: "Introducing a new methodology",
        explanation: "Most research papers focus on presenting a novel methodology or solution."
      }
    ];
  }
}

/**
 * 4. Critique Agent
 * Evaluates the full paper content (or sample text) and suggests 3 weaknesses/limitations.
 */
export async function runCritiqueAgent(rawText, userKeys = {}, logCallback = () => {}) {
  logCallback('Critique Agent: Actively reviewing paper claims and methodology...');
  
  const systemInstruction = `You are an elite, critical peer reviewer for top-tier scientific journals. Your task is to critique the research paper, highlighting potential weaknesses, unaddressed assumptions, or limitations.
You must return a JSON object with the following structure:
{
  "critiques": [
    {
      "title": "A short, descriptive title of the critique topic (e.g., 'Sample Bias in Evaluation')",
      "description": "A thorough, 2-3 sentence explanation of the potential weakness, methodology gap, or limitation."
    }
  ]
}

Rules:
1. Identify exactly 3 distinct critiques.
2. Be objective, scientific, and constructive.
3. Focus on sample sizes, generalization limits, unstated assumptions, mathematical leaps, or benchmark limitations.
4. Output MUST be valid JSON conforming strictly to the structure above. No markdown formatting.`;

  const sampleText = rawText.length > 40000 
    ? rawText.substring(0, 40000) + "\n\n[TEXT TRUNCATED FOR CONTEXT LIMITS]"
    : rawText;

  const prompt = `Here is the research paper text:\n\n${sampleText}\n\nReview this text critically and generate the 3 critiques now.`;

  logCallback('Critique Agent: Submitting paper contents for critique...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.4,
    jsonMode: true,
    userKeys
  });

  try {
    logCallback('Critique Agent: Processing critique response...');
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    
    if (!data.critiques || !Array.isArray(data.critiques)) {
      throw new Error("Invalid structure");
    }
    
    logCallback('Critique Agent: Critiques ready.');
    return data.critiques;
  } catch (error) {
    console.error("Failed to parse Critique Agent output:", resultText);
    logCallback('Critique Agent Error: Parsing failed. Returning placeholder critiques.');
    
    return [
      {
        title: "Generalizability Concerns",
        description: "The results are evaluated on a limited dataset, which may limit generalizability to real-world out-of-distribution scenarios."
      },
      {
        title: "Computational Overhead",
        description: "The proposed methodology relies heavily on extensive training or processing time, which is not fully accounted for in the resource cost analysis."
      },
      {
        title: "Simplifying Assumptions",
        description: "The model makes several simplifying assumptions about data distributions that might not hold in noise-heavy settings."
      }
    ];
  }
}

/**
 * 5. Code Mentor Agent
 * Guides coding students Socrates-style or direct instruction with time awareness.
 */
export async function runCodeMentorAgent({
  code,
  message,
  challengeId = 'sandbox',
  mentorMode = 'socratic',
  tone = 'casual',
  history = [],
  currentTime = '',
  sessionContext = null,
  activeDoc = null,
  userKeys = {},
  logCallback = () => {}
}) {
  logCallback(`Code Mentor Agent: Analyzing query (Mode: ${mentorMode}, Tone: ${tone})...`);
  
  let systemInstruction = `You are an expert AI Coding Mentor. Your goal is to guide the student in learning coding, helping them write clean code and debug their errors.

**WORKSPACE VISIBILITY RULE**:
You have direct, real-time visibility into the student's code editor! Their current code is injected below under the section [Current Student Code in Editor].
Never tell the student that you cannot see their code, screen, or sandbox. You must read the code provided in the prompt directly and use it to review their work, point out bugs, and guide them. Do NOT ask the user to copy-paste their code.

You must follow these rules based on the Mentor Mode:
1. **"socratic" (Socratic Guide)**: DO NOT write or correct the student's code directly! Do NOT give them copy-pasteable blocks of the completed solution. Instead, analyze their code, explain the conceptual bug, ask leading questions, and provide minor hints or syntax examples to guide them to find the fix themselves. Act like a true real-time mentor.
2. **"direct" (Direct Instructor)**: Explain the error clearly, point out the exact line numbers that have problems, and provide a clean, corrected code block showing how to implement the solution correctly.`;

  if (message === '[SYSTEM_WELCOME_GREETING]') {
    let challengeName = 'Free Code Sandbox';
    let challengeGoal = 'writing arbitrary code and experimenting with JavaScript, Python, or HTML/CSS';
    if (challengeId === 'sum') {
      challengeName = 'Calculate Sum of Array';
      challengeGoal = 'writing a function `sumArray(numbers)` that sums up all elements in a numeric array and returns it';
    } else if (challengeId === 'fizzbuzz') {
      challengeName = 'FizzBuzz Challenge';
      challengeGoal = 'writing a function `fizzBuzz(n)` that returns an array of numbers from 1 to n with multiples of three replaced by "Fizz", multiples of five replaced by "Buzz", and both by "FizzBuzz"';
    } else if (challengeId === 'palindrome') {
      challengeName = 'Palindrome Checker';
      challengeGoal = 'writing a function `isPalindrome(str)` that checks whether a string reads the same backward as forward (case-insensitive, ignoring alphanumeric characters)';
    }

    systemInstruction = `You are an expert AI Coding Mentor. The user has just clicked on the challenge: "${challengeName}" and loaded the workspace.
    
Your task is to generate a brief, encouraging welcome message:
1. Greet them warmly and contextually.
2. Briefly introduce the goal of the challenge: "${challengeGoal}".
3. Socratic-ly ask them how they plan to approach writing this code or setting up the logic, guiding them to begin.
4. Keep the message under 3 sentences to keep it brief and fast to read. Do not write any code solutions yet.
5. Adjust tone according to the Tone Toggle:
- "casual": Friendly, encouraging, and use developer emojis.
- "formal": Professional, objective, precise, and academic (no emojis).
`;
  }

Adjust your tone according to the Tone Toggle:
- **"casual"**: Friendly, supportive, highly conversational, and encouraging. Use trendy developer emojis (e.g. 💻, 🚀, 🐛, 🧠, ✨, 🤓) to make the chat interactive and realistic.
- **"formal"**: Professional, objective, precise, and academic. Do not use emojis. Focus on technical terms and code logic.

**Time Awareness Rule**:
You are aware of the real-time temporal context:
- Current Time: ${currentTime || 'Unknown'}
IMPORTANT: The Current Time represents the user's actual local time. Focus on the hour and timezone offset provided in the Current Time string to determine their local time of day (e.g. morning, afternoon, evening, night). Do not use UTC time or assume a different timezone; greet and respond according to their exact local hour.
Use this temporal information to greet the user contextually when they start a conversation or ask their first question. Be natural and brief.

**Out-of-Context Rule**:
If the student asks a question that is completely unrelated to programming, computer science, software engineering, or coding challenges:
- Give a very generous, brief answer (be friendly).
- Immediately and politely bridge back to coding (e.g., "While that's a cool topic, let's write some code! What challenge are we working on?").

**SESSION PROGRESS CONTEXT RULE**:
You have direct access to the user's active session context containing their current learning node, their skill map proficiency (0.0 to 1.0) on various concepts, their recent struggles, and a summary of their last session.
Use this context to personalize your Socratic mentoring:
- If the user has a low skill score in a concept relevant to the active node, pitch your hints at a more foundational/beginner level.
- If the user has high proficiency, skip basic explanations and focus on best practices/performance.
- If the user's question relates to a concept in their recent struggles, connect it to guide them (e.g., "remember the off-by-one loop structure we saw earlier?").
- Use the last session summary for continuity when appropriate.
`;

  if (activeDoc) {
    systemInstruction = `You are a Document Q&A Agent. Your task is to explain, teach, and answer questions based strictly on the uploaded document named "${activeDoc.fileName}".
    
**WORKSPACE VISIBILITY RULE**:
You have direct, real-time visibility into the student's code editor! Their current code is injected below under the section [Current Student Code in Editor].
Never tell the user that you cannot see their code, screen, or sandbox. Read the code provided in the prompt directly if they ask you to review it, explain it, or relate it to the document. Do NOT ask them to copy-paste their code.

You must follow these rules:
1. Ground your answers strictly in the provided document content. Do not guess or make up facts.
2. If the user asks questions, give clear, direct answers, explanations, and teachings related to the document. Do not give Socratic leading hints when asked for answers related to the document; instead, directly teach, explain, and answer based on the document.
3. If they ask about code or programming in relation to the document, provide code snippets or solutions from or inspired by the document.
4. If a question cannot be answered using the document, state that the document does not contain that information, but offer to explain related concepts if helpful.
5. Keep your tone helpful, educational, and focused on teaching the document's content. Adjust tone according to the Tone Toggle:
- "casual": Friendly, conversational, encouraging, and use developer emojis.
- "formal": Professional, objective, precise, and academic (no emojis).
`;
  }

  let prompt = '';
  
  if (activeDoc) {
    const docLimit = 15000;
    const truncatedText = activeDoc.text.length > docLimit
      ? activeDoc.text.substring(0, docLimit) + "\n\n[Document content truncated for context size limits]"
      : activeDoc.text;
    prompt += `[Uploaded Document Content from "${activeDoc.fileName}"]:
${truncatedText}

`;
  }
  
  if (sessionContext) {
    prompt += `[USER ACTIVE SESSION CONTEXT]:
- Active Node: ${JSON.stringify(sessionContext.activeNode || {})}
- Skill Map (Proficiency): ${JSON.stringify(sessionContext.skillMap || {})}
- Recent Struggles: ${JSON.stringify(sessionContext.recentStruggles || [])}
- Last Session Summary: ${sessionContext.lastSessionSummary || 'None'}

`;
  } else {
    prompt += `[USER ACTIVE SESSION CONTEXT]:
No active session context document found. First active session.

`;
  }
  
  if (code) {
    prompt += `[Current Student Code in Editor]:\n\`\`\`javascript\n${code}\n\`\`\`\n\n`;
  }
  
  if (history && history.length > 0) {
    const historyString = history.map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');
    prompt += `[Conversation History]:\n${historyString}\n\n`;
  }
  
  prompt += `Student Message: "${message}"\n\nProvide your mentorship response now:`;
  
  logCallback('Code Mentor Agent: Submitting request to AI completion...');
  const response = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.3,
    jsonMode: false,
    userKeys
  });
  
  logCallback('Code Mentor Agent: Mentor response ready.');
  return response;
}

/**
 * 6. Code Quiz Agent
 * Generates 3 MCQs based on coding challenge objectives.
 */
export async function runCodeQuizAgent(challengeId, currentCode = '', userKeys = {}, logCallback = () => {}) {
  logCallback(`Code Quiz Agent: Formulating MCQ questions for challenge ${challengeId}...`);
  
  const systemInstruction = `You are an educational coding assessment agent. Your task is to generate quiz questions to test the user's active recall of coding syntax, logic flow, or programming concepts.
You must return a JSON object with the following structure:
{
  "questions": [
    {
      "id": 1,
      "question": "A clear, specific question testing syntax, behavior of a code snippet, or a programming concept.",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "The exact string match of the correct option",
      "explanation": "Explanation of why this choice is correct, explaining the coding logic."
    }
  ]
}

Rules:
1. Generate exactly 3 multiple-choice questions.
2. The questions should relate to the programming concepts used in the challenge: ${challengeId}.
3. You can include a small code snippet in the question description (e.g. using markdown code style) to ask "What does this code return?".
4. Make options plausible but distinct. The correct answer must be unambiguous.
5. Output MUST be valid JSON, conforming strictly to the structure above. No markdown formatting.`;

  const prompt = `Challenge ID: ${challengeId}\nUser's Current Code (if any):\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nGenerate the 3 quiz questions now.`;

  logCallback('Code Quiz Agent: Sending prompt to AI...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.5,
    jsonMode: true,
    userKeys
  });

  try {
    logCallback('Code Quiz Agent: Processing response...');
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    return data.questions;
  } catch (error) {
    console.error("Failed to parse Code Quiz Agent output:", resultText);
    logCallback('Code Quiz Agent Error: Parsing failed. Returning fallback questions.');
    return [
      {
        id: 1,
        question: "In JavaScript, what is the difference between '==' and '==='?",
        type: "multiple-choice",
        options: [
          "'==' compares only values, '===' compares both value and type",
          "'===' compares only values, '==' compares both value and type",
          "There is no difference",
          "'==' is used for assignment, '===' is used for comparison"
        ],
        answer: "'==' compares only values, '===' compares both value and type",
        explanation: "The triple equals '===' operator performs strict equality comparison, checking both value and data type, preventing type coercion."
      }
    ];
  }
}

/**
 * 6.5 Micro-Challenge Agent
 * Generates 3 small code completion challenges targeting recentStruggles and low skillMap concepts.
 */
export async function runMicroChallengeAgent(sessionContext, userKeys = {}, logCallback = () => {}) {
  logCallback('Micro-Challenge Agent: Preparing targeted code completion challenges...');

  const systemInstruction = `You are a programming education agent. Your task is to generate short, interactive code completion challenges (fill-in-the-blank or debug tasks) to test and improve the user's active coding skills.
You must return a JSON object with the following structure:
{
  "challenges": [
    {
      "id": 1,
      "title": "A short, descriptive title of the coding challenge",
      "instruction": "Clear instructions explaining what the user needs to do in the function.",
      "codeTemplate": "The starter JavaScript code template. Include comments indicating where they need to edit, and leave a clear gap or error.",
      "solution": "The correct solution code for reference.",
      "tests": "JavaScript code containing basic assert/test checks. Example: 'assert.equal(myFunc(2), 4); assert.equal(myFunc(3), 9);'",
      "explanation": "A brief explanation of the correct logic."
    }
  ]
}

Rules:
1. Generate exactly 3 interactive challenges.
2. Target the user's recent struggles or lowest skill map proficiencies first.
3. Keep the code templates short (2-4 lines). The user should be able to edit and complete the function quickly.
4. Ensure the "tests" string contains valid executable JavaScript code checking the template function. Do not write complex test suites, just basic assertions. Define the assertions clearly using a simple assertion helper (e.g. 'assert.equal(func(), expected)' or 'assert(cond)').
5. Output MUST be valid JSON conforming strictly to the structure above. No markdown formatting.`;

  const activeNode = sessionContext?.activeNode || {};
  const skillMap = sessionContext?.skillMap || {};
  const recentStruggles = sessionContext?.recentStruggles || [];

  const prompt = `User Session Info:
- Active Node: ${JSON.stringify(activeNode)}
- Skill Map: ${JSON.stringify(skillMap)}
- Recent Struggles: ${JSON.stringify(recentStruggles)}

Analyze this profile and generate the 3 targeted coding micro-challenges now.`;

  logCallback('Micro-Challenge Agent: Sending request to AI completion...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.5,
    jsonMode: true,
    userKeys
  });

  try {
    logCallback('Micro-Challenge Agent: Parsing challenges JSON response...');
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    
    if (!data.challenges || !Array.isArray(data.challenges)) {
      throw new Error("Invalid structure");
    }
    
    logCallback('Micro-Challenge Agent: Successfully generated 3 micro-challenges!');
    return data.challenges;
  } catch (error) {
    console.error("Failed to parse Micro-Challenge Agent output:", resultText);
    logCallback('Micro-Challenge Agent Error: Parsing failed. Returning fallback challenges.');
    
    return [
      {
        id: 1,
        title: "Fix the loop",
        instruction: "Fix the loop condition so it iterates exactly n times.",
        codeTemplate: "function iterate(n) {\n  let count = 0;\n  for (let i = 0; i <= n; i++) { // Fix this line\n    count++;\n  }\n  return count;\n}",
        solution: "function iterate(n) {\n  let count = 0;\n  for (let i = 0; i < n; i++) {\n    count++;\n  }\n  return count;\n}",
        tests: "assert.equal(iterate(5), 5); assert.equal(iterate(0), 0);",
        explanation: "The condition 'i <= n' was changed to 'i < n' to prevent an extra iteration (off-by-one error)."
      },
      {
        id: 2,
        title: "Add Array Elements",
        instruction: "Complete the function to sum all numbers in the array.",
        codeTemplate: "function sumArray(arr) {\n  // Write your logic here\n}",
        solution: "function sumArray(arr) {\n  return arr.reduce((sum, n) => sum + n, 0);\n}",
        tests: "assert.equal(sumArray([1, 2, 3]), 6); assert.equal(sumArray([]), 0);",
        explanation: "Use reduce or a loop to add each element in the array."
      },
      {
        id: 3,
        title: "Check Even Number",
        instruction: "Return true if the number is even, otherwise false.",
        codeTemplate: "function isEven(num) {\n  return num % 2 === 0;\n}",
        solution: "function isEven(num) {\n  return num % 2 === 0;\n}",
        tests: "assert.equal(isEven(4), true); assert.equal(isEven(7), false);",
        explanation: "The modulo operator '%' returns the remainder. num % 2 === 0 checks if it is divisible by 2."
      }
    ];
  }
}


/**
 * 7. Code Critique Agent
 * Generates Big O analysis and refactoring suggestions on student code.
 */
export async function runCodeCritiqueAgent(code, challengeId = 'sandbox', userKeys = {}, logCallback = () => {}, skillMap = {}) {
  logCallback(`Code Critique Agent: Reviewing code complexity and optimizations...`);
  
  const systemInstruction = `You are an elite senior code reviewer. Your task is to critique the user's code, checking for complexity, readability, bugs, and suggesting optimizations.
You must return a JSON object with the following structure:
{
  "critiques": [
    {
      "title": "A short, descriptive title (e.g., 'Big O Complexity Analysis' or 'Use array helper methods')",
      "description": "Thorough, constructive review of their code logic, explaining the time/space complexity or suggestion."
    }
  ]
}

Rules:
1. Identify exactly 3 critiques or optimizations.
2. The first critique MUST be a 'Big O Complexity Analysis' analyzing the time and space complexity of their function.
3. Be constructive, professional, and clear.
4. **Adaptive Explanation Depth**: You are aware of the user's skill level profile: ${JSON.stringify(skillMap)}.
   - If the user's skill score in a concept relevant to the active critique is low (e.g., < 0.4), prioritize a plain-language summary first, using clear and simple analogies, before detailing the formal Big-O or design terminology.
   - If the user's skill score is high (e.g., >= 0.7), lead directly with formal, concise computer science terminology and Big-O notation, skipping high-level explanations.
5. Output MUST be valid JSON conforming strictly to the structure above. No markdown formatting.`;

  const prompt = `Challenge: ${challengeId}\nUser Code:\n\`\`\`javascript\n${code}\n\`\`\`\n\nGenerate the 3 reviews/critiques now.`;

  logCallback('Code Critique Agent: Submitting code for review...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.3,
    jsonMode: true,
    userKeys
  });

  try {
    logCallback('Code Critique Agent: Processing response...');
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    return data.critiques;
  } catch (error) {
    console.error("Failed to parse Code Critique Agent output:", resultText);
    logCallback('Code Critique Agent Error: Parsing failed. Returning fallbacks.');
    return [
      {
        title: "Complexity Analysis",
        description: "The time complexity appears to be O(n) where n is the input size. Space complexity is O(1) as no extra memory is allocated."
      },
      {
        title: "Code Formatting",
        description: "Ensure consistent variable declarations and indentation to improve readability."
      },
      {
        title: "Clean Code",
        description: "Avoid global state and keep functions pure."
      }
    ];
  }
}

/**
 * 8. Roadmap Generator Agent
 * Scrapes job market requirements for a target career and generates a 4-step coding learning path.
 */
export async function runRoadmapGeneratorAgent(jobRole, userKeys = {}, logCallback = () => {}) {
  logCallback(`Roadmap Agent: Scraping and generating roadmap for career: ${jobRole}...`);
  
  const systemInstruction = `You are a career consultant and programming curriculum expert.
Your task is to analyze the current, real-world job market requirements for a target role, and generate a customized 4-step programming roadmap to help a student reach that career goal.
You must return a JSON object with the following structure:
{
  "jobRole": "A capitalized clean string of the job role",
  "modules": [
    {
      "id": "module_1",
      "title": "A custom tailored, highly relevant title for this career step (e.g., 'Array and Vector Summing' for AI Engineer)",
      "description": "A thorough explanation of what the user is learning here, how it connects to the target job role, and how it maps to the core challenge.",
      "challengeId": "sum",
      "language": "javascript",
      "skills": ["Variables", "Arrays", "Vectors"]
    },
    {
      "id": "module_2",
      "title": "A custom tailored, relevant loops/conditionals title",
      "description": "Explain how loops, conditionals, and logical checks are used in this career (e.g., model training batches).",
      "challengeId": "fizzbuzz",
      "language": "javascript",
      "skills": ["Loops", "Conditionals", "Logic Flows"]
    },
    {
      "id": "module_3",
      "title": "A custom tailored, relevant algorithm/string title",
      "description": "Explain how string operations, cleaning, and sanitization are used in this career (e.g., NLP input normalization).",
      "challengeId": "palindrome",
      "language": "javascript",
      "skills": ["String Sanitization", "Character Matching", "Regex"]
    },
    {
      "id": "module_4",
      "title": "A custom tailored, relevant advanced specialization/sandbox title",
      "description": "Explain how this custom sandbox maps to advanced application building (e.g., prompt orchestration, LangChain agents).",
      "challengeId": "sandbox",
      "language": "javascript",
      "skills": ["API Integrations", "Custom logic", "Complex Projects"]
    }
  ]
}

Rules:
1. You MUST generate exactly 4 modules.
2. The modules MUST map exactly to the challengeId in this order: 'sum', 'fizzbuzz', 'palindrome', 'sandbox'.
3. The title, description, and list of skills for each module MUST be customized to directly relate to the requested jobRole. Use analogies and connections.
4. For the 'language' field, select the most relevant programming language for this career track (e.g., 'javascript' or 'python'). Default to 'javascript' if it's general web/app development or frontend, and 'python' for AI, machine learning, data science, or backend tracks.
5. Output MUST be valid JSON conforming strictly to the structure above. No markdown formatting.`;

  const prompt = `Target Job Role: "${jobRole}"\n\nPerform a live job market search for the skills required for "${jobRole}" and construct the customized 4-step roadmap now.`;

  logCallback('Roadmap Agent: Submitting job market search request to AI...');
  const resultText = await getAIChatCompletion({
    systemInstruction,
    prompt,
    temperature: 0.4,
    jsonMode: true,
    userKeys,
    googleSearch: true // Enable Google Search grounding
  });

  try {
    logCallback('Roadmap Agent: Processing JSON output...');
    const cleanJSON = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleanJSON);
    
    if (!data.jobRole || !data.modules || data.modules.length !== 4) {
      throw new Error('Invalid roadmap structure');
    }
    return data;
  } catch (error) {
    console.error("Failed to parse Roadmap Generator Agent output:", resultText);
    logCallback('Roadmap Agent Error: Parsing failed. Returning standard fallback roadmap.');
    
    // Fallback standard roadmap tailored to the jobRole
    return {
      jobRole: jobRole.charAt(0).toUpperCase() + jobRole.slice(1),
      modules: [
        {
          id: 'module_1',
          title: `Data Structures & Numeric Operations`,
          description: `Learn basic variable declaration, numeric manipulation, and array operations. Essential for parsing inputs in ${jobRole}.`,
          challengeId: 'sum',
          language: 'javascript',
          skills: ['Variables', 'Arrays', 'Math Operations']
        },
        {
          id: 'module_2',
          title: `Control Flows & Logical Checks`,
          description: `Master conditionals (if/else) and loop structures (for/while). Important for processing logic iterations in ${jobRole}.`,
          challengeId: 'fizzbuzz',
          language: 'javascript',
          skills: ['Loops', 'Conditionals', 'Log Processing']
        },
        {
          id: 'module_3',
          title: `String Manipulation & Algorithm Logic`,
          description: `Learn string normalization, clean-ups, and pattern matching. Crucial for text handling and standard validations in ${jobRole}.`,
          challengeId: 'palindrome',
          language: 'javascript',
          skills: ['String Cleaning', 'Regex', 'Character Checks']
        },
        {
          id: 'module_4',
          title: `Custom Specialization Sandbox`,
          description: `Use the free-code sandbox to build mock systems, orchestrate APIs, and practice custom code logic for ${jobRole}.`,
          challengeId: 'sandbox',
          language: 'javascript',
          skills: ['API Integrations', 'Custom Systems', 'Project Setup']
        }
      ]
    };
  }
}

/**
 * 9. Session Summarizer Agent
 * Condenses recent activity logs into a concise single-paragraph summary for the next session.
 */
export async function runSessionSummarizerAgent(activityLogs, userKeys = {}) {
  const systemInstruction = `You are an educational progress summary agent.
Your task is to analyze a list of user activity logs from a coding session and produce a single-paragraph summary (under 60 words) highlighting:
1. What challenges or concepts the user successfully worked on.
2. Any struggles or failures they encountered (e.g. syntax errors, failing tests, struggling with loops).
3. A friendly and direct suggestion for what they should focus on next time.

Example output:
"Completed sum.js, struggled with loop edge cases on negative inputs. Next time, focus on loop boundary conditions."

Keep the output concise, plain text, and direct. Do not include markdown headers or extra conversation.`;

  const logsString = activityLogs.map(l => l.formattedText || JSON.stringify(l)).join('\n');
  const prompt = `Here are the session activity logs:\n\n${logsString}\n\nSummarize this session now.`;

  try {
    const summary = await getAIChatCompletion({
      systemInstruction,
      prompt,
      temperature: 0.3,
      jsonMode: false,
      userKeys
    });
    return summary.trim();
  } catch (error) {
    console.error('Session summarization failed:', error);
    return 'Completed work on coding exercises. Keep practicing to build confidence!';
  }
}


