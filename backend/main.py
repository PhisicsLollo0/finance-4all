from fastapi import FastAPI

from src.core.middleware import configure_cors
from src.routers.simulators import router

app = FastAPI(title="Finance Simulators API")

configure_cors(app)


# Support both `/simulators/*` and `/api/simulators/*` paths.
app.include_router(router)
app.include_router(router, prefix="/api")
