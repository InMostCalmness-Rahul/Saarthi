import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ai_engine import generate_response
from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Saarthi AI Service",
    description="Python AI service for generating empathetic responses",
    version="1.0.0",
)

# Add CORS middleware to allow requests from frontend/backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response schemas
class GenerateResponseRequest(BaseModel):
    message: str
    trust_phase: str = "listening"
    user_id: str = None


class GenerateResponseResponse(BaseModel):
    success: bool
    data: dict


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Saarthi AI Service",
        "model": settings.model,
    }


@app.post("/generate-response", response_model=GenerateResponseResponse)
def generate_response_endpoint(request: GenerateResponseRequest):
    """
    Generate a structured AI response based on user message and trust phase.

    Request body:
    {
        "message": "I'm feeling anxious about my work",
        "trust_phase": "listening",
        "user_id": "user_123"
    }

    Response:
    {
        "success": true,
        "data": {
            "emotional_validation": "...",
            "reconnection_nudge": "...",
            "tiny_action": "...",
            "followup_question": "...",
            "risk_flags": [],
            "content": "..."
        }
    }
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        response = generate_response(
            user_message=request.message,
            trust_phase=request.trust_phase,
            user_id=request.user_id,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_response endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/")
def root():
    """Root endpoint with API documentation."""
    return {
        "message": "Saarthi AI Service",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "POST /generate-response": "Generate AI response",
            "GET /health": "Health check",
        },
    }


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting Saarthi AI Service on {settings.host}:{settings.port}")
    logger.info(f"Using model: {settings.model}")

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info",
    )
