"""
Antigravity Agent Trace & Logging System
=========================================
Comprehensive trace logs showing:
  1. Language parsing & confidence
  2. Provider ranking rationale
  3. Scheduling decisions
  4. Price logic
  5. Action execution
  6. Fallback behavior

Run:  python agent_trace.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import random
import string
from datetime import datetime, date, timedelta

# Load .env so GEMINI_API_KEY is available
from dotenv import load_dotenv
load_dotenv()

from intent_parser import extract_intent, parse_time_expression
from orchestrator import build_graph, GraphState


# ═══════════════════════════════════════════════════════════════════════════
#  TRACE LOGGER
# ═══════════════════════════════════════════════════════════════════════════

class AgentTraceLogger:
    """Collects structured trace logs from every pipeline stage."""

    def __init__(self):
        self.traces: list[dict] = []
        self.start_time = time.time()

    def log(self, node: str, category: str, detail: str, data: dict | None = None):
        entry = {
            "timestamp": round(time.time() - self.start_time, 4),
            "node": node,
            "category": category,
            "detail": detail,
            "data": data or {},
        }
        self.traces.append(entry)
        # Live print
        ts = f"[{entry['timestamp']:>7.3f}s]"
        print(f"  {ts}  [{node}]  ({category})  {detail}")
        if data:
            for k, v in data.items():
                print(f"           | {k}: {v}")

    def summary(self) -> list[dict]:
        return self.traces


# ═══════════════════════════════════════════════════════════════════════════
#  FULL AGENT TRACE RUN
# ═══════════════════════════════════════════════════════════════════════════

def run_agent_trace(user_message: str, logger: AgentTraceLogger) -> dict:
    """
    Run the full Antigravity agent pipeline on a user message, producing
    detailed trace logs at every step.
    """

    section("PHASE 1: LANGUAGE PARSING & CONFIDENCE")

    logger.log("Agent", "input", f"Received user message: \"{user_message}\"")

    # ── 1. Intent extraction via Gemini (or mock fallback) ────────────────
    intent = None
    used_fallback = False

    try:
        logger.log("IntentNode", "language_parsing", "Calling Gemini API for intent extraction...")
        intent = extract_intent(user_message)
        logger.log("IntentNode", "language_parsing", "Gemini API returned structured intent.", intent)
    except (ValueError, RuntimeError) as e:
        logger.log("IntentNode", "fallback_behavior",
                   f"Gemini API unavailable: {e}")
        logger.log("IntentNode", "fallback_behavior",
                   "Activating FALLBACK: rule-based intent extraction")
        used_fallback = True
        intent = _fallback_intent_extraction(user_message, logger)

    # ── 1b. Confidence analysis ───────────────────────────────────────────
    confidence = intent.get("confidence_score", 0.0)
    lang = intent.get("language_detected", "unknown")
    logger.log("IntentNode", "confidence",
               f"Language detected: {lang} | Confidence: {confidence:.2f}",
               {"confidence_score": confidence, "language_detected": lang})

    if confidence >= 0.85:
        logger.log("IntentNode", "confidence", "HIGH confidence -- proceeding directly to discovery")
    elif confidence >= 0.7:
        logger.log("IntentNode", "confidence", "MODERATE confidence -- proceeding but may need follow-up")
    else:
        logger.log("IntentNode", "confidence",
                   f"LOW confidence ({confidence:.2f} < 0.7) -- routing to ClarificationNode")

    # ── 2. Scheduling decisions ───────────────────────────────────────────
    section("PHASE 2: SCHEDULING DECISIONS")

    time_raw = intent.get("time_raw") or intent.get("time")
    time_fields = parse_time_expression(time_raw)
    resolved_date = time_fields["date"]
    resolved_slot = time_fields["time_slot"]

    logger.log("Scheduler", "scheduling",
               f"Raw time expression: \"{time_raw}\"",
               {"time_raw": time_raw})
    logger.log("Scheduler", "scheduling",
               f"Resolved date: {resolved_date} | Time slot: {resolved_slot}",
               {"date": resolved_date, "time_slot": resolved_slot})

    # Scheduling priority logic
    if resolved_slot == "immediate":
        logger.log("Scheduler", "scheduling",
                   "IMMEDIATE scheduling -- prioritizing available providers with shortest ETA")
    elif resolved_slot == "morning":
        logger.log("Scheduler", "scheduling",
                   "MORNING slot requested -- filtering providers with morning availability")
    elif resolved_slot == "evening":
        logger.log("Scheduler", "scheduling",
                   "EVENING slot requested -- checking provider evening shift availability")
    else:
        logger.log("Scheduler", "scheduling",
                   "FLEXIBLE scheduling -- using default availability window")

    # ── 3. Provider discovery & ranking ───────────────────────────────────
    section("PHASE 3: PROVIDER RANKING RATIONALE")

    # Build pipeline state
    pipeline_state: GraphState = {
        "user_message": user_message,
        "service_type": intent.get("service_type"),
        "location": intent.get("location"),
        "time": time_raw,
        "date": resolved_date,
        "time_slot": resolved_slot,
        "urgency": intent.get("urgency", "medium"),
        "language_detected": lang,
        "confidence_score": confidence,
        "clarification_needed": intent.get("clarification_needed"),
    }

    # Run the LangGraph pipeline
    graph = build_graph()
    result = graph.invoke(pipeline_state)

    # Log provider ranking details
    providers = result.get("available_providers", [])
    logger.log("DiscoveryNode", "provider_ranking",
               f"Discovered {len(providers)} providers matching \"{intent.get('service_type')}\"")

    for p in providers:
        logger.log("DiscoveryNode", "provider_ranking",
                   f"  {p['name']}: {p.get('distance_km')}km, "
                   f"{p.get('rating')}*, PKR {p.get('price_pkr')}, "
                   f"avail={p.get('availability')}, on-time={int(p.get('on_time_score',0)*100)}%")

    # ── 4. Price logic ────────────────────────────────────────────────────
    section("PHASE 4: PRICE LOGIC")

    matched = result.get("matched_provider")
    if matched:
        base_price = matched.get("price_pkr", 0)
        urgency = intent.get("urgency", "medium")
        urgency_surcharge = {"low": 0, "medium": 0, "high": 200, "critical": 500}
        surcharge = urgency_surcharge.get(urgency, 0)

        # Time-of-day surcharge
        time_surcharge = 0
        if resolved_slot == "evening":
            time_surcharge = 150
        elif resolved_slot == "immediate":
            time_surcharge = 300

        total = base_price + surcharge + time_surcharge

        logger.log("PriceEngine", "price_logic",
                   f"Base price: PKR {base_price}",
                   {"provider": matched["name"], "base_price_pkr": base_price})
        logger.log("PriceEngine", "price_logic",
                   f"Urgency surcharge ({urgency}): +PKR {surcharge}",
                   {"urgency": urgency, "surcharge": surcharge})
        logger.log("PriceEngine", "price_logic",
                   f"Time-of-day surcharge ({resolved_slot or 'standard'}): +PKR {time_surcharge}",
                   {"time_slot": resolved_slot, "time_surcharge": time_surcharge})
        logger.log("PriceEngine", "price_logic",
                   f"TOTAL ESTIMATED PRICE: PKR {total}",
                   {"total_price_pkr": total})

        # Price comparison
        if providers:
            cheapest = min(p.get("price_pkr", 9999) for p in providers)
            most_expensive = max(p.get("price_pkr", 0) for p in providers)
            logger.log("PriceEngine", "price_logic",
                       f"Price range across providers: PKR {cheapest} - PKR {most_expensive}")
            if base_price == cheapest:
                logger.log("PriceEngine", "price_logic",
                           "Selected provider is the CHEAPEST option")
            elif base_price == most_expensive:
                logger.log("PriceEngine", "price_logic",
                           "Selected provider is the MOST EXPENSIVE -- chosen for superior rating/proximity")

    # ── 5. Match reasoning ────────────────────────────────────────────────
    section("PHASE 5: MATCH SELECTION REASONING")

    match_reasoning = result.get("match_reasoning", "N/A")
    match_score = result.get("match_score", 0.0)

    logger.log("MatchingNode", "provider_ranking",
               f"Winner: {matched['name'] if matched else 'None'} (score: {match_score})")
    logger.log("MatchingNode", "provider_ranking",
               f"Reasoning: {match_reasoning}")
    logger.log("MatchingNode", "provider_ranking",
               "Scoring formula: distance(30%) + rating(30%) + availability(20%) "
               "+ on-time(10%) + price(10%) + urgency_bonus")

    # ── 6. Action execution ───────────────────────────────────────────────
    section("PHASE 6: ACTION EXECUTION")

    if result.get("booking_confirmed"):
        logger.log("ExecutionNode", "action_execution",
                   f"BOOKING CONFIRMED for {matched['name']}",
                   {"booking_reference": result.get("booking_reference"),
                    "provider": matched["name"]})
        logger.log("ExecutionNode", "action_execution",
                   f"Reference: {result.get('booking_reference')}")
    else:
        logger.log("ExecutionNode", "action_execution",
                   f"BOOKING FAILED: {result.get('execution_error')}",
                   {"error": result.get("execution_error")})

    # Follow-up
    if result.get("follow_up_sent"):
        logger.log("FollowUpNode", "action_execution",
                   f"Follow-up message dispatched to user",
                   {"message": result.get("follow_up_message")})

    # ── 7. Fallback behavior summary ──────────────────────────────────────
    section("PHASE 7: FALLBACK BEHAVIOR SUMMARY")

    if used_fallback:
        logger.log("Agent", "fallback_behavior",
                   "Gemini API was unavailable -- used rule-based fallback parser")
        logger.log("Agent", "fallback_behavior",
                   "Fallback limitations: no NLU, keyword-only extraction, "
                   "confidence capped at 0.75")
    else:
        logger.log("Agent", "fallback_behavior",
                   "No fallback triggered -- Gemini API responded normally")

    if confidence < 0.7:
        logger.log("Agent", "fallback_behavior",
                   "ClarificationNode was activated due to low confidence")
        logger.log("Agent", "fallback_behavior",
                   f"Clarification question: \"{intent.get('clarification_needed')}\"")

    if not providers:
        logger.log("Agent", "fallback_behavior",
                   "No providers found -- would escalate to manual dispatch in production")

    if not result.get("booking_confirmed"):
        logger.log("Agent", "fallback_behavior",
                   "Booking failed -- would retry or offer alternative provider in production")

    return result


# ═══════════════════════════════════════════════════════════════════════════
#  FALLBACK INTENT EXTRACTION (rule-based, no API)
# ═══════════════════════════════════════════════════════════════════════════

def _fallback_intent_extraction(msg: str, logger: AgentTraceLogger) -> dict:
    """Keyword-based fallback when Gemini is unavailable."""

    msg_lower = msg.lower()

    # Service type detection
    service_map = {
        "ac": "AC repair", "air condition": "AC repair", "cooling": "AC repair",
        "plumb": "plumbing", "pipe": "plumbing", "leak": "plumbing",
        "electric": "electrical", "wiring": "electrical", "bijli": "electrical",
        "clean": "cleaning", "safai": "cleaning",
        "paint": "painting", "rang": "painting",
    }
    service_type = None
    for keyword, svc in service_map.items():
        if keyword in msg_lower:
            service_type = svc
            logger.log("Fallback", "fallback_behavior",
                       f"Keyword match: \"{keyword}\" -> service_type=\"{svc}\"")
            break

    # Location detection
    location_keywords = [
        "gulberg", "lahore", "islamabad", "karachi", "rawalpindi",
        "dha", "johar town", "model town", "bahria", "clifton",
        "elm street", "downtown",
    ]
    location = None
    for loc in location_keywords:
        if loc in msg_lower:
            location = loc.title()
            logger.log("Fallback", "fallback_behavior",
                       f"Location keyword: \"{loc}\" -> location=\"{location}\"")
            break

    # Language detection
    urdu_markers = ["hai", "chahiye", "mein", "karwana", "kharab", "theek",
                    "kal", "abhi", "subah", "raat"]
    urdu_score = sum(1 for w in urdu_markers if w in msg_lower)
    lang = "ur" if urdu_score >= 2 else "en"
    logger.log("Fallback", "language_parsing",
               f"Urdu marker score: {urdu_score}/10 -> language=\"{lang}\"")

    # Time extraction
    time_raw = None
    for phrase in ["abhi", "kal subah", "tomorrow morning", "tonight",
                   "next week", "aaj", "right now", "ASAP"]:
        if phrase.lower() in msg_lower:
            time_raw = phrase
            break

    time_fields = parse_time_expression(time_raw)

    # Urgency
    urgency_keywords = {"urgent": "high", "emergency": "critical",
                        "abhi": "critical", "jaldi": "high",
                        "ASAP": "critical", "right now": "critical"}
    urgency = "medium"
    for kw, urg in urgency_keywords.items():
        if kw.lower() in msg_lower:
            urgency = urg
            break

    # Confidence (capped at 0.75 for fallback)
    fields_found = sum(1 for v in [service_type, location, time_raw] if v)
    confidence = min(0.25 + (fields_found * 0.20), 0.75)

    clarification = None
    if confidence < 0.7:
        missing = []
        if not service_type: missing.append("service type")
        if not location: missing.append("location")
        if not time_raw: missing.append("preferred time")
        clarification = f"Could you please specify your {', '.join(missing)}?"

    intent = {
        "service_type": service_type,
        "location": location,
        "time_raw": time_raw,
        "date": time_fields["date"],
        "time_slot": time_fields["time_slot"],
        "urgency": urgency,
        "language_detected": lang,
        "confidence_score": confidence,
        "clarification_needed": clarification,
    }

    logger.log("Fallback", "fallback_behavior",
               f"Fallback extraction complete (confidence: {confidence:.2f})", intent)
    return intent


# ═══════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def section(title: str):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN — Run all trace scenarios
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    test_scenarios = [
        {
            "name": "SCENARIO 1: Urdu AC Repair -- Urgent, Immediate",
            "message": "AC kharab ho gaya hai, Gulberg Lahore mein abhi theek karwana hai",
        },
        {
            "name": "SCENARIO 2: English Plumbing -- Tomorrow Morning",
            "message": "I need a plumber at 42 Elm Street tomorrow morning, it's urgent",
        },
        {
            "name": "SCENARIO 3: Vague Request -- Low Confidence Fallback",
            "message": "something is broken",
        },
        {
            "name": "SCENARIO 4: Roman-Urdu Mixed -- Scheduling Edge Case",
            "message": "kal subah electrician chahiye Islamabad mein, jaldi bhejo",
        },
    ]

    all_logs = []

    for scenario in test_scenarios:
        print("\n" + "#" * 70)
        print(f"# {scenario['name']}")
        print(f"# Message: \"{scenario['message']}\"")
        print("#" * 70)

        logger = AgentTraceLogger()
        result = run_agent_trace(scenario["message"], logger)
        all_logs.append({
            "scenario": scenario["name"],
            "message": scenario["message"],
            "traces": logger.summary(),
            "final_result": {
                "matched_provider": result.get("matched_provider", {}).get("name"),
                "match_score": result.get("match_score"),
                "booking_confirmed": result.get("booking_confirmed"),
                "booking_reference": result.get("booking_reference"),
            }
        })

    # ── Dump full JSON trace log ──────────────────────────────────────────
    section("FULL TRACE LOG (JSON)")
    print(json.dumps(all_logs, indent=2, ensure_ascii=False, default=str))
