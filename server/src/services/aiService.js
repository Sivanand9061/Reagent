import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Call the AI provider (Groq or Gemini) based on available API keys.
 * Custom client-side keys override server-side environment variables.
 * 
 * @param {Object} params
 * @param {string} params.systemInstruction - Instructions for the system role
 * @param {string} params.prompt - User prompt
 * @param {number} [params.temperature=0.2] - Generation temperature
 * @param {boolean} [params.jsonMode=false] - Whether to enforce JSON response
 * @param {Object} [params.userKeys={}] - Keys provided dynamically by the frontend
 * @returns {Promise<string>} AI response text
 */
export async function getAIChatCompletion({ systemInstruction, prompt, temperature = 0.2, jsonMode = false, userKeys = {}, googleSearch = false }) {
  const groqKey = userKeys.groqKey || process.env.GROQ_API_KEY;
  const geminiKey = userKeys.geminiKey || process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    throw new Error('No API key provided. Please configure GROQ_API_KEY or GEMINI_API_KEY in the settings or server .env file.');
  }

  // Attempt to use Groq if key is available
  if (groqKey && !googleSearch) { // Skip Groq if googleSearch is explicitly requested and we want to fall back to Gemini
    try {
      const groq = new Groq({ apiKey: groqKey });
      const options = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature,
      };

      if (jsonMode) {
        options.response_format = { type: 'json_object' };
      }

      const chatCompletion = await groq.chat.completions.create(options);
      const text = chatCompletion.choices[0].message.content;
      if (!text) throw new Error('Groq returned empty response');
      return text.trim();
    } catch (error) {
      console.error('Groq call failed, attempting fallback if possible:', error);
      if (!geminiKey) {
        throw new Error(`Groq Error: ${error.message}`);
      }
    }
  }

  // Fallback or default to Gemini if key is available
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      
      // Using gemini-1.5-flash as it is fast and handles structured JSON / instructions well
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: jsonMode ? 'application/json' : 'text/plain',
          temperature,
        },
        systemInstruction,
        tools: googleSearch ? [{ googleSearch: {} }] : undefined
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text) throw new Error('Gemini returned empty response');
      return text.trim();
    } catch (error) {
      console.error('Gemini call failed:', error);
      if (groqKey) {
        // If Gemini failed but we skipped Groq earlier due to googleSearch, try Groq as fallback now without search
        console.log('Gemini failed, falling back to Groq without search...');
        try {
          const groq = new Groq({ apiKey: groqKey });
          const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            temperature,
            response_format: jsonMode ? { type: 'json_object' } : undefined
          });
          return chatCompletion.choices[0].message.content.trim();
        } catch (groqErr) {
          throw new Error(`Both Gemini and Groq calls failed. Gemini: ${error.message}. Groq: ${groqErr.message}`);
        }
      }
      throw new Error(`Gemini Error: ${error.message}`);
    }
  }

  // Fallback to Groq if only Groq key is available and search was requested
  if (groqKey) {
    try {
      const groq = new Groq({ apiKey: groqKey });
      const chatCompletion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      });
      return chatCompletion.choices[0].message.content.trim();
    } catch (error) {
      throw new Error(`Groq call failed: ${error.message}`);
    }
  }

  throw new Error('No active AI provider configured.');
}
