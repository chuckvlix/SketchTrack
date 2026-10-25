from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event
from app.config import settings

from sqlalchemy.engine import Engine

connect_args = {"check_same_thread": False, "timeout": 30}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if dbapi_connection.__class__.__module__.startswith("sqlite"):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout=5000;")
            cursor.close()
        except Exception:
            pass

def init_db():
    from app import models  # noqa: F401
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
