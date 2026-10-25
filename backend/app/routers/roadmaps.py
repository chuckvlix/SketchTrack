import json
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select, func
from app.database import get_session
from app.models import (
    Roadmap, StageNode, StageResource, ProofOfWork, WorkshopBadge
)
from app.services.timeline_engine import (
    auto_shift_stages, calculate_catchup, apply_catchup_sync, seed_demo_roadmap,
    format_date, parse_date
)

router = APIRouter(prefix="/api/roadmaps", tags=["roadmaps"])

def get_workspace_id(x_workspace_id: Optional[str] = Header(None)) -> str:
    return x_workspace_id or "default-workspace"

def get_roadmap_or_404(session: Session, roadmap_id: str, workspace_id: str) -> Roadmap:
    roadmap = session.get(Roadmap, roadmap_id)
    if not roadmap or roadmap.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Ruta de estudio no encontrada")
    return roadmap

def _validate_date_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    try:
        parsed = datetime.strptime(v, "%Y-%m-%d")
        if parsed.strftime("%Y-%m-%d") != v:
            raise ValueError("La fecha debe tener el formato estricto YYYY-MM-DD.")
    except (ValueError, TypeError):
        raise ValueError("Formato de fecha inválido. Debe ser una fecha válida en formato YYYY-MM-DD.")
    return v

class CreateRoadmapRequest(BaseModel):
    title: str
    description: Optional[str] = None
    weekly_hours: int = Field(default=10, ge=1, le=168, description="Horas semanales de estudio (1-168)")
    weekend_days: List[int] = [5, 6]

class CreateStageRequest(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    duration_days: Optional[int] = 14
    estimated_hours: Optional[float] = 20.0

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: Optional[str]) -> Optional[str]:
        return _validate_date_str(v)

class UpdateStageRequest(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    duration_days: Optional[int] = None
    estimated_hours: Optional[float] = None
    status: Optional[str] = None

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: Optional[str]) -> Optional[str]:
        return _validate_date_str(v)

class AddResourceRequest(BaseModel):
    slot_type: Literal["primary", "aux_1", "aux_2"]
    title: str
    url: str
    platform: str = "course"
    estimated_hours: float = 10.0
    checkpoints: Optional[List[Dict[str, Any]]] = None

class UpdateResourceRequest(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    platform: Optional[str] = None
    estimated_hours: Optional[float] = None
    checkpoints: Optional[List[Dict[str, Any]]] = None

class UpdateProofOfWorkRequest(BaseModel):
    selected_option_index: Optional[int] = None
    evidence_url: Optional[str] = None
    acceptance_criteria: Optional[List[Dict[str, Any]]] = None

class SealProofOfWorkRequest(BaseModel):
    evidence_url: str

class CatchupSyncRequest(BaseModel):
    shift_days: int = Field(..., ge=1, le=180, description="Días de desplazamiento hacia adelante (1-180)")

@router.get("", response_model=List[Dict[str, Any]])
def list_roadmaps(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmaps = session.exec(
        select(Roadmap).where(Roadmap.workspace_id == workspace_id).order_by(Roadmap.created_at.desc())
    ).all()
    
    roadmap_ids = [r.id for r in roadmaps]
    stage_counts: Dict[str, int] = {}
    if roadmap_ids:
        counts = session.exec(
            select(StageNode.roadmap_id, func.count(StageNode.id))
            .where(StageNode.roadmap_id.in_(roadmap_ids))
            .group_by(StageNode.roadmap_id)
        ).all()
        stage_counts = {r_id: count for r_id, count in counts}

    result = []
    for r in roadmaps:
        result.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "weekly_hours": r.weekly_hours,
            "weekend_days": json.loads(r.weekend_days_json or "[5, 6]"),
            "streak_days": r.streak_days,
            "stage_count": stage_counts.get(r.id, 0),
            "created_at": r.created_at.isoformat()
        })
    return result

@router.post("/seed-demo")
def create_demo_roadmap(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = seed_demo_roadmap(session, workspace_id)
    return {"message": "Ruta demo creada exitosamente", "roadmap_id": roadmap.id}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_roadmap(
    req: CreateRoadmapRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    today = date.today()
    roadmap = Roadmap(
        workspace_id=workspace_id,
        title=req.title,
        description=req.description,
        weekly_hours=req.weekly_hours,
        weekend_days_json=json.dumps(req.weekend_days),
        last_check_in_date=format_date(today)
    )
    session.add(roadmap)
    session.flush()

    # Automatically initialize with the first stage so it does not dead-end in EmptyCanvasState
    stage_title = f"Etapa 1: Fundamentos de {req.title}"
    initial_stage = StageNode(
        roadmap_id=roadmap.id,
        position_index=0,
        title=stage_title,
        start_date=format_date(today),
        duration_days=14,
        estimated_hours=20.0,
        status="active",
        seed=101
    )
    session.add(initial_stage)
    session.flush()

    pow_obj = ProofOfWork(
        stage_id=initial_stage.id,
        selected_option_index=0,
        title=f"Proyecto Práctico: Fundamentos de {req.title}",
        description="Construye un proyecto inicial aplicando los conceptos fundamentales aprendidos.",
        difficulty_level="base",
        acceptance_criteria_json=json.dumps([
            {"id": f"cr_{initial_stage.id}_0", "text": "Estructura base del proyecto y configuración", "completed": False},
            {"id": f"cr_{initial_stage.id}_1", "text": "Implementación práctica funcional", "completed": False}
        ]),
        options_json=json.dumps([{
            "index": 0,
            "title": f"Proyecto Práctico: Fundamentos de {req.title}",
            "difficulty": "base",
            "description": "Construye un proyecto inicial aplicando los conceptos fundamentales aprendidos.",
            "criteria": [
                {"id": f"cr_{initial_stage.id}_0", "text": "Estructura base del proyecto y configuración", "completed": False},
                {"id": f"cr_{initial_stage.id}_1", "text": "Implementación práctica funcional", "completed": False}
            ]
        }])
    )
    session.add(pow_obj)
    session.commit()
    session.refresh(roadmap)
    return {"id": roadmap.id, "title": roadmap.title}

@router.get("/{roadmap_id}")
def get_roadmap_details(
    roadmap_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)

    stages = session.exec(
        select(StageNode).where(StageNode.roadmap_id == roadmap_id).order_by(StageNode.position_index)
    ).all()

    stage_ids = [s.id for s in stages]
    resources_by_stage: Dict[str, List[StageResource]] = {sid: [] for sid in stage_ids}
    pow_by_stage: Dict[str, Optional[ProofOfWork]] = {sid: None for sid in stage_ids}

    if stage_ids:
        all_resources = session.exec(
            select(StageResource).where(StageResource.stage_id.in_(stage_ids))
        ).all()
        for r in all_resources:
            resources_by_stage[r.stage_id].append(r)

        all_pows = session.exec(
            select(ProofOfWork).where(ProofOfWork.stage_id.in_(stage_ids))
        ).all()
        for pow_item in all_pows:
            pow_by_stage[pow_item.stage_id] = pow_item

    stages_data = []
    catchup_info = None

    for s in stages:
        resources = resources_by_stage.get(s.id, [])
        pow_obj = pow_by_stage.get(s.id)

        pow_data = None
        if pow_obj:
            pow_data = {
                "id": pow_obj.id,
                "selected_option_index": pow_obj.selected_option_index,
                "title": pow_obj.title,
                "description": pow_obj.description,
                "difficulty_level": pow_obj.difficulty_level,
                "acceptance_criteria": json.loads(pow_obj.acceptance_criteria_json or "[]"),
                "options": json.loads(pow_obj.options_json or "[]"),
                "evidence_url": pow_obj.evidence_url,
                "stamped_at": pow_obj.stamped_at
            }

        resources_data = []
        for r in resources:
            resources_data.append({
                "id": r.id,
                "slot_type": r.slot_type,
                "title": r.title,
                "url": r.url,
                "platform": r.platform,
                "estimated_hours": r.estimated_hours,
                "checkpoints": json.loads(r.checkpoints_json or "[]")
            })

        # Calculate catchup for the active stage
        if s.status == "active" and catchup_info is None:
            catchup_info = calculate_catchup(roadmap, s)

        stages_data.append({
            "id": s.id,
            "position_index": s.position_index,
            "title": s.title,
            "start_date": s.start_date,
            "duration_days": s.duration_days,
            "estimated_hours": s.estimated_hours,
            "status": s.status,
            "paused_days_offset": s.paused_days_offset,
            "seed": s.seed,
            "resources": resources_data,
            "proof_of_work": pow_data
        })

    return {
        "id": roadmap.id,
        "title": roadmap.title,
        "description": roadmap.description,
        "weekly_hours": roadmap.weekly_hours,
        "weekend_days": json.loads(roadmap.weekend_days_json or "[5, 6]"),
        "streak_days": roadmap.streak_days,
        "last_check_in_date": roadmap.last_check_in_date,
        "stages": stages_data,
        "catchup": catchup_info or {"needs_catchup": False, "suggested_shift_days": 0}
    }

@router.post("/{roadmap_id}/stages", status_code=status.HTTP_201_CREATED)
def create_stage(
    roadmap_id: str,
    req: Optional[CreateStageRequest] = None,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    if req is None:
        req = CreateStageRequest()

    existing_stages = session.exec(
        select(StageNode)
        .where(StageNode.roadmap_id == roadmap_id)
        .order_by(StageNode.position_index)
    ).all()

    idx = len(existing_stages)
    if existing_stages:
        last_stage = existing_stages[-1]
        last_end = parse_date(last_stage.start_date) + timedelta(days=last_stage.duration_days)
        start_date_str = req.start_date or format_date(last_end)
        stage_status = "active" if all(s.status == "completed" for s in existing_stages) else "locked"
    else:
        start_date_str = req.start_date or format_date(date.today())
        stage_status = "active"

    title = req.title or f"Etapa {idx + 1}: Continuación de {roadmap.title}"
    duration_days = max(1, req.duration_days or 14)
    estimated_hours = req.estimated_hours or 20.0

    new_stage = StageNode(
        roadmap_id=roadmap.id,
        position_index=idx,
        title=title,
        start_date=start_date_str,
        duration_days=duration_days,
        estimated_hours=estimated_hours,
        status=stage_status,
        seed=100 + idx * 77
    )
    session.add(new_stage)
    session.flush()

    pow_obj = ProofOfWork(
        stage_id=new_stage.id,
        selected_option_index=0,
        title=f"Proyecto Práctico: {title}",
        description=f"Entregable técnico para validar el aprendizaje de {title}.",
        difficulty_level="base",
        acceptance_criteria_json=json.dumps([
            {"id": f"cr_{new_stage.id}_0", "text": "Implementación práctica funcional", "completed": False},
            {"id": f"cr_{new_stage.id}_1", "text": "Código documentado y probado", "completed": False}
        ]),
        options_json=json.dumps([{
            "index": 0,
            "title": f"Proyecto Práctico: {title}",
            "difficulty": "base",
            "description": f"Entregable técnico para validar el aprendizaje de {title}.",
            "criteria": [
                {"id": f"cr_{new_stage.id}_0", "text": "Implementación práctica funcional", "completed": False},
                {"id": f"cr_{new_stage.id}_1", "text": "Código documentado y probado", "completed": False}
            ]
        }])
    )
    session.add(pow_obj)
    session.commit()
    session.refresh(new_stage)
    return {
        "message": "Etapa creada exitosamente",
        "stage_id": new_stage.id,
        "position_index": new_stage.position_index,
        "title": new_stage.title,
        "start_date": new_stage.start_date,
        "duration_days": new_stage.duration_days,
        "status": new_stage.status
    }

@router.put("/{roadmap_id}/stages/{stage_id}")
def update_stage(
    roadmap_id: str,
    stage_id: str,
    req: UpdateStageRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    date_or_duration_changed = False
    if req.title is not None:
        stage.title = req.title
    if req.start_date is not None and req.start_date != stage.start_date:
        stage.start_date = req.start_date
        date_or_duration_changed = True
    if req.duration_days is not None and req.duration_days != stage.duration_days:
        stage.duration_days = max(1, req.duration_days)
        date_or_duration_changed = True
    if req.estimated_hours is not None:
        stage.estimated_hours = req.estimated_hours
    if req.status is not None:
        stage.status = req.status

    session.add(stage)
    if date_or_duration_changed:
        auto_shift_stages(session, roadmap_id, stage.id)

    session.commit()
    session.refresh(stage)
    return {"message": "Etapa actualizada", "stage_id": stage.id}

@router.post("/{roadmap_id}/stages/{stage_id}/resources")
def add_resource_to_stage(
    roadmap_id: str,
    stage_id: str,
    req: AddResourceRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    # Hard 1+2 Rule Enforcement
    existing_resources = session.exec(
        select(StageResource).where(StageResource.stage_id == stage_id)
    ).all()

    primary_res = next((r for r in existing_resources if r.slot_type == "primary"), None)
    aux_res = [r for r in existing_resources if r.slot_type != "primary"]

    if req.slot_type == "primary":
        if primary_res is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "CAPACITY_LIMIT_EXCEEDED",
                    "message": "La etapa ya cuenta con un Curso Principal (1). Reemplázalo o agrégalo como auxiliar."
                }
            )
    elif req.slot_type in ("aux_1", "aux_2"):
        # Requesting an auxiliary slot
        if len(aux_res) >= 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "CAPACITY_LIMIT_EXCEEDED",
                    "message": "Violación de la Regla 1+2: Esta etapa ya tiene 2 recursos auxiliares asignados. Envíalo a la Icebox o encadénalo en una etapa futura."
                }
            )
        # Auto-assign slot type if slot is already occupied
        if req.slot_type == "aux_1" and any(r.slot_type == "aux_1" for r in aux_res):
            req.slot_type = "aux_2"
        elif req.slot_type == "aux_2" and any(r.slot_type == "aux_2" for r in aux_res):
            req.slot_type = "aux_1"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_SLOT_TYPE",
                "message": f"Tipo de slot no válido: '{req.slot_type}'. Debe ser 'primary', 'aux_1' o 'aux_2'."
            }
        )

    resource = StageResource(
        stage_id=stage_id,
        slot_type=req.slot_type,
        title=req.title,
        url=req.url,
        platform=req.platform,
        estimated_hours=req.estimated_hours,
        checkpoints_json=json.dumps(req.checkpoints or [])
    )
    session.add(resource)
    session.commit()
    session.refresh(resource)
    return {"message": "Recurso añadido", "resource_id": resource.id}

@router.put("/{roadmap_id}/stages/{stage_id}/resources/{resource_id}")
def update_resource(
    roadmap_id: str,
    stage_id: str,
    resource_id: str,
    req: UpdateResourceRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    resource = session.get(StageResource, resource_id)
    if not resource or resource.stage_id != stage_id:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")

    if req.title is not None:
        resource.title = req.title
    if req.url is not None:
        resource.url = req.url
    if req.platform is not None:
        resource.platform = req.platform
    if req.estimated_hours is not None:
        resource.estimated_hours = req.estimated_hours
    if req.checkpoints is not None:
        resource.checkpoints_json = json.dumps(req.checkpoints)

    session.add(resource)

    # Check-in streak tracking
    today = date.today()
    today_str = format_date(today)
    if roadmap.last_check_in_date != today_str or (roadmap.streak_days or 0) == 0:
        if roadmap.last_check_in_date and (roadmap.streak_days or 0) > 0:
            try:
                last_date = parse_date(roadmap.last_check_in_date)
                diff = (today - last_date).days
                if diff == 1:
                    roadmap.streak_days = (roadmap.streak_days or 0) + 1
                else:
                    roadmap.streak_days = 1
            except Exception:
                roadmap.streak_days = 1
        else:
            roadmap.streak_days = 1
        roadmap.last_check_in_date = today_str
        session.add(roadmap)

    session.commit()
    session.refresh(resource)
    return {"message": "Recurso actualizado", "resource_id": resource.id}

@router.delete("/{roadmap_id}/stages/{stage_id}/resources/{resource_id}")
def delete_resource(
    roadmap_id: str,
    stage_id: str,
    resource_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    resource = session.get(StageResource, resource_id)
    if not resource or resource.stage_id != stage_id:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")

    session.delete(resource)
    session.commit()
    return {"message": "Recurso eliminado y slot liberado"}

@router.put("/{roadmap_id}/stages/{stage_id}/proof-of-work")
def update_proof_of_work(
    roadmap_id: str,
    stage_id: str,
    req: UpdateProofOfWorkRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    pow_obj = session.exec(
        select(ProofOfWork).where(ProofOfWork.stage_id == stage_id)
    ).first()

    if not pow_obj:
        raise HTTPException(status_code=404, detail="Proof of Work no encontrado para esta etapa")

    if req.selected_option_index is not None and req.selected_option_index != pow_obj.selected_option_index:
        options = json.loads(pow_obj.options_json or "[]")
        if 0 <= req.selected_option_index < len(options):
            selected = options[req.selected_option_index]
            pow_obj.selected_option_index = req.selected_option_index
            pow_obj.title = selected.get("title", pow_obj.title)
            pow_obj.description = selected.get("description", pow_obj.description)
            pow_obj.difficulty_level = selected.get("difficulty", pow_obj.difficulty_level)
            raw_criteria = selected.get("criteria", [])
            normalized_criteria = []
            for i, c in enumerate(raw_criteria):
                if isinstance(c, dict):
                    normalized_criteria.append(c)
                else:
                    normalized_criteria.append({
                        "id": f"cr_{req.selected_option_index}_{i}",
                        "text": str(c),
                        "completed": False
                    })
            pow_obj.acceptance_criteria_json = json.dumps(normalized_criteria)

    if req.evidence_url is not None:
        pow_obj.evidence_url = req.evidence_url

    if req.acceptance_criteria is not None:
        pow_obj.acceptance_criteria_json = json.dumps(req.acceptance_criteria)

    session.add(pow_obj)
    session.commit()
    session.refresh(pow_obj)
    return {"message": "Proof of Work actualizado", "id": pow_obj.id}

@router.post("/{roadmap_id}/stages/{stage_id}/seal-pow")
def seal_proof_of_work(
    roadmap_id: str,
    stage_id: str,
    req: SealProofOfWorkRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Contractually completes the stage by validating that:
    1. A valid deliverable URL is supplied.
    2. 100% of the acceptance criteria are checked.
    Unlocks next stage and rubber stamps the current block with [ENTREGADO].
    """
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    pow_obj = session.exec(
        select(ProofOfWork).where(ProofOfWork.stage_id == stage_id)
    ).first()

    if not pow_obj:
        raise HTTPException(status_code=400, detail="Esta etapa no tiene Proof of Work configurado")

    if not req.evidence_url or not req.evidence_url.startswith("http"):
        raise HTTPException(status_code=400, detail="Debes ingresar una URL válida de evidencia (GitHub, Figma, Deploy en vivo).")

    criteria = json.loads(pow_obj.acceptance_criteria_json or "[]")
    if not criteria or len(criteria) == 0:
        raise HTTPException(
            status_code=400,
            detail="El Proof of Work debe contar con al menos un criterio técnico de aceptación antes de ser sellado."
        )
    if not all(isinstance(c, dict) and c.get("completed", False) for c in criteria):
        raise HTTPException(
            status_code=400,
            detail="No puedes sellar la entrega hasta marcar el 100% de los criterios técnicos de aceptación."
        )

    # Stamp the deliverable
    now_iso = datetime.now(timezone.utc).isoformat()
    pow_obj.evidence_url = req.evidence_url
    pow_obj.stamped_at = now_iso
    stage.status = "completed"

    session.add(pow_obj)
    session.add(stage)

    # Unlock the next sequential stage in the train
    next_stage = session.exec(
        select(StageNode)
        .where(StageNode.roadmap_id == roadmap_id)
        .where(StageNode.position_index == stage.position_index + 1)
    ).first()

    if next_stage:
        next_stage.status = "active"
        session.add(next_stage)

    # Award Badges
    unlocked_badges = []
    # Badge 1: Primer PoW Sellado
    b1 = session.exec(
        select(WorkshopBadge)
        .where(WorkshopBadge.workspace_id == roadmap.workspace_id)
        .where(WorkshopBadge.badge_key == "first_pow_stamped")
    ).first()
    if not b1:
        badge1 = WorkshopBadge(
            workspace_id=roadmap.workspace_id,
            badge_key="first_pow_stamped",
            title="Primer PoW Sellado",
            description="Completaste y validaste tu primer proyecto práctico entregable."
        )
        session.add(badge1)
        unlocked_badges.append(badge1.title)

    # Badge 2: Tríada 1+2 Completada (si todas las etapas de la ruta están completadas)
    all_stages = session.exec(
        select(StageNode).where(StageNode.roadmap_id == roadmap_id)
    ).all()
    if all(s.status == "completed" for s in all_stages):
        b2 = session.exec(
            select(WorkshopBadge)
            .where(WorkshopBadge.workspace_id == roadmap.workspace_id)
            .where(WorkshopBadge.badge_key == "triad_1_2_completed")
        ).first()
        if not b2:
            badge2 = WorkshopBadge(
                workspace_id=roadmap.workspace_id,
                badge_key="triad_1_2_completed",
                title="Tríada 1+2 Completada",
                description="Completaste todas las etapas de tu ruta de aprendizaje con entregables reales."
            )
            session.add(badge2)
            unlocked_badges.append(badge2.title)

    session.commit()
    return {
        "message": "Proof of Work sellado exitosamente [ENTREGADO]",
        "stamped_at": now_iso,
        "next_stage_unlocked": next_stage.id if next_stage else None,
        "unlocked_badges": unlocked_badges
    }

@router.post("/{roadmap_id}/stages/{stage_id}/catchup-sync")
def trigger_catchup_sync(
    roadmap_id: str,
    stage_id: str,
    req: CatchupSyncRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    roadmap = get_roadmap_or_404(session, roadmap_id, workspace_id)
    stage = session.get(StageNode, stage_id)
    if not stage or stage.roadmap_id != roadmap_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    stage = apply_catchup_sync(session, roadmap_id, stage_id, req.shift_days)
    return {
        "message": f"Cronograma sincronizado (+{req.shift_days} días)",
        "new_start_date": stage.start_date
    }

@router.get("/badges/list")
def list_badges(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    badges = session.exec(
        select(WorkshopBadge).where(WorkshopBadge.workspace_id == workspace_id)
    ).all()
    return badges
