import hashlib
import logging
import secrets
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from ai_engine import generate_response
from config import settings
from schemas import GenerateResponseRequest, GenerateResponseResponse

logging.basicConfig(
    level=getattr(logging, (settings.log_level or "INFO").upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Identifiers are pseudonymized before they reach the logs.
_LOG_SALT = secrets.token_hex(16)


def _pseudonymize(value):
    if not value:
        return None
    digest = hashlib.sha256(f"{_LOG_SALT}:{value}".encode("utf-8")).hexdigest()
    return f"id_{digest[:12]}"


app = FastAPI(
    title="Saarthi AI Service",
    description="Python AI service for generating empathetic responses",
    version="1.0.0",
)

# CORS: an explicit allow-list with credentials disabled.
# The previous configuration combined allow_origins=["*"] with
# allow_credentials=True, which the CORS spec rejects outright — browsers ignore
# the response and credentialed cross-origin calls fail. Requests to this service
# carry no cookies, so credentials are unnecessary.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-Api-Key"],
)


def require_internal_api_key(
    x_internal_api_key: Optional[str] = Header(default=None, alias="X-Internal-Api-Key"),
) -> None:
    """Optional shared-secret gate between the backend and this service.

    Enforced only when INTERNAL_API_KEY is configured, so local development and
    the smoke tests keep working without extra setup.
    """
    expected = (settings.internal_api_key or "").strip()
    if not expected:
        return
    if not x_internal_api_key or not secrets.compare_digest(x_internal_api_key, expected):
        logger.warning("rejected_request reason=invalid_internal_api_key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API key"
        )


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Saarthi AI Service",
        "model": settings.model,
    }


@app.post(
    "/generate-response",
    response_model=GenerateResponseResponse,
    dependencies=[Depends(require_internal_api_key)],
)
def generate_response_endpoint(request: GenerateResponseRequest) -> GenerateResponseResponse:
    """
    Generate a structured AI response for a user message.

    The response is validated against GenerateResponseResponse, so the contract
    consumed by the Node backend cannot drift silently.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        return generate_response(
            user_message=request.message,
            trust_phase=request.trust_phase,
            user_id=request.user_id,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("generate_response_failed user=%s", _pseudonymize(request.user_id))
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

    logger.info("Starting Saarthi AI Service on %s:%s", settings.host, settings.port)
    logger.info("Using model: %s", settings.model)
    if not (settings.groq_api_key or "").strip():
        logger.warning("GROQ_API_KEY is not set; responses will use the fallback path")

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        # Reloading spawns a file watcher plus a reloader supervisor process, so it
        # is enabled only when DEBUG=true (development).
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
