"""B-Book Engine Service Entry Point."""
import asyncio
import logging
from .matching_engine import MatchingEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("b-book-engine")

try:
    from packages.common.src.instrumentation import init_sentry
    init_sentry("b-book-engine")
except Exception:
    pass


async def main():
    engine = MatchingEngine()
    try:
        await engine.start()
    except KeyboardInterrupt:
        await engine.stop()


if __name__ == "__main__":
    asyncio.run(main())
