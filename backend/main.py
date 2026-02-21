from fastapi import FastAPI

from src.core.middleware import configure_cors
from src.routers.simulators import router as simulators_router
from src.routers.games import router as games_router

app = FastAPI(title="Finance Simulators API")

configure_cors(app)


# Support both `/simulators/*` and `/api/simulators/*` paths.
app.include_router(simulators_router)
app.include_router(simulators_router, prefix="/api")

# Games / fun endpoints
app.include_router(games_router)
app.include_router(games_router, prefix="/api")
