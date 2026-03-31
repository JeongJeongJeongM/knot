"""EXODIA v3.0 — CLI entry point.

Usage:
    python -m exodia                  → start API server on port 8000
    python -m exodia --port 9000      → custom port
    python -m exodia --host 0.0.0.0   → bind to all interfaces
"""

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="EXODIA v3.0 Engine API Server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(
        "exodia.api.routes:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
