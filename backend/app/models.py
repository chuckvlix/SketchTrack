import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)

def generate_uuid() -> str:
    return str(uuid.uuid4())

class RoadmapBase(SQLModel):
    workspace_id: str = Field(default="default-workspace", index=True)
    title: str
    description: Optional[str] = None
    weekly_hours: int = Field(default=10)
    weekend_days_json: str = Field(default="[5, 6]")  # 5=Sat, 6=Sun in Python weekday()
    streak_days: int = Field(default=0)
    last_check_in_date: Optional[str] = None  # YYYY-MM-DD

class Roadmap(RoadmapBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    stages: List["StageNode"] = Relationship(
        back_populates="roadmap",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "StageNode.position_index"}
    )

class StageNodeBase(SQLModel):
    roadmap_id: str = Field(foreign_key="roadmap.id", index=True)
    position_index: int = Field(default=0)
    title: str
    start_date: str  # YYYY-MM-DD
    duration_days: int = Field(default=14)
    estimated_hours: float = Field(default=20.0)
    status: str = Field(default="locked")  # locked, active, completed
    paused_days_offset: int = Field(default=0)
    seed: int = Field(default=42)

class StageNode(StageNodeBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now)

    roadmap: Optional[Roadmap] = Relationship(back_populates="stages")
    resources: List["StageResource"] = Relationship(
        back_populates="stage",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    proof_of_work: Optional["ProofOfWork"] = Relationship(
        back_populates="stage",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False}
    )

class StageResourceBase(SQLModel):
    stage_id: str = Field(foreign_key="stagenode.id", index=True)
    slot_type: str  # "primary", "aux_1", "aux_2"
    title: str
    url: str
    platform: str = Field(default="course")  # youtube, docs, course, book, article
    estimated_hours: float = Field(default=10.0)
    checkpoints_json: str = Field(default="[]")

class StageResource(StageResourceBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now)

    stage: Optional[StageNode] = Relationship(back_populates="resources")

class ProofOfWorkBase(SQLModel):
    stage_id: str = Field(foreign_key="stagenode.id", index=True, unique=True)
    selected_option_index: int = Field(default=0)
    title: str
    description: str
    difficulty_level: str = Field(default="base")  # base, challenge, portfolio
    acceptance_criteria_json: str = Field(default="[]")  # list of {id, text, completed}
    options_json: str = Field(default="[]")  # 3 proposals
    evidence_url: Optional[str] = None
    stamped_at: Optional[str] = None  # ISO timestamp when sealed

class ProofOfWork(ProofOfWorkBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now)

    stage: Optional[StageNode] = Relationship(back_populates="proof_of_work")

class IceboxItem(SQLModel, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    workspace_id: str = Field(default="default-workspace", index=True)
    title: str
    url: str
    platform: str = Field(default="article")
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=get_utc_now)

class WorkshopBadge(SQLModel, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    workspace_id: str = Field(default="default-workspace", index=True)
    badge_key: str = Field(index=True)  # first_pow_stamped, triad_1_2_completed, unstoppable_catchup
    title: str
    description: str
    unlocked_at: datetime = Field(default_factory=get_utc_now)
