import json
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session
from app.database import get_session
from app.config import settings
from app.models import Roadmap, StageNode, StageResource, ProofOfWork
from app.services.web_search import search_resources_for_topic
from app.services.ai_copilot import (
    check_ip_rate_limit, plan_roadmap_with_ai, scaffold_project_with_ai
)
from app.services.timeline_engine import format_date

router = APIRouter(prefix="/api/ai", tags=["ai"])

def get_workspace_id(x_workspace_id: Optional[str] = Header(None)) -> str:
    return x_workspace_id or "default-workspace"

class WebSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200, description="Término o tema de búsqueda")
    limit: int = Field(default=8, ge=1, le=10, description="Límite de resultados (máximo 10)")

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("La consulta de búsqueda no puede estar vacía ni contener solo espacios.")
        return clean

class CopilotRequest(BaseModel):
    mode: str = "architect"  # "architect" | "scaffolding"
    goal: Optional[str] = None
    weekly_hours: int = Field(default=10, ge=1, le=168, description="Horas semanales de estudio (1-168)")
    course_title: Optional[str] = None
    course_url: Optional[str] = None

class ApplyRoadmapStageResource(BaseModel):
    title: str
    url: str
    platform: str = "course"
    estimated_hours: float = 10.0
    checkpoints: List[str] = []

class ApplyRoadmapProofOfWorkOption(BaseModel):
    title: str
    difficulty: str = "base"
    description: str
    criteria: List[str] = []

class ApplyRoadmapStage(BaseModel):
    title: str
    duration_days: int = 14
    estimated_hours: float = 20.0
    primary_resource: ApplyRoadmapStageResource
    auxiliary_resources: List[ApplyRoadmapStageResource] = []
    proof_of_work_options: List[ApplyRoadmapProofOfWorkOption] = []

class ApplyRoadmapRequest(BaseModel):
    roadmap_title: str
    description: Optional[str] = None
    weekly_hours: int = Field(default=10, ge=1, le=168, description="Horas semanales de estudio (1-168)")
    stages: List[ApplyRoadmapStage]

def extract_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
        if ip:
            return ip
    return request.client.host if (request.client and request.client.host) else "127.0.0.1"

@router.get("/status")
def get_ai_status(request: Request):
    client_ip = extract_client_ip(request)
    rate_info = check_ip_rate_limit(client_ip, consume=False)
    # Don't increment count on status check:
    return {
        "groq_configured": bool(settings.GROQ_API_KEY),
        "groq_model": settings.GROQ_MODEL,
        "rate_limit_per_hour": rate_info["limit"],
        "rate_limit_remaining": rate_info["remaining"],
        "client_ip": client_ip
    }

@router.post("/web-search")
def search_web_resources(req: WebSearchRequest):
    """
    Exposes live web and YouTube search for both Local LM Studio/Ollama
    and BYOK clients in the frontend, returning verified URLs.
    """
    results = search_resources_for_topic(req.query, max_results=req.limit)
    return {"query": req.query, "results": results}

@router.post("/copilot")
async def run_copilot(
    req: CopilotRequest,
    request: Request
):
    client_ip = extract_client_ip(request)
    rate_check = check_ip_rate_limit(client_ip)

    if not rate_check["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Has alcanzado el límite de demostración pública ({rate_check['limit']} consultas/hora). "
                f"Puedes conectar tu LLM local (LM Studio / Ollama) o ingresar tu propia API Key (BYOK) para uso ilimitado."
            )
        )

    if req.mode == "architect":
        if not req.goal or not req.goal.strip():
            raise HTTPException(status_code=400, detail="Debes indicar un objetivo de aprendizaje.")
        search_results = search_resources_for_topic(req.goal.strip(), max_results=8)
        roadmap_plan = await plan_roadmap_with_ai(req.goal.strip(), req.weekly_hours, search_results)
        return {
            "mode": "architect",
            "search_results": search_results,
            "plan": roadmap_plan
        }
    elif req.mode == "scaffolding":
        if not req.course_title or not req.course_title.strip():
            raise HTTPException(status_code=400, detail="Debes indicar el título o temario del curso.")
        scaffold = await scaffold_project_with_ai(
            req.course_title.strip(), req.course_url or "", req.weekly_hours
        )
        return {
            "mode": "scaffolding",
            "scaffolding": scaffold
        }
    else:
        raise HTTPException(status_code=400, detail=f"Modo desconocido: {req.mode}")

@router.post("/apply-roadmap")
def apply_generated_roadmap(
    req: ApplyRoadmapRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Persists a structured 1+2 roadmap (generated either by Groq, LM Studio, or Ollama)
    into SQLite with linked stages, resources, and Proof of Work options.
    """
    today = date.today()
    roadmap = Roadmap(
        workspace_id=workspace_id,
        title=req.roadmap_title,
        description=req.description,
        weekly_hours=req.weekly_hours,
        weekend_days_json="[5, 6]",
        last_check_in_date=format_date(today)
    )
    session.add(roadmap)
    session.flush()

    current_start = today
    for idx, stage_data in enumerate(req.stages):
        stage_status = "active" if idx == 0 else "locked"
        stage = StageNode(
            roadmap_id=roadmap.id,
            position_index=idx,
            title=stage_data.title,
            start_date=format_date(current_start),
            duration_days=stage_data.duration_days,
            estimated_hours=stage_data.estimated_hours,
            status=stage_status,
            seed=100 + idx * 77
        )
        session.add(stage)
        session.flush()

        # Primary Resource
        p_res = stage_data.primary_resource
        primary_resource = StageResource(
            stage_id=stage.id,
            slot_type="primary",
            title=p_res.title,
            url=p_res.url,
            platform=p_res.platform,
            estimated_hours=p_res.estimated_hours,
            checkpoints_json=json.dumps([
                {"id": f"chk_{i}", "title": t, "completed": False}
                for i, t in enumerate(p_res.checkpoints)
            ])
        )
        session.add(primary_resource)

        # Up to 2 Auxiliary Resources (Rule 1+2 enforced)
        for a_idx, a_res in enumerate(stage_data.auxiliary_resources[:2]):
            slot = "aux_1" if a_idx == 0 else "aux_2"
            aux_resource = StageResource(
                stage_id=stage.id,
                slot_type=slot,
                title=a_res.title,
                url=a_res.url,
                platform=a_res.platform,
                estimated_hours=a_res.estimated_hours,
                checkpoints_json=json.dumps([
                    {"id": f"chk_aux_{a_idx}_{i}", "title": t, "completed": False}
                    for i, t in enumerate(a_res.checkpoints)
                ])
            )
            session.add(aux_resource)

        # Proof of Work
        pow_options = []
        for o_idx, opt in enumerate(stage_data.proof_of_work_options):
            pow_options.append({
                "index": o_idx,
                "title": opt.title,
                "difficulty": opt.difficulty,
                "description": opt.description,
                "criteria": [
                    {"id": f"cr_{o_idx}_{c_i}", "text": c_text, "completed": False}
                    for c_i, c_text in enumerate(opt.criteria)
                ]
            })

        selected_opt = pow_options[0] if pow_options else {
            "title": f"Proyecto Entregable: {stage.title}",
            "difficulty": "challenge",
            "description": "Construye un proyecto práctico y funcional aplicando lo aprendido.",
            "criteria": [{"id": "cr_0_0", "text": "Código modular y documentado", "completed": False}]
        }

        pow_obj = ProofOfWork(
            stage_id=stage.id,
            selected_option_index=0,
            title=selected_opt["title"],
            description=selected_opt["description"],
            difficulty_level=selected_opt["difficulty"],
            acceptance_criteria_json=json.dumps(selected_opt.get("criteria", [])),
            options_json=json.dumps(pow_options)
        )
        session.add(pow_obj)

        current_start += timedelta(days=stage_data.duration_days)

    session.commit()
    session.refresh(roadmap)
    return {"message": "Ruta creada e inicializada", "roadmap_id": roadmap.id}
