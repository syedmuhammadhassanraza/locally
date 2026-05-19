const { GoogleGenAI } = require('@google/genai');

const parseIntent = async (userInput) => {
  const lowercaseInput = userInput.toLowerCase();
  
  // Rule-based parsing for immediate smart fallback
  let serviceType = 'General Handyman';
  let urgencyScore = 5.0;
  
  if (lowercaseInput.includes('plumb') || lowercaseInput.includes('leak') || lowercaseInput.includes('pipe') || lowercaseInput.includes('water')) {
    serviceType = 'Plumbing';
    urgencyScore = lowercaseInput.includes('urg') || lowercaseInput.includes('bad') || lowercaseInput.includes('flood') ? 9.0 : 7.0;
  } else if (lowercaseInput.includes('electr') || lowercaseInput.includes('wire') || lowercaseInput.includes('short') || lowercaseInput.includes('fan') || lowercaseInput.includes('light') || lowercaseInput.includes('power')) {
    serviceType = 'Electrical';
    urgencyScore = lowercaseInput.includes('spark') || lowercaseInput.includes('fire') || lowercaseInput.includes('dark') ? 9.5 : 6.5;
  } else if (lowercaseInput.includes('clean') || lowercaseInput.includes('wash') || lowercaseInput.includes('sweep') || lowercaseInput.includes('dust') || lowercaseInput.includes('maid')) {
    serviceType = 'Cleaning';
    urgencyScore = 4.0;
  } else if (lowercaseInput.includes('ac') || lowercaseInput.includes('air con') || lowercaseInput.includes('refriger') || lowercaseInput.includes('cool') || lowercaseInput.includes('fridge')) {
    serviceType = 'AC Repair';
    urgencyScore = lowercaseInput.includes('hot') || lowercaseInput.includes('heat') ? 7.5 : 5.5;
  }

  // If Gemini API Key is available, try to refine using GenAI
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analyze this user request for local home services in Pakistan: "${userInput}".
Extract the service category (e.g. Plumbing, Electrical, Cleaning, AC Repair, General Handyman) and rate the urgency of the problem on a scale of 1.0 to 10.0 (where 10.0 is a severe emergency like flooding/sparks and 1.0 is routine maintenance).
Return strictly a valid JSON object in this format:
{
  "serviceType": "Category Name",
  "urgencyScore": 8.5,
  "explanation": "Brief explanation of intent"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || response.candidates[0].content.parts[0].text;
      const result = JSON.parse(responseText.trim());
      
      if (result.serviceType && result.urgencyScore) {
        return {
          serviceType: result.serviceType,
          urgencyScore: parseFloat(result.urgencyScore),
          explanation: result.explanation || 'Processed by Gemini AI'
        };
      }
    } catch (error) {
      console.warn('Gemini API call failed, falling back to rule-based parser:', error.message);
    }
  }

  return {
    serviceType,
    urgencyScore,
    explanation: 'Processed by Smart Keyword Parser (Fallback)'
  };
};

module.exports = { parseIntent };
