from typing import List, Optional, Dict, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import IceboxItem, StageNode, StageResource, Roadmap
from app.services.web_search import scrape_url_metadata

router = APIRouter(prefix="/api/icebox", tags=["icebox"])

def get_workspace_id(x_workspace_id: Optional[str] = Header(None)) -> str:
    return x_workspace_id or "default-workspace"

class QuickCaptureRequest(BaseModel):
    url: str
    title: Optional[str] = None
    notes: Optional[str] = None

class PromoteItemRequest(BaseModel):
    stage_id: str
    slot_type: Literal["primary", "aux_1", "aux_2"] = "aux_1"

@router.get("", response_model=List[IceboxItem])
def list_icebox_items(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    items = session.exec(
        select(IceboxItem)
        .where(IceboxItem.workspace_id == workspace_id)
        .order_by(IceboxItem.created_at.desc())
    ).all()
    return items

@router.post("", status_code=status.HTTP_201_CREATED)
async def add_icebox_item(
    req: QuickCaptureRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    # Auto-scrape metadata if title is not provided
    title = req.title
    platform = "article"

    if req.url.startswith("http"):
        metadata = await scrape_url_metadata(req.url)
        if not title:
            title = metadata.get("title")
        platform = metadata.get("platform", "article")

    if not title:
        title = req.url

    item = IceboxItem(
        workspace_id=workspace_id,
        title=title,
        url=req.url,
        platform=platform,
        notes=req.notes
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_icebox_item(
    item_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    item = session.get(IceboxItem, item_id)
    if not item or item.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Elemento no encontrado en la Icebox")

    session.delete(item)
    session.commit()
    return {"message": "Elemento eliminado de la Icebox"}

@router.post("/{item_id}/promote")
def promote_icebox_item(
    item_id: str,
    req: PromoteItemRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    item = session.get(IceboxItem, item_id)
    if not item or item.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Elemento no encontrado en la Icebox")

    stage = session.get(StageNode, req.stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    roadmap = session.get(Roadmap, stage.roadmap_id)
    if not roadmap or roadmap.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    # Enforce 1+2 Rule
    existing_resources = session.exec(
        select(StageResource).where(StageResource.stage_id == req.stage_id)
    ).all()

    primary_res = next((r for r in existing_resources if r.slot_type == "primary"), None)
    aux_res = [r for r in existing_resources if r.slot_type != "primary"]

    if req.slot_type == "primary":
        if primary_res is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "CAPACITY_LIMIT_EXCEEDED",
                    "message": "La etapa ya cuenta con un Curso Principal (1)."
                }
            )
    elif req.slot_type in ("aux_1", "aux_2"):
        if len(aux_res) >= 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "CAPACITY_LIMIT_EXCEEDED",
                    "message": "Violación de la Regla 1+2: Esta etapa ya tiene 2 recursos auxiliares asignados."
                }
            )
        if req.slot_type == "aux_1" and any(r.slot_type == "aux_1" for r in aux_res):
            req.slot_type = "aux_2"
        elif req.slot_type == "aux_2" and any(r.slot_type == "aux_2" for r in aux_res):
            req.slot_type = "aux_1"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_SLOT_TYPE", "message": f"Tipo de slot no válido: '{req.slot_type}'"}
        )

    new_res = StageResource(
        stage_id=req.stage_id,
        slot_type=req.slot_type,
        title=item.title,
        url=item.url,
        platform=item.platform,
        estimated_hours=5.0,
        checkpoints_json="[]"
    )
    session.add(new_res)
    session.delete(item)
    session.commit()
    return {"message": "Recurso movido desde la Icebox al timeline", "resource_id": new_res.id}
