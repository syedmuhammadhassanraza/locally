"""
Intent Parser Module
====================
Extracts structured intent data from user messages using Google AI Studio's Gemini API.
Returns a JSON object with service_type, location, time_raw, date, time_slot,
urgency, language_detected, confidence_score, and clarification_needed.
"""

import json
import os
import re
import sys
from datetime import date, timedelta

# Use the new google.genai package
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# System prompt that instructs Gemini to act as an intent-extraction engine
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
You are an intent-extraction engine. Your job is to analyse a user message and
return ONLY a valid JSON object (no markdown, no commentary) with the following
fields:

{
  "service_type": "<string – the type of service the user is requesting, e.g. 'plumbing', 'electrical', 'cleaning', 'medical', 'delivery', 'legal', 'tutoring', etc. Use null if unclear>",
  "location": "<string – the location mentioned by the user, or null if not provided>",
  "time_raw": "<string – the ORIGINAL time/date phrase from the user's message, preserved exactly as they wrote it, e.g. 'kal subah', 'tomorrow morning', 'abhi', 'tonight', 'next week'. Use null if not mentioned>",
  "urgency": "<string – one of 'low', 'medium', 'high', 'critical'. Infer from language cues like 'emergency', 'urgent', 'whenever you can', etc.>",
  "language_detected": "<string – the ISO 639-1 code of the language the user wrote in, e.g. 'en', 'es', 'ar', 'ur'>",
  "confidence_score": <float between 0.0 and 1.0 – how confident you are in your extraction>,
  "clarification_needed": "<string – a short follow-up question to ask the user if any critical field is missing or ambiguous, or null if everything is clear>"
}

Rules:
1. Always return raw JSON — never wrap it in ```json``` or add any extra text.
2. If a field cannot be determined, set it to null rather than guessing.
3. Adjust confidence_score downward when multiple fields are null or ambiguous.
4. The urgency field must always be one of the four allowed values.
5. For time_raw, always preserve the user's original wording — do NOT translate or normalise it.
"""


# ---------------------------------------------------------------------------
# Time-expression parser: converts relative phrases into {date, time_slot}
# ---------------------------------------------------------------------------

# Mapping tables — order matters (longer/more-specific patterns first)
_DATE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Urdu / Hindi / Roman-Urdu
    (re.compile(r'\bparson\b',          re.I), 'day_after_tomorrow'),
    (re.compile(r'\bkal\b',             re.I), 'tomorrow'),  # context: usually future
    (re.compile(r'\baaj\b',             re.I), 'today'),
    (re.compile(r'\babhi\b',            re.I), 'today'),
    # English
    (re.compile(r'\bday after tomorrow\b', re.I), 'day_after_tomorrow'),
    (re.compile(r'\btomorrow\b',        re.I), 'tomorrow'),
    (re.compile(r'\btonight\b',         re.I), 'today'),
    (re.compile(r'\btoday\b',           re.I), 'today'),
    (re.compile(r'\bright now\b',       re.I), 'today'),
    (re.compile(r'\bnow\b',            re.I), 'today'),
    (re.compile(r'\bASAP\b',           re.I), 'today'),
    (re.compile(r'\bnext week\b',      re.I), 'next_week'),
    # Arabic-script Urdu
    (re.compile(r'پرسوں'),                     'day_after_tomorrow'),
    (re.compile(r'کل'),                        'tomorrow'),
    (re.compile(r'آج'),                        'today'),
    (re.compile(r'ابھی'),                      'today'),
]

_SLOT_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Urdu / Hindi / Roman-Urdu
    (re.compile(r'\bsubah\b',           re.I), 'morning'),
    (re.compile(r'\bdopahar\b',         re.I), 'afternoon'),
    (re.compile(r'\bsham\b',            re.I), 'evening'),
    (re.compile(r'\braat\b',            re.I), 'evening'),
    (re.compile(r'\babhi\b',            re.I), 'immediate'),
    # English
    (re.compile(r'\bmorning\b',         re.I), 'morning'),
    (re.compile(r'\bafternoon\b',       re.I), 'afternoon'),
    (re.compile(r'\bevening\b',         re.I), 'evening'),
    (re.compile(r'\bnight\b',           re.I), 'evening'),
    (re.compile(r'\btonight\b',         re.I), 'evening'),
    (re.compile(r'\bright now\b',       re.I), 'immediate'),
    (re.compile(r'\bASAP\b',           re.I), 'immediate'),
    (re.compile(r'\bnow\b',            re.I), 'immediate'),
    # Arabic-script Urdu
    (re.compile(r'صبح'),                       'morning'),
    (re.compile(r'دوپہر'),                     'afternoon'),
    (re.compile(r'شام'),                       'evening'),
    (re.compile(r'رات'),                       'evening'),
    (re.compile(r'ابھی'),                      'immediate'),
]


def _resolve_date_label(label: str) -> str:
    """Turn a symbolic label ('today', 'tomorrow', ...) into an ISO date string."""
    today = date.today()
    mapping = {
        'today':              today,
        'tomorrow':           today + timedelta(days=1),
        'day_after_tomorrow': today + timedelta(days=2),
        'next_week':          today + timedelta(weeks=1),
    }
    d = mapping.get(label)
    return d.isoformat() if d else label


def parse_time_expression(time_raw: str | None) -> dict:
    """
    Convert a raw, possibly multilingual time phrase into structured fields.

    Returns
    -------
    dict  with keys:
        time_raw  – the original text (unchanged)
        date      – ISO date string or descriptive label (e.g. '2026-05-17')
        time_slot – one of 'morning', 'afternoon', 'evening', 'immediate', or None
    """
    result: dict = {
        "time_raw":  time_raw,
        "date":      None,
        "time_slot": None,
    }
    if not time_raw:
        return result

    text = time_raw.strip()

    # --- date detection ---
    for pattern, label in _DATE_PATTERNS:
        if pattern.search(text):
            result["date"] = _resolve_date_label(label)
            break

    # --- time-slot detection ---
    for pattern, slot in _SLOT_PATTERNS:
        if pattern.search(text):
            result["time_slot"] = slot
            break

    return result


def extract_intent(
    user_message: str,
    *,
    api_key: str | None = None,
    model_name: str = "gemini-2.0-flash",
) -> dict:
    """
    Send *user_message* to Google Gemini and return a structured intent dict.

    Parameters
    ----------
    user_message : str
        The raw message from the end-user.
    api_key : str | None
        Google AI Studio API key.  Falls back to the ``GEMINI_API_KEY``
        environment variable when not supplied.
    model_name : str
        Which Gemini model to use (default: ``gemini-2.0-flash``).

    Returns
    -------
    dict
        A dictionary with keys: service_type, location, time_raw, date,
        time_slot, urgency, language_detected, confidence_score,
        clarification_needed.

    Raises
    ------
    ValueError
        If no API key is available or the model returns unparseable output.
    RuntimeError
        If the API call itself fails.
    """

    # ---- Resolve API key ------------------------------------------------
    resolved_key = api_key or os.getenv("GEMINI_API_KEY")
    if not resolved_key:
        raise ValueError(
            "No API key provided. Pass it via the `api_key` parameter or set "
            "the GEMINI_API_KEY environment variable."
        )

    # ---- Configure the Client -------------------------------------------
    client = genai.Client(api_key=resolved_key)

    # ---- Call the API ----------------------------------------------------
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.0,
                response_mime_type="application/json",
            )
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini API call failed: {exc}") from exc

    # ---- Parse & validate the response -----------------------------------
    raw_text = response.text.strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Gemini returned non-JSON output:\n{raw_text}"
        ) from exc

    # Ensure every expected key is present (fill missing ones with None)
    expected_keys = [
        "service_type",
        "location",
        "time_raw",
        "urgency",
        "language_detected",
        "confidence_score",
        "clarification_needed",
    ]
    for key in expected_keys:
        result.setdefault(key, None)

    # --- Post-process: parse the raw time expression into date + time_slot ---
    time_fields = parse_time_expression(result.get("time_raw"))
    result["date"]      = time_fields["date"]
    result["time_slot"]  = time_fields["time_slot"]
    # Keep time_raw as-is (already in result from Gemini or default)

    return result


# ---------------------------------------------------------------------------
# Quick smoke-test when run directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Fix for Windows console unicode encoding issues
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')

    sample_messages = [
        "I need a plumber urgently at 42 Elm Street tomorrow morning",
        "Can someone clean my apartment next week? I'm in downtown Lahore.",
        "مجھے کل صبح اسلام آباد میں بجلی کا مسئلہ حل کرنا ہے",
        "abhi ek electrician chahiye, Gulberg Lahore",
        "I need help tonight at my house",
    ]

    for msg in sample_messages:
        print(f"\n{'='*60}")
        print(f"USER: {msg}")
        print(f"{'='*60}")
        try:
            intent = extract_intent(msg)
            print(json.dumps(intent, indent=2, ensure_ascii=False))
        except ValueError as err:
            if "No API key" in str(err):
                print(f"ERROR: {err}")
                print("\n[MOCK OUTPUT (Because no API key was provided)]:")
                # Determine raw time text from message
                if "tomorrow morning" in msg:
                    raw = "tomorrow morning"
                elif "next week" in msg:
                    raw = "next week"
                elif "abhi" in msg.lower():
                    raw = "abhi"
                elif "tonight" in msg.lower():
                    raw = "tonight"
                else:
                    raw = "kal subah"   # Urdu message

                time_fields = parse_time_expression(raw)
                mock_intent = {
                    "service_type": "plumbing" if "plumber" in msg else "cleaning" if "clean" in msg else "electrical",
                    "location": "42 Elm Street" if "Elm Street" in msg else "downtown Lahore" if "Lahore" in msg else "Gulberg Lahore" if "Gulberg" in msg else "Islamabad",
                    "time_raw": time_fields["time_raw"],
                    "date": time_fields["date"],
                    "time_slot": time_fields["time_slot"],
                    "urgency": "critical" if "urgently" in msg or "abhi" in msg.lower() else "medium",
                    "language_detected": "en" if "plumber" in msg or "clean" in msg or "tonight" in msg.lower() else "ur",
                    "confidence_score": 0.95,
                    "clarification_needed": None
                }
                print(json.dumps(mock_intent, indent=2, ensure_ascii=False))
            else:
                print(f"ERROR: {err}")
        except RuntimeError as err:
            print(f"ERROR: {err}")
