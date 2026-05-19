"""
Antigravity Backend Server
==========================
FastAPI server exposing REST endpoints for the React Native frontend.
Connects intent_parser, orchestrator, and review_processor.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from intent_parser import extract_intent, parse_time_expression
from orchestrator import build_graph
from review_processor import process_review

app = FastAPI(
    title="Antigravity API",
    description="AI-powered service marketplace backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    user_id: str | None = None

class ChatResponse(BaseModel):
    intent: dict
    pipeline_result: dict

class ReviewRequest(BaseModel):
    provider_id: str
    rating: float
    review_text: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "antigravity"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """
    Main agentic chat endpoint.
    1. Extracts intent from user message via Gemini
    2. Runs the LangGraph orchestrator pipeline
    3. Returns structured result
    """
    try:
        # Step 1: Extract intent
        intent = extract_intent(req.message)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=500, detail=f"Intent extraction failed: {e}")

    # Step 2: Run orchestrator pipeline
    graph = build_graph()
    pipeline_input = {
        "user_message": req.message,
        **intent,
    }
    try:
        pipeline_result = graph.invoke(pipeline_input)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {e}")

    return ChatResponse(intent=intent, pipeline_result=pipeline_result)


@app.post("/api/parse-time")
async def parse_time_endpoint(time_raw: str):
    """Parse a raw time expression into structured date + time_slot."""
    return parse_time_expression(time_raw)


@app.post("/api/review")
async def review_endpoint(req: ReviewRequest):
    """Process a provider review with anomaly detection."""
    # In production, replace with real DB
    from unittest.mock import MagicMock
    mock_db = MagicMock()
    mock_db.get_provider_history.return_value = {
        "positive_reviews": 85,
        "total_reviews": 100,
    }
    mock_db.update_rating.return_value = True

    result = process_review(req.provider_id, req.rating, req.review_text, mock_db)
    return result


@app.get("/api/agent-logs")
async def get_agent_logs():
    """Return trace logs for the demo-logs screen."""
    return {
        "logs": [
            {"node": "IntentNode", "status": "complete", "detail": "Extracted intent with 0.92 confidence"},
            {"node": "DiscoveryNode", "status": "complete", "detail": "Found 3 providers"},
            {"node": "MatchingNode", "status": "complete", "detail": "Matched QuickFix Pro (score: 1.16)"},
            {"node": "ExecutionNode", "status": "complete", "detail": "Booking confirmed REF-XYZ123"},
            {"node": "FollowUpNode", "status": "complete", "detail": "Confirmation sent to user"},
        ]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
