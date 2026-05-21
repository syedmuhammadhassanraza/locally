/**
 * AI Intent Parsing Service
 *
 * Handles Roman Urdu, Urdu Unicode, English, and mixed-language
 * home service requests for the LOCALLY platform (Pakistan).
 *
 * Output schema:
 *  { serviceType, urgencyScore, complexityTier, confidence, needsClarification, clarificationQuestion, explanation }
 */

const { GoogleGenAI } = require('@google/genai');

// ── Roman Urdu / Urdu Unicode keyword maps ────────────────────────────────────
const SERVICE_KEYWORDS = {
  Plumbing: [
    // English
    'plumb', 'leak', 'pipe', 'tap', 'drain', 'flush', 'toilet', 'basin', 'sewage', 'water',
    // Roman Urdu
    'nalkay', 'paani', 'nal', 'leakage', 'pipe leak', 'pani band', 'blockage', 'drain band',
    // Urdu Unicode
    'نل', 'پانی', 'پائپ', 'لیکج', 'نالی', 'ٹوٹا'
  ],
  Electrical: [
    'electr', 'wire', 'wiring', 'short', 'circuit', 'fan', 'light', 'power', 'switch', 'socket',
    'bulb', 'spark', 'fuse', 'mcb', 'generator', 'ups',
    // Roman Urdu
    'bijli', 'current', 'fan kharab', 'light nahi', 'socket', 'spark', 'khatam',
    // Urdu Unicode
    'بجلی', 'بلب', 'فیوز', 'وائرنگ', 'سرکٹ', 'کرنٹ'
  ],
  Cleaning: [
    'clean', 'wash', 'sweep', 'dust', 'mop', 'maid', 'ghar', 'safai', 'jharoo', 'scrub',
    // Roman Urdu
    'safai chahiye', 'ghar saaf', 'jhaaroo', 'bartan', 'kapray dhona',
    // Urdu Unicode
    'صفائی', 'جھاڑو', 'سفائی', 'دھونا', 'گھر صاف'
  ],
  'AC Repair': [
    'ac', 'air con', 'air condition', 'refriger', 'cool', 'fridge', 'freezer', 'heat', 'gas fill',
    'ac band', 'thanda nahi', 'gas khatam', 'cooling nahi',
    // Urdu Unicode
    'اے سی', 'ٹھنڈا', 'فریج', 'کولنگ'
  ],
  Carpentry: [
    'carpenter', 'wood', 'door', 'window', 'furniture', 'almirah', 'rack', 'shelf', 'kabat',
    // Roman Urdu
    'darwaza', 'kursi tooti', 'table toota', 'wood ka kaam',
    // Urdu Unicode
    'لکڑی', 'دروازہ', 'کھڑکی', 'فرنیچر'
  ],
  Painting: [
    'paint', 'wall', 'colour', 'color', 'plaster', 'damp', 'seep',
    // Roman Urdu
    'rang', 'painting chahiye', 'deewar', 'putty', 'whitewash',
    // Urdu Unicode
    'رنگ', 'پینٹ', 'دیوار', 'پلستر'
  ]
};

const URGENCY_BOOSTERS = {
  high: ['flood', 'spark', 'fire', 'emergency', 'urgent', 'jaldi', 'abhi', 'foran', 'ابھی',
         'تیزی', 'آگ', 'پانی بھر', 'short circuit', 'bijli ki aag'],
  medium: ['bad', 'dark', 'bnd', 'band', 'nahi chal', 'kharab', 'toota', 'خراب', 'بند'],
  low: ['routine', 'maintenance', 'check', 'dekhna', 'jab time ho', 'whenever']
};

const COMPLEXITY_KEYWORDS = {
  complex:  ['rewiring', 'complete installation', 'replace pipe', 'renovation', 'drainage system', 'overhead tank'],
  standard: ['repair', 'fix', 'change', 'replace part', 'service'],
  basic:    ['check', 'tighten', 'minor', 'small', 'light cleaning', 'dust']
};

// ── Rule-based parser ─────────────────────────────────────────────────────────
const ruleBasedParse = (input) => {
  const lower = input.toLowerCase();

  // Categories & Keywords
  const plumbingKeywords = ['plumb', 'leak', 'pipe', 'tap', 'drain', 'flush', 'toilet', 'basin', 'sewage', 'water', 'nalkay', 'paani', 'nal', 'leakage', 'pipe leak', 'pani band', 'blockage', 'drain band', 'نل', 'پانی', 'پائپ', 'لیکج', 'نالی', 'ٹوٹا'];
  const electricalKeywords = ['electr', 'wire', 'wiring', 'short', 'circuit', 'fan', 'light', 'power', 'switch', 'socket', 'bulb', 'spark', 'fuse', 'mcb', 'generator', 'ups', 'bijli', 'current', 'fan kharab', 'light nahi', 'socket', 'spark', 'khatam', 'بجلی', 'بلب', 'فیوز', 'وائرنگ', 'سرکٹ', 'کرنٹ'];
  const cleaningKeywords = ['clean', 'wash', 'sweep', 'dust', 'mop', 'maid', 'ghar', 'safai', 'jharoo', 'scrub', 'safai chahiye', 'ghar saaf', 'jhaaroo', 'bartan', 'kapray dhona', 'صفائی', 'جھاڑو', 'سفائی', 'دھونا', 'گھر صاف'];
  const acKeywords = ['ac', 'air con', 'air condition', 'refriger', 'cool', 'fridge', 'freezer', 'heat', 'gas fill', 'ac band', 'thanda nahi', 'gas khatam', 'cooling nahi', 'اے سی', 'ٹھنڈا', 'فریج', 'کولنگ'];
  const carpentryKeywords = ['carpenter', 'wood', 'door', 'window', 'furniture', 'almirah', 'rack', 'shelf', 'kabat', 'darwaza', 'kursi tooti', 'table toota', 'wood ka kaam', 'لکڑی', 'دروازہ', 'کھڑکی', 'فرنیچر'];
  const paintingKeywords = ['paint', 'wall', 'colour', 'color', 'plaster', 'damp', 'seep', 'rang', 'painting chahiye', 'deewar', 'putty', 'whitewash', 'رنگ', 'پینٹ', 'دیوار', 'پلستر'];
  const cookingKeywords = ['cook', 'khana', 'food', 'chef', 'pakana', 'pakanay', 'baking', 'roti', 'saalan', 'kitchen', 'cooking', 'کھانا', 'پکانا'];
  const handymanKeywords = ['gardener', 'mali', 'driver', 'helper', 'mazdoor', 'labor', 'shifting', 'packing', 'handyman', 'help', 'kaam'];

  let serviceType = 'General Handyman';
  let friendlyReply = '';
  let confidence = 40;
  let needsClarification = true;
  let urgencyScore = 5.0;

  // Urgency Detection
  const highUrgency = ['flood', 'spark', 'fire', 'emergency', 'urgent', 'jaldi', 'abhi', 'foran', 'ابھی', 'تیزی', 'آگ', 'پانی بھر', 'short circuit', 'bijli ki aag', 'severe', 'shadeed', 'shadiid'];
  const mediumUrgency = ['bad', 'dark', 'bnd', 'band', 'nahi chal', 'kharab', 'toota', 'خراب', 'بند'];
  const lowUrgency = ['routine', 'maintenance', 'check', 'dekhna', 'jab time ho', 'whenever', 'low', 'kam'];

  if (highUrgency.some(k => lower.includes(k))) urgencyScore = 9.0;
  else if (mediumUrgency.some(k => lower.includes(k))) urgencyScore = 7.0;
  else if (lowUrgency.some(k => lower.includes(k))) urgencyScore = 3.0;

  // Matching
  if (plumbingKeywords.some(k => lower.includes(k))) {
    serviceType = 'Plumbing';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "Ji bilkul, main aap ke liye Plumbing aur leaks ke expert plumbers arrange kar raha hoon. Neeche diye gaye verified plumbers ko check karein.";
  } else if (electricalKeywords.some(k => lower.includes(k))) {
    serviceType = 'Electrical';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "Aap ke electrical/bijli ke maslay ke liye main abhi best electricians ki list load kar raha hoon. Please in mein se kisi ko select karein.";
  } else if (cleaningKeywords.some(k => lower.includes(k))) {
    serviceType = 'Cleaning';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "Safai ke liye main abhi best cleaning experts aur maids ki details load kar raha hoon. Aap in se booking kar sakte hain.";
  } else if (acKeywords.some(k => lower.includes(k))) {
    serviceType = 'AC Repair';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "AC aur cooling system ki repair/servicing ke liye experts load ho rahe hain. Neeche se book karein.";
  } else if (carpentryKeywords.some(k => lower.includes(k))) {
    serviceType = 'Carpentry';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "Carpentry aur woodwork ke liye best carpenters dhoond liye hain. Details neeche scroll karein.";
  } else if (paintingKeywords.some(k => lower.includes(k))) {
    serviceType = 'Painting';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "Rang aur painting ke kaam ke liye best painters ki list load ho gayi hai. Check karein.";
  } else if (cookingKeywords.some(k => lower.includes(k))) {
    serviceType = 'General Handyman';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "G bilkul! Hamare paas cooking/khana banane ke liye professional handymen available hain jo kitchen aur meal prep mein madad kar sakte hain. Main unki list neeche share kar raha hoon.";
  } else if (handymanKeywords.some(k => lower.includes(k))) {
    serviceType = 'General Handyman';
    confidence = 95;
    needsClarification = false;
    friendlyReply = "Ji, is kaam ke liye main abhi best general handymen aur helpers ki details load kar raha hoon. In mein se book karein.";
  } else {
    // If no keywords matched, ask politely in a friendly Urdu/English mix
    serviceType = 'General Handyman';
    confidence = 50;
    needsClarification = true;
    friendlyReply = "Ji, aapko kis qisam ki madad ki zaroorat hai? Kya aap thodi aur tafseel bata sakte hain (maslan: plumbing, bijli, safai ya koi aur kaam)? taake main sahi banda assign karoon.";
  }

  return { serviceType, urgencyScore, complexityTier: 'standard', confidence, needsClarification, friendlyReply };
};

const parseIntent = async (userInput) => {
  const ruleBased = ruleBasedParse(userInput);

  // If Gemini key is available, refine with LLM
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const modelName of modelsToTry) {
      try {
        console.log(`[Rozgo AI] Attempting intent parsing with model: ${modelName}`);
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `You are a helpful, conversational, and smart home service assistant for the LOCALLY platform in Pakistan. 
The user may write in English, Roman Urdu, or Urdu Unicode. They might ask for services we provide (Plumbing, Electrical, Cleaning, AC Repair, Carpentry, Painting, General Handyman) or things we don't (like a cook, driver, etc).

Analyze the following user input: "${userInput}"

Determine and return a JSON object with the following fields:
1. serviceType: one of [Plumbing, Electrical, Cleaning, AC Repair, Carpentry, Painting, General Handyman]. If they ask for something unrelated (like a cook), map it to 'General Handyman' but handle the explanation gracefully.
2. urgencyScore: float 1.0-10.0 (10=severe emergency like flooding/sparks)
3. complexityTier: one of [basic, standard, complex]
4. confidence: integer 0-100 (how certain are you about this service category mapping)
5. needsClarification: boolean (true if confidence < 70, or if the request is vague, or if they asked for a service we don't explicitly offer like cooking)
6. friendlyReply: A natural, conversational response speaking directly to the user in the SAME language they used. 
   - If needsClarification is true, politely ask them to clarify or explain that we don't offer that specific service but can offer alternatives. 
   - If false, briefly and warmly confirm the service being arranged (e.g. "Got it! I'm finding the best cleaners for you right now."). Do NOT include robotic confidence percentages in the chat.
7. explanation: one sentence summary of your reasoning for the system logs

Return ONLY valid JSON matching this schema exactly, no markdown formatting blocks.`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const result = JSON.parse(text.trim());

        if (result.serviceType && result.urgencyScore !== undefined) {
          console.log(`[Rozgo AI] Intent parsed successfully using ${modelName}`);
          return {
            serviceType:          result.serviceType,
            urgencyScore:         parseFloat(result.urgencyScore),
            complexityTier:       result.complexityTier || ruleBased.complexityTier,
            confidence:           result.confidence ?? ruleBased.confidence,
            needsClarification:   result.needsClarification ?? (result.confidence < 70),
            friendlyReply:        result.friendlyReply || null,
            explanation:          result.explanation || `Parsed by Gemini AI (${modelName})`
          };
        }
      } catch (err) {
        console.warn(`[Rozgo AI] Model ${modelName} failed/quota exceeded:`, err.message);
      }
    }
  }

  console.log('[Rozgo AI] All LLM models failed or API key unavailable. Using smart rule-based parser fallback.');
  return {
    ...ruleBased,
    needsClarification:   ruleBased.confidence < 70,
    clarificationQuestion: ruleBased.confidence < 70
      ? `Could you describe the problem in a bit more detail? (e.g. which room, how severe?)`
      : null,
    explanation: 'Parsed by Smart Keyword Parser (Rule-based Fallback)'
  };
};

module.exports = { parseIntent };
