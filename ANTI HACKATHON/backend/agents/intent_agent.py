import os
import json
import re
import sys
from datetime import date, timedelta
from google import genai
from google.genai import types

SYSTEM_PROMPT = """\
You are an advanced multilingual intent-extraction agent for a local services marketplace.
Analyze the user's input message and return a structured JSON response extracting key intent metadata.

The message could be in English, Urdu (Arabic script), or Roman Urdu (Urdu written in English alphabets).

Your extracted JSON MUST strictly adhere to the following schema:
{
  "service_type": "<string or null - e.g., 'AC repair', 'AC installation', 'plumbing', 'electrical', 'cleaning', 'painting'>",
  "location": "<string or null - e.g., 'G-13', 'Gulberg', 'DHA Phase 5', 'F-10', etc. If not explicitly specified, set to null>",
  "urgency": "<string - one of 'low', 'medium', 'high', 'critical'. Infer based on urgency signals like 'urgent', 'immediately', 'emergency', 'abhi', 'jaldi'>",
  "preferred_time": "<string or null - the original time/scheduling phrase mentioned, e.g., 'tomorrow morning', 'abhi', 'kal subah', 'tonight', 'next week'>",
  "budget_sensitive": <boolean - true if the user mentions budget constraints, wanting cheap rates, discount, or is asking for price/sasta, otherwise false>,
  "language_detected": "<string - e.g., 'English', 'Urdu', 'Roman Urdu'>",
  "confidence": <float between 0.0 and 1.0 - confidence score of extraction>
}

Rules:
1. Return ONLY the raw JSON object. Do not include markdown code block syntax (like ```json) or any explanation.
2. Under "budget_sensitive", flag true if the user uses words like "cheap", "sasta", "budget", "low price", "discount", "kam rate".
3. Under "language_detected", identify "English", "Urdu", or "Roman Urdu".
4. Adjust confidence downward if key details are missing or highly ambiguous.
"""

def extract_intent(user_message: str, api_key: str | None = None) -> dict:
    """
    Sends the user message to Gemini and returns structured intent.
    Falls back to a keyword-based rule system if the API key is not configured or fails.
    """
    resolved_key = api_key or os.getenv("GEMINI_API_KEY")
    
    if not resolved_key:
        # Trigger Fallback Immediately if no API key is available
        return get_fallback_intent(user_message, "No API key provided")

    try:
        client = genai.Client(api_key=resolved_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.0,
                response_mime_type="application/json",
            )
        )
        
        raw_text = response.text.strip()
        result = json.loads(raw_text)
        
        # Ensure all keys exist
        expected_keys = ["service_type", "location", "urgency", "preferred_time", "budget_sensitive", "language_detected", "confidence"]
        for key in expected_keys:
            result.setdefault(key, None)
            
        return result
        
    except Exception as exc:
        return get_fallback_intent(user_message, str(exc))

def get_fallback_intent(user_message: str, error_reason: str) -> dict:
    """
    Keyword-based fallback intent extraction.
    Ensures gracefully continuing offline/mock operations.
    """
    msg_lower = user_message.lower()
    
    # Service Types
    service_type = None
    if any(k in msg_lower for k in ["ac ", "cooling", "inverter", "split"]):
        service_type = "AC repair"
    elif any(k in msg_lower for k in ["plumb", "leak", "pipe", "tap"]):
        service_type = "plumbing"
    elif any(k in msg_lower for k in ["electric", "wiring", "short", "bijli", "switch"]):
        service_type = "electrical"
    elif any(k in msg_lower for k in ["clean", "safai", "carpet", "sofa"]):
        service_type = "cleaning"
    elif any(k in msg_lower for k in ["paint", "rang", "decor"]):
        service_type = "painting"

    # Location
    location = None
    locations = ["g-13", "g-11", "f-10", "f-7", "i-8", "gulberg", "johar town", "model town", "clifton", "dha"]
    for loc in locations:
        if loc in msg_lower:
            location = loc.upper()
            break

    # Urgency
    urgency = "medium"
    if any(k in msg_lower for k in ["urgent", "emergency", "immediately", "abhi", "jaldi"]):
        urgency = "high"
        if "emergency" in msg_lower or "abhi" in msg_lower:
            urgency = "critical"

    # Preferred Time
    preferred_time = None
    time_phrases = ["tomorrow morning", "kal subah", "tonight", "next week", "aaj dopahar", "abhi"]
    for phrase in time_phrases:
        if phrase in msg_lower:
            preferred_time = phrase
            break

    # Budget Sensitivity
    budget_sensitive = False
    if any(k in msg_lower for k in ["cheap", "sasta", "discount", "budget", "low price", "kam rate"]):
        budget_sensitive = True

    # Language Detection
    language = "English"
    urdu_indicators = ["hai", "chahiye", "krdo", "karwana", "safai", "theek", "kharab", "sasta", "jaldi"]
    if re.search(r'[\u0600-\u06FF]', user_message):
        language = "Urdu"
    elif sum(1 for w in urdu_indicators if w in msg_lower) >= 2:
        language = "Roman Urdu"

    fields_found = sum(1 for v in [service_type, location, preferred_time] if v)
    confidence = round(0.4 + (fields_found * 0.15), 2)

    return {
        "service_type": service_type,
        "location": location,
        "urgency": urgency,
        "preferred_time": preferred_time,
        "budget_sensitive": budget_sensitive,
        "language_detected": language,
        "confidence": min(confidence, 0.75),
        "fallback_active": True,
        "fallback_reason": error_reason
    }

if __name__ == "__main__":
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
        
    test_msgs = [
        "AC kharab ho gaya hai, G-13 Islamabad mein abhi sasta technicians chahiye",
        "Need urgent plumbing repair tomorrow morning at Johar Town Lahore",
        "safai karwani hai next week DHA Phase 5"
    ]
    
    for msg in test_msgs:
        print(f"\nMessage: {msg}")
        print(json.dumps(extract_intent(msg), indent=2, ensure_ascii=False))
