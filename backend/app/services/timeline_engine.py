import json
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select
from app.models import (
    Roadmap, StageNode, StageResource, ProofOfWork, WorkshopBadge
)

DENSITY_VIDEO_FACTOR = 2.25
DENSITY_DOCS_FACTOR = 1.5

def parse_date(d_str: str) -> date:
    try:
        return datetime.strptime(d_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return date.today()

def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")

def calculate_duration_days(total_content_hours: float, weekly_hours: int, has_video: bool = True) -> int:
    factor = DENSITY_VIDEO_FACTOR if has_video else DENSITY_DOCS_FACTOR
    real_study_hours = total_content_hours * factor
    weekly = max(1, int(weekly_hours)) if (weekly_hours and weekly_hours > 0) else 1
    weeks = max(1, int((real_study_hours + weekly - 1) // weekly))
    return weeks * 7

def auto_shift_stages(session: Session, roadmap_id: str, changed_stage_id: str):
    """
    Ensures that when a stage's start_date or duration_days changes,
    all subsequent stages shift like a magnetic train without illegal overlaps.
    """
    stages = session.exec(
        select(StageNode)
        .where(StageNode.roadmap_id == roadmap_id)
        .order_by(StageNode.position_index)
    ).all()

    if not stages:
        return

    found_pivot = False
    for i in range(len(stages) - 1):
        curr_stage = stages[i]
        next_stage = stages[i + 1]

        if curr_stage.id == changed_stage_id:
            found_pivot = True

        curr_start = parse_date(curr_stage.start_date)
        curr_end = curr_start + timedelta(days=curr_stage.duration_days)
        next_start = parse_date(next_stage.start_date)

        # If current stage pushed into or beyond next stage's start date,
        # or if we are cascading downstream from the pivot:
        if found_pivot or next_start < curr_end:
            shift_days = (curr_end - next_start).days
            if shift_days > 0:
                next_stage.start_date = format_date(curr_end)
                session.add(next_stage)

def calculate_catchup(roadmap: Roadmap, active_stage: StageNode, today: Optional[date] = None) -> Dict[str, Any]:
    """
    Calculates catch-up need by comparing expected study progress against today,
    skipping configured weekend buffer days.
    """
    if today is None:
        today = date.today()

    weekend_days = json.loads(roadmap.weekend_days_json or "[5, 6]")
    stage_start = parse_date(active_stage.start_date)

    if today <= stage_start:
        return {
            "needs_catchup": False,
            "days_behind": 0,
            "business_days_missed": 0,
            "suggested_shift_days": 0
        }

    # Count business/active days between last check-in (or stage start) and today
    last_activity = parse_date(roadmap.last_check_in_date) if roadmap.last_check_in_date else stage_start
    if last_activity < stage_start:
        last_activity = stage_start

    curr = last_activity + timedelta(days=1)
    business_days_missed = 0
    total_calendar_days = 0

    while curr <= today:
        total_calendar_days += 1
        if curr.weekday() not in weekend_days:
            business_days_missed += 1
        curr += timedelta(days=1)

    needs_catchup = business_days_missed >= 2
    suggested_shift_days = min(180, max(0, total_calendar_days)) if needs_catchup else 0

    return {
        "needs_catchup": needs_catchup,
        "days_behind": total_calendar_days,
        "business_days_missed": business_days_missed,
        "suggested_shift_days": suggested_shift_days
    }

def apply_catchup_sync(session: Session, roadmap_id: str, stage_id: str, shift_days: int) -> StageNode:
    """
    Applies the catch-up shift to the active stage and shifts subsequent stages.
    Also unlocks the 'unstoppable_catchup' badge.
    """
    if type(shift_days) is not int or shift_days < 1 or shift_days > 180:
        raise ValueError("shift_days debe ser un entero entre 1 y 180")

    stage = session.get(StageNode, stage_id)
    if not stage:
        raise ValueError(f"Stage {stage_id} not found")

    old_start = parse_date(stage.start_date)
    new_start = old_start + timedelta(days=shift_days)
    stage.start_date = format_date(new_start)
    stage.paused_days_offset += shift_days
    session.add(stage)

    roadmap = session.get(Roadmap, roadmap_id)
    if roadmap:
        roadmap.last_check_in_date = format_date(date.today())
        session.add(roadmap)

        # Check/Award badge
        existing_badge = session.exec(
            select(WorkshopBadge)
            .where(WorkshopBadge.workspace_id == roadmap.workspace_id)
            .where(WorkshopBadge.badge_key == "unstoppable_catchup")
        ).first()

        if not existing_badge:
            badge = WorkshopBadge(
                workspace_id=roadmap.workspace_id,
                badge_key="unstoppable_catchup",
                title="Retorno Imparable tras Catch-up",
                description="Sincronizaste tu cronograma sin culpa y retomaste el ritmo de estudio."
            )
            session.add(badge)

    auto_shift_stages(session, roadmap_id, stage.id)
    session.commit()
    session.refresh(stage)
    return stage

def seed_demo_roadmap(session: Session, workspace_id: str) -> Roadmap:
    """
    Seeds the 3-stage 'Fullstack Career Path' demo roadmap with realistic
    resources, checkpoints, and Proof of Work options.
    """
    today_str = format_date(date.today())
    today_date = parse_date(today_str)

    roadmap = Roadmap(
        workspace_id=workspace_id,
        title="Ruta Profesional Fullstack (Demo)",
        description="Domina JavaScript Moderno, React con TypeScript y Backend con FastAPI creando proyectos reales.",
        weekly_hours=10,
        weekend_days_json="[5, 6]",
        streak_days=3,
        last_check_in_date=today_str
    )
    session.add(roadmap)
    session.flush()

    # Stage 1: Fundamentos Web & JavaScript Moderno (Active)
    stage1 = StageNode(
        roadmap_id=roadmap.id,
        position_index=0,
        title="Etapa 1: JavaScript Moderno & DOM Profundo",
        start_date=today_str,
        duration_days=14,
        estimated_hours=20.0,
        status="active",
        seed=101
    )
    session.add(stage1)
    session.flush()

    res1_primary = StageResource(
        stage_id=stage1.id,
        slot_type="primary",
        title="Curso Completo JavaScript Moderno ES6+ y Asincronía",
        url="https://www.youtube.com/watch?v=Q9fwkpxr3Dw",
        platform="youtube",
        estimated_hours=12.0,
        checkpoints_json=json.dumps([
            {"id": "c1", "title": "Variables, Scope y Closures", "completed": True},
            {"id": "c2", "title": "Promesas, Async/Await y Event Loop", "completed": True},
            {"id": "c3", "title": "Manipulación del DOM y Custom Events", "completed": False},
            {"id": "c4", "title": "Módulos ESM y Bundlers", "completed": False}
        ])
    )
    res1_aux1 = StageResource(
        stage_id=stage1.id,
        slot_type="aux_1",
        title="MDN Web Docs — Guía Exhaustiva de JavaScript",
        url="https://developer.mozilla.org/es/docs/Web/JavaScript",
        platform="docs",
        estimated_hours=5.0,
        checkpoints_json=json.dumps([
            {"id": "c5", "title": "Lectura: Prototipos y Herencia", "completed": True},
            {"id": "c6", "title": "Lectura: Fetch API y Streams", "completed": False}
        ])
    )
    res1_aux2 = StageResource(
        stage_id=stage1.id,
        slot_type="aux_2",
        title="Patrones de Diseño en JavaScript con Ejemplos Prácticos",
        url="https://refactoring.guru/es/design-patterns/catalog",
        platform="article",
        estimated_hours=3.0,
        checkpoints_json=json.dumps([
            {"id": "c7", "title": "Patrón Observer y Pub/Sub", "completed": False}
        ])
    )
    session.add_all([res1_primary, res1_aux1, res1_aux2])

    pow1_options = [
        {
            "index": 0,
            "title": "Calculadora de Finanzas Personales con LocalStorage",
            "difficulty": "base",
            "description": "Aplicación web vanilla JS para registrar ingresos y gastos con persistencia local y gráficos en SVG.",
            "criteria": [
                {"id": "cr1", "text": "Manipulación dinámica del DOM sin frameworks ni innerHTML inseguro", "completed": True},
                {"id": "cr2", "text": "Persistencia de transacciones en localStorage con validación de esquema", "completed": True},
                {"id": "cr3", "text": "Cálculo en tiempo real de balances y desglose por categorías", "completed": False}
            ]
        },
        {
            "index": 1,
            "title": "Tablero Kanban Interactivo con Drag & Drop Nativo",
            "difficulty": "challenge",
            "description": "Tablero de tareas con columnas, reordenamiento con HTML5 Drag and Drop API y exportación a JSON.",
            "criteria": [
                {"id": "cr4", "text": "Implementación completa de dragstart, dragover y drop con retroalimentación visual", "completed": False},
                {"id": "cr5", "text": "Historial de acciones con soporte para Undo/Redo", "completed": False},
                {"id": "cr6", "text": "Filtros por etiquetas y búsqueda instantánea con debounce", "completed": False}
            ]
        },
        {
            "index": 2,
            "title": "Mini-Framework Reactivo con Proxy & Observer",
            "difficulty": "portfolio",
            "description": "Librería ligera de reactividad que detecta mutaciones en objetos de estado y actualiza el DOM automáticamente.",
            "criteria": [
                {"id": "cr7", "text": "Uso de JavaScript Proxies para interceptar get/set de forma recursiva", "completed": False},
                {"id": "cr8", "text": "Sistema de suscripción reactiva y cálculo de dependencias tipo effect()", "completed": False},
                {"id": "cr9", "text": "Suite de tests unitarios verificando reactividad sin dependencias externas", "completed": False}
            ]
        }
    ]

    pow1 = ProofOfWork(
        stage_id=stage1.id,
        selected_option_index=0,
        title=pow1_options[0]["title"],
        description=pow1_options[0]["description"],
        difficulty_level=pow1_options[0]["difficulty"],
        acceptance_criteria_json=json.dumps(pow1_options[0]["criteria"]),
        options_json=json.dumps(pow1_options),
        evidence_url=None,
        stamped_at=None
    )
    session.add(pow1)

    # Stage 2: React, TypeScript & Arquitectura (Locked)
    stage2_start = today_date + timedelta(days=14)
    stage2 = StageNode(
        roadmap_id=roadmap.id,
        position_index=1,
        title="Etapa 2: React, TypeScript & Arquitectura Limpia",
        start_date=format_date(stage2_start),
        duration_days=21,
        estimated_hours=30.0,
        status="locked",
        seed=202
    )
    session.add(stage2)
    session.flush()

    res2_primary = StageResource(
        stage_id=stage2.id,
        slot_type="primary",
        title="Curso de React 19 y TypeScript Profesional",
        url="https://www.youtube.com/watch?v=rLoWMU4L_qE",
        platform="youtube",
        estimated_hours=18.0,
        checkpoints_json=json.dumps([
            {"id": "c8", "title": "Hooks Fundamentales y Custom Hooks", "completed": False},
            {"id": "c9", "title": "Tipado Estricto de Props, Genéricos y Eventos", "completed": False},
            {"id": "c10", "title": "Gestión de Estado Global y Context API", "completed": False}
        ])
    )
    res2_aux1 = StageResource(
        stage_id=stage2.id,
        slot_type="aux_1",
        title="Documentación Oficial de React (react.dev)",
        url="https://react.dev",
        platform="docs",
        estimated_hours=7.0,
        checkpoints_json=json.dumps([
            {"id": "c11", "title": "Escape Hatches: useRef y useEffect", "completed": False}
        ])
    )
    session.add_all([res2_primary, res2_aux1])

    pow2_options = [
        {
            "index": 0,
            "title": "Dashboard de Métricas con Gráficos y Modo Oscuro",
            "difficulty": "challenge",
            "description": "Panel de control profesional con consumo de API REST, caché y accesibilidad WCAG AA.",
            "criteria": [
                {"id": "cr10", "text": "TypeScript estricto sin uso de 'any' en todo el proyecto", "completed": False},
                {"id": "cr11", "text": "Custom hook con manejo robusto de loading, error y retry", "completed": False},
                {"id": "cr12", "text": "Puntaje Lighthouse Accessibility >= 95", "completed": False}
            ]
        }
    ]
    pow2 = ProofOfWork(
        stage_id=stage2.id,
        selected_option_index=0,
        title=pow2_options[0]["title"],
        description=pow2_options[0]["description"],
        difficulty_level=pow2_options[0]["difficulty"],
        acceptance_criteria_json=json.dumps(pow2_options[0]["criteria"]),
        options_json=json.dumps(pow2_options)
    )
    session.add(pow2)

    # Stage 3: Backend con FastAPI & SQLite (Locked)
    stage3_start = stage2_start + timedelta(days=21)
    stage3 = StageNode(
        roadmap_id=roadmap.id,
        position_index=2,
        title="Etapa 3: Backend con FastAPI & Base de Datos Relacional",
        start_date=format_date(stage3_start),
        duration_days=21,
        estimated_hours=25.0,
        status="locked",
        seed=303
    )
    session.add(stage3)
    session.flush()

    res3_primary = StageResource(
        stage_id=stage3.id,
        slot_type="primary",
        title="FastAPI y SQLModel: De Cero a APIs en Producción",
        url="https://fastapi.tiangolo.com/tutorial/",
        platform="course",
        estimated_hours=15.0,
        checkpoints_json=json.dumps([
            {"id": "c13", "title": "Rutas, Pydantic Models y Inyección de Dependencias", "completed": False},
            {"id": "c14", "title": "Relaciones SQLModel y Migraciones", "completed": False}
        ])
    )
    session.add(res3_primary)

    pow3_options = [
        {
            "index": 0,
            "title": "API REST Completa con Autenticación JWT y Tests Automatizados",
            "difficulty": "portfolio",
            "description": "Servicio backend desacoplado con testing de integración y documentación interactiva OpenAPI.",
            "criteria": [
                {"id": "cr13", "text": "Cobertura de tests con Pytest >= 80%", "completed": False},
                {"id": "cr14", "text": "Manejo estructurado de excepciones con códigos HTTP semánticos", "completed": False},
                {"id": "cr15", "text": "Docker multi-stage build optimizado", "completed": False}
            ]
        }
    ]
    pow3 = ProofOfWork(
        stage_id=stage3.id,
        selected_option_index=0,
        title=pow3_options[0]["title"],
        description=pow3_options[0]["description"],
        difficulty_level=pow3_options[0]["difficulty"],
        acceptance_criteria_json=json.dumps(pow3_options[0]["criteria"]),
        options_json=json.dumps(pow3_options)
    )
    session.add(pow3)

    session.commit()
    session.refresh(roadmap)
    return roadmap
