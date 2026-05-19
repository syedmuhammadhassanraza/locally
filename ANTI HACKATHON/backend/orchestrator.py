"""
Orchestrator — LangGraph Service-Request Pipeline
==================================================
Graph topology:

         [IntentNode]
              |
    confidence_score >= 0.7?
       /              \\
    YES               NO
      |                 |
[DiscoveryNode]   [ClarificationNode]
      |
[MatchingNode]
      |
[ExecutionNode]
      |
[FollowUpNode]
      |
    END

Each node receives the shared *state* dict, enriches it, and passes it
to the next node.  Conditional routing lives on the edge leaving IntentNode.
"""

from __future__ import annotations

import json
from typing import TypedDict, Literal

from langgraph.graph import StateGraph, END


# ---------------------------------------------------------------------------
# 1.  Shared State Schema
# ---------------------------------------------------------------------------

class GraphState(TypedDict, total=False):
    """Typed dictionary that flows through every node in the graph."""

    # -- raw input ---------------------------------------------------------
    user_message: str                   # Original message from the user

    # -- IntentNode output -------------------------------------------------
    service_type: str | None            # e.g. 'plumbing', 'cleaning'
    location: str | None                # Where the service is needed
    time: str | None                    # When the service is needed
    date: str | None                    # 'today' | 'tomorrow' | specific date
    time_slot: str | None               # 'morning' | 'afternoon' | 'evening' | 'immediate'
    urgency: str | None                 # 'low' | 'medium' | 'high' | 'critical'
    language_detected: str | None       # ISO 639-1 code
    confidence_score: float             # 0.0 - 1.0
    clarification_needed: str | None    # Follow-up question if ambiguous

    # -- ClarificationNode output ------------------------------------------
    clarification_response: str | None  # Answer from the user (runtime)
    clarification_complete: bool        # True once clarified

    # -- DiscoveryNode output ----------------------------------------------
    available_providers: list[dict]     # Candidate service providers

    # -- MatchingNode output -----------------------------------------------
    matched_provider: dict | None       # Best-matching provider
    match_score: float                  # How well the match fits
    match_reasoning: str | None         # Human-readable explanation of selection

    # -- ExecutionNode output ----------------------------------------------
    booking_confirmed: bool             # Was booking successful?
    booking_reference: str | None       # Confirmation / reference code
    execution_error: str | None         # Any error during booking

    # -- FollowUpNode output -----------------------------------------------
    follow_up_sent: bool                # Was a follow-up dispatched?
    follow_up_message: str | None       # Message sent to the user


# ---------------------------------------------------------------------------
# 2.  Node Implementations
# ---------------------------------------------------------------------------

def intent_node(state: GraphState) -> GraphState:
    """
    IntentNode
    ----------
    Parses the user message and extracts structured intent.
    In production, this calls extract_intent() from intent_parser.py.
    Here we use the state values if already populated, or set defaults.
    """
    print("\n[IntentNode] Extracting intent from user message...")

    # In production: from intent_parser import extract_intent
    #                result = extract_intent(state["user_message"])
    #                state.update(result)
    #
    # For demonstration we propagate whatever was seeded into the state:
    state.setdefault("service_type", None)
    state.setdefault("location", None)
    state.setdefault("time", None)
    state.setdefault("urgency", "medium")
    state.setdefault("language_detected", "en")
    state.setdefault("confidence_score", 0.85)
    state.setdefault("clarification_needed", None)

    print(f"  service_type      : {state['service_type']}")
    print(f"  location          : {state['location']}")
    print(f"  time              : {state['time']}")
    print(f"  urgency           : {state['urgency']}")
    print(f"  language_detected : {state['language_detected']}")
    print(f"  confidence_score  : {state['confidence_score']}")
    print(f"  clarification_needed: {state['clarification_needed']}")
    return state


def clarification_node(state: GraphState) -> GraphState:
    """
    ClarificationNode  (conditional branch)
    ----------------------------------------
    Triggered when confidence_score < 0.7.
    Asks the user for more details and marks clarification as complete.
    """
    print("\n[ClarificationNode] Confidence too low — requesting clarification...")

    question = state.get("clarification_needed") or (
        "Could you please provide more details about the service you need, "
        "your location, and your preferred time?"
    )
    print(f"  Question to user: {question}")

    # In production: send question to the user via chat/SMS/API and await reply.
    # For demonstration we simulate a response:
    simulated_reply = (
        f"I need {state.get('service_type') or 'a service'} "
        f"at {state.get('location') or 'my home'} "
        f"{'by ' + state['time'] if state.get('time') else 'as soon as possible'}."
    )
    print(f"  Simulated user reply: {simulated_reply}")

    state["clarification_response"] = simulated_reply
    state["clarification_complete"] = True
    # Bump confidence now that we have more info
    state["confidence_score"] = 0.90
    return state


def discovery_node(state: GraphState) -> GraphState:
    """
    DiscoveryNode
    -------------
    Discovers available service providers that match the intent.
    Filters by specialization when possible, otherwise returns all.
    """
    print("\n[DiscoveryNode] Searching for providers...")

    ALL_PROVIDERS = [
        {"id": "p1", "name": "Ali AC Services", "distance_km": 2.1, "rating": 4.8,
         "availability": True, "price_pkr": 1500, "on_time_score": 0.92,
         "specialization": "AC repair"},
        {"id": "p2", "name": "Bilal Tech Solutions", "distance_km": 3.4, "rating": 4.2,
         "availability": True, "price_pkr": 1200, "on_time_score": 0.78,
         "specialization": "AC repair"},
        {"id": "p3", "name": "Hassan HVAC", "distance_km": 1.8, "rating": 3.9,
         "availability": False, "price_pkr": 1800, "on_time_score": 0.85,
         "specialization": "AC installation"},
        {"id": "p4", "name": "Tariq Cooling Co", "distance_km": 4.1, "rating": 4.6,
         "availability": True, "price_pkr": 2000, "on_time_score": 0.95,
         "specialization": "AC repair"},
    ]

    service = (state.get("service_type") or "").lower()
    matches = [
        p for p in ALL_PROVIDERS
        if service in p["specialization"].lower()
    ]

    state["available_providers"] = matches if matches else ALL_PROVIDERS
    print(f"  Found {len(state['available_providers'])} matching providers.")
    for p in state["available_providers"]:
        print(f"    - {p['name']} | {p['distance_km']}km | {p['rating']}* | PKR {p['price_pkr']} | avail: {p['availability']}")

    return state


def matching_node(state: GraphState) -> GraphState:
    """
    MatchingNode
    ------------
    Scores and ranks providers using 6 weighted factors:
      distance (30%), rating (30%), availability (20%),
      on-time record (10%), price (10%), plus urgency bonus.
    """
    print("\n[MatchingNode] Scoring and ranking providers...")

    providers = state.get("available_providers", [])
    if not providers:
        state["matched_provider"] = None
        state["match_score"] = 0.0
        state["match_reasoning"] = None
        print("  No providers available.")
        return state

    urgency = state.get("urgency", "medium")
    urgency_multiplier = {"low": 0.0, "medium": 0.1, "high": 0.2, "critical": 0.3}
    urgency_bonus = urgency_multiplier.get(urgency, 0.1)

    scored = []
    for p in providers:
        # Normalize distance: closer = higher score
        distance_score = 1 / (p.get("distance_km", 5) + 0.1)
        distance_score = min(distance_score, 1.0)

        rating_score       = p.get("rating", 3.0) / 5.0
        availability_score = 1.0 if p.get("availability") == True else 0.0
        on_time_score      = p.get("on_time_score", 0.7)
        price_score        = 1 - (p.get("price_pkr", 2000) / 5000)  # cheaper = better

        final_score = (
            distance_score     * 0.30 +
            rating_score       * 0.30 +
            availability_score * 0.20 +
            on_time_score      * 0.10 +
            price_score        * 0.10 +
            urgency_bonus
        )
        final_score = round(final_score, 4)

        reasoning = (
            f"{p['name']} scored {final_score:.2f} -- "
            f"distance: {p.get('distance_km')}km, "
            f"rating: {p.get('rating')}*, "
            f"available: {p.get('availability')}, "
            f"on-time: {int(on_time_score*100)}%, "
            f"price: PKR {p.get('price_pkr')}"
        )
        print(f"  {reasoning}")
        scored.append((p, final_score, reasoning))

    scored.sort(key=lambda x: x[1], reverse=True)
    best_provider, best_score, best_reasoning = scored[0]

    state["matched_provider"] = best_provider
    state["match_score"] = best_score
    state["match_reasoning"] = best_reasoning

    print(f"\n  >> Selected: {best_provider['name']} (score: {best_score})")
    return state


def execution_node(state: GraphState) -> GraphState:
    """
    ExecutionNode
    -------------
    Books / dispatches the matched provider.
    In production, calls the provider's booking API.
    """
    print("\n[ExecutionNode] Booking the matched provider...")

    provider = state.get("matched_provider")
    if not provider:
        state["booking_confirmed"] = False
        state["booking_reference"] = None
        state["execution_error"] = "No provider was matched; cannot book."
        print(f"  ERROR: {state['execution_error']}")
        return state

    # Simulate a successful booking
    import random, string
    ref = "REF-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    state["booking_confirmed"] = True
    state["booking_reference"] = ref
    state["execution_error"] = None

    print(f"  Booked : {provider['name']}")
    print(f"  Reference: {ref}")
    return state


def follow_up_node(state: GraphState) -> GraphState:
    """
    FollowUpNode
    ------------
    Sends a confirmation / follow-up message to the user.
    In production, dispatches via SMS, email, or chat API.
    """
    print("\n[FollowUpNode] Sending follow-up to user...")

    if state.get("booking_confirmed"):
        msg = (
            f"Your {state.get('service_type', 'service')} request has been confirmed! "
            f"Provider: {state['matched_provider']['name']}. "
            f"Reference: {state['booking_reference']}. "
            f"Expected: {state.get('time', 'as scheduled')}."
        )
    else:
        msg = (
            f"Sorry, we couldn't complete your booking. "
            f"Reason: {state.get('execution_error', 'Unknown error')}. "
            "Please try again or contact support."
        )

    state["follow_up_sent"] = True
    state["follow_up_message"] = msg
    print(f"  Message: {msg}")
    return state


# ---------------------------------------------------------------------------
# 3.  Conditional Router
# ---------------------------------------------------------------------------

def route_after_intent(state: GraphState) -> Literal["discovery", "clarification"]:
    """
    Edge condition leaving IntentNode.
    Routes to ClarificationNode if confidence is too low.
    """
    score = state.get("confidence_score", 1.0)
    if score < 0.7:
        print(f"\n[Router] confidence_score={score:.2f} < 0.7 → ClarificationNode")
        return "clarification"
    print(f"\n[Router] confidence_score={score:.2f} >= 0.7 → DiscoveryNode")
    return "discovery"


# ---------------------------------------------------------------------------
# 4.  Build the Graph
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    """Assemble and compile the LangGraph StateGraph."""

    builder = StateGraph(GraphState)

    # ── Register nodes ─────────────────────────────────────────────────────
    builder.add_node("IntentNode",        intent_node)
    builder.add_node("ClarificationNode", clarification_node)
    builder.add_node("DiscoveryNode",     discovery_node)
    builder.add_node("MatchingNode",      matching_node)
    builder.add_node("ExecutionNode",     execution_node)
    builder.add_node("FollowUpNode",      follow_up_node)

    # ── Entry point ────────────────────────────────────────────────────────
    builder.set_entry_point("IntentNode")

    # ── Conditional edge out of IntentNode ─────────────────────────────────
    builder.add_conditional_edges(
        "IntentNode",
        route_after_intent,
        {
            "discovery":     "DiscoveryNode",
            "clarification": "ClarificationNode",
        },
    )

    # ── After clarification, continue to discovery ──────────────────────────
    builder.add_edge("ClarificationNode", "DiscoveryNode")

    # ── Linear pipeline ────────────────────────────────────────────────────
    builder.add_edge("DiscoveryNode",  "MatchingNode")
    builder.add_edge("MatchingNode",   "ExecutionNode")
    builder.add_edge("ExecutionNode",  "FollowUpNode")
    builder.add_edge("FollowUpNode",   END)

    return builder.compile()


# ---------------------------------------------------------------------------
# 5.  Smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    if sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    graph = build_graph()

    # -- Test 1: AC repair, high confidence, critical urgency ---------------
    print("\n" + "="*65)
    print("TEST 1: AC repair, high confidence (0.92), critical urgency")
    print("="*65)
    result1 = graph.invoke({
        "user_message":    "AC kharab ho gaya hai, Gulberg Lahore mein abhi theek karwana hai",
        "service_type":    "AC repair",
        "location":        "Gulberg, Lahore",
        "time":            "abhi",
        "date":            "today",
        "time_slot":       "immediate",
        "urgency":         "critical",
        "language_detected": "ur",
        "confidence_score": 0.92,
        "clarification_needed": None,
    })
    print("\n-- Final state --")
    print(f"  Matched provider  : {result1.get('matched_provider', {}).get('name')}")
    print(f"  Match score       : {result1.get('match_score')}")
    print(f"  Match reasoning   : {result1.get('match_reasoning')}")
    print(f"  Booking confirmed : {result1.get('booking_confirmed')}")
    print(f"  Booking reference : {result1.get('booking_reference')}")
    print(f"  Follow-up message : {result1.get('follow_up_message')}")

    # -- Test 2: Low confidence -> clarification branch ---------------------
    print("\n" + "="*65)
    print("TEST 2: Vague request, low confidence (0.55) -> Clarification")
    print("="*65)
    result2 = graph.invoke({
        "user_message":    "I need something fixed",
        "service_type":    None,
        "location":        None,
        "time":            None,
        "date":            None,
        "time_slot":       None,
        "urgency":         "medium",
        "language_detected": "en",
        "confidence_score": 0.55,
        "clarification_needed": "Could you tell me what needs fixing and where?",
    })
    print("\n-- Final state --")
    print(f"  Clarification complete: {result2.get('clarification_complete')}")
    print(f"  Matched provider      : {result2.get('matched_provider', {}).get('name')}")
    print(f"  Match reasoning       : {result2.get('match_reasoning')}")
    print(f"  Booking confirmed     : {result2.get('booking_confirmed')}")
    print(f"  Booking reference     : {result2.get('booking_reference')}")
    print(f"  Follow-up message     : {result2.get('follow_up_message')}")
