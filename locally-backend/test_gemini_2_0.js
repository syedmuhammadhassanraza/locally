module.paths.push('c:\\Users\\Computer\\OneDrive\\Documents\\ANTI HACKATHON\\locally-backend\\node_modules');

const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:\\Users\\Computer\\OneDrive\\Documents\\ANTI HACKATHON\\locally-backend\\.env' });

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function test() {
  try {
    console.log('Testing gemini-2.0-flash...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Hello, respond with a short sentence.'
    });
    console.log('SUCCESS gemini-2.0-flash:', response.text);
  } catch (err) {
    console.error('FAILED gemini-2.0-flash:', err.message);
  }
}

test();
