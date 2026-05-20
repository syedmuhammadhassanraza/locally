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

  // Service type detection
  let serviceType = 'General Handyman';
  let maxMatches = 0;
  for (const [svc, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    const matches = keywords.filter(k => lower.includes(k.toLowerCase())).length;
    if (matches > maxMatches) { maxMatches = matches; serviceType = svc; }
  }

  // Urgency score
  let urgencyScore = 5.0;
  if (URGENCY_BOOSTERS.high.some(k => lower.includes(k.toLowerCase()))) urgencyScore = 9.0;
  else if (URGENCY_BOOSTERS.medium.some(k => lower.includes(k.toLowerCase()))) urgencyScore = 7.0;
  else if (URGENCY_BOOSTERS.low.some(k => lower.includes(k.toLowerCase()))) urgencyScore = 3.0;

  // Complexity tier
  let complexityTier = 'basic';
  if (COMPLEXITY_KEYWORDS.complex.some(k => lower.includes(k.toLowerCase()))) complexityTier = 'complex';
  else if (COMPLEXITY_KEYWORDS.standard.some(k => lower.includes(k.toLowerCase()))) complexityTier = 'standard';

  // Confidence: proportional to matches found
  const confidence = Math.min(100, 40 + maxMatches * 15);

  return { serviceType, urgencyScore, complexityTier, confidence };
};

// ── Main export ───────────────────────────────────────────────────────────────
const parseIntent = async (userInput) => {
  const ruleBased = ruleBasedParse(userInput);

  // If Gemini key is available, refine with LLM
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are parsing a home service request from Pakistan. The user may write in English, Roman Urdu, or Urdu Unicode.

Analyze: "${userInput}"

Determine:
1. serviceType: one of [Plumbing, Electrical, Cleaning, AC Repair, Carpentry, Painting, General Handyman]
2. urgencyScore: float 1.0-10.0 (10=severe emergency like flooding/sparks)
3. complexityTier: one of [basic, standard, complex]
4. confidence: integer 0-100 (how certain are you about this interpretation)
5. needsClarification: boolean (true if confidence < 70 or request is ambiguous)
6. clarificationQuestion: short question to ask user if needsClarification is true, else null
7. explanation: one sentence summary

Return ONLY valid JSON matching this schema exactly, no markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const result = JSON.parse(text.trim());

      if (result.serviceType && result.urgencyScore !== undefined) {
        return {
          serviceType:          result.serviceType,
          urgencyScore:         parseFloat(result.urgencyScore),
          complexityTier:       result.complexityTier || ruleBased.complexityTier,
          confidence:           result.confidence ?? ruleBased.confidence,
          needsClarification:   result.needsClarification ?? (result.confidence < 70),
          clarificationQuestion: result.clarificationQuestion || null,
          explanation:          result.explanation || 'Parsed by Gemini AI'
        };
      }
    } catch (err) {
      console.warn('Gemini API failed, using rule-based fallback:', err.message);
    }
  }

  return {
    ...ruleBased,
    needsClarification:   ruleBased.confidence < 70,
    clarificationQuestion: ruleBased.confidence < 70
      ? `Could you describe the problem in a bit more detail? (e.g. which room, how severe?)`
      : null,
    explanation: 'Parsed by Smart Keyword Parser (Rule-based)'
  };
};

module.exports = { parseIntent };
