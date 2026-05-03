"""Run the b-book matching engine directly."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))

import asyncio
from src.main import main

if __name__ == "__main__":
    asyncio.run(main())
