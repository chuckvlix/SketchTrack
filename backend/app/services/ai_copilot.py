import json
import time
import re
from typing import Dict, Any, List, Optional
import httpx
from app.config import settings
from app.services.web_search import search_resources_for_topic

# Sliding window rate limiter in memory: {ip: [timestamp1, timestamp2, ...]}
RATE_LIMIT_STORE: Dict[str, List[float]] = {}

def check_ip_rate_limit(client_ip: str, consume: bool = True) -> Dict[str, Any]:
    now = time.time()
    one_hour_ago = now - 3600

    # Purge expired timestamps across RATE_LIMIT_STORE to prevent unbounded memory growth
    stale_ips = []
    for ip, ts_list in list(RATE_LIMIT_STORE.items()):
        filtered = [ts for ts in ts_list if ts > one_hour_ago]
        if not filtered:
            stale_ips.append(ip)
        else:
            RATE_LIMIT_STORE[ip] = filtered
    for ip in stale_ips:
        RATE_LIMIT_STORE.pop(ip, None)

    valid_timestamps = list(RATE_LIMIT_STORE.get(client_ip, []))
    limit = settings.DEMO_RATE_LIMIT_PER_HOUR
    allowed = len(valid_timestamps) < limit

    if consume and allowed:
        valid_timestamps.append(now)
        RATE_LIMIT_STORE[client_ip] = valid_timestamps

    remaining = max(0, limit - len(valid_timestamps))

    return {
        "allowed": allowed,
        "limit": limit,
        "remaining": remaining,
        "reset_seconds": max(0, int(3600 - (now - valid_timestamps[0]))) if valid_timestamps else 3600
    }

def clean_json_text(text: str) -> str:
    """Extracts JSON substring from markdown code blocks or raw text."""
    text = text.strip()
    # 1. Explicit ```json ... ``` blocks
    json_blocks = re.findall(r"```json\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    for block in json_blocks:
        candidate = block.strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    # 2. Generic ``` ... ``` blocks
    generic_blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    for block in generic_blocks:
        candidate = block.strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    # 3. Find JSON object or array by balanced brackets
    for i, start_char in enumerate(text):
        if start_char in ("{", "["):
            end_char = "}" if start_char == "{" else "]"
            depth = 0
            in_string = False
            escape = False
            for j in range(i, len(text)):
                c = text[j]
                if in_string:
                    if escape:
                        escape = False
                    elif c == "\\":
                        escape = True
                    elif c == '"':
                        in_string = False
                else:
                    if c == '"':
                        in_string = True
                    elif c == start_char:
                        depth += 1
                    elif c == end_char:
                        depth -= 1
                        if depth == 0:
                            candidate = text[i : j + 1].strip()
                            try:
                                json.loads(candidate)
                                return candidate
                            except Exception:
                                break

    # 4. Fallback to standard regex match if none parsed cleanly
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text

async def call_groq_llm(system_prompt: str, user_prompt: str) -> str:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY no está configurada en el servidor.")

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Error de Groq API ({resp.status_code}): {resp.text}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]

def generate_fallback_roadmap(goal: str, weekly_hours: int, search_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Intelligent fallback when Groq API key is not configured or offline,
    hydrating realistic 1+2 stages using the real search results.
    """
    primary_res = search_results[0] if search_results else {
        "title": f"Curso Completo de {goal}",
        "url": f"https://www.youtube.com/results?search_query={goal}",
        "platform": "youtube",
        "duration": "10h"
    }
    aux1_res = search_results[1] if len(search_results) > 1 else {
        "title": f"Documentación Oficial de {goal}",
        "url": f"https://duckduckgo.com/?q={goal}+docs",
        "platform": "docs"
    }
    aux2_res = search_results[2] if len(search_results) > 2 else {
        "title": f"Patrones y Buenas Prácticas en {goal}",
        "url": f"https://refactoring.guru",
        "platform": "article"
    }

    safe_hours = max(1, int(weekly_hours)) if (weekly_hours and weekly_hours > 0) else 1
    weeks_stage1 = max(2, int((20 * 2.25) // safe_hours))
    weeks_stage2 = max(3, int((25 * 2.25) // safe_hours))

    return {
        "roadmap_title": f"Ruta de Aprendizaje: {goal}",
        "description": f"Plan estructurado bajo la Regla 1+2 para dominar {goal} con {safe_hours}h/semana.",
        "weekly_hours": safe_hours,
        "stages": [
            {
                "title": f"Etapa 1: Fundamentos y Dominio Central de {goal}",
                "duration_days": weeks_stage1 * 7,
                "estimated_hours": 20.0,
                "primary_resource": {
                    "title": primary_res["title"],
                    "url": primary_res["url"],
                    "platform": primary_res["platform"],
                    "estimated_hours": 12.0,
                    "checkpoints": [
                        "Configuración del entorno y primeros conceptos",
                        "Sintaxis central, estructuras de datos y funciones",
                        "Control de flujo y asincronía básica",
                        "Ejercicios prácticos guiados"
                    ]
                },
                "auxiliary_resources": [
                    {
                        "title": aux1_res["title"],
                        "url": aux1_res["url"],
                        "platform": aux1_res["platform"],
                        "estimated_hours": 5.0,
                        "checkpoints": ["Lectura de especificaciones y casos de uso"]
                    },
                    {
                        "title": aux2_res["title"],
                        "url": aux2_res["url"],
                        "platform": aux2_res["platform"],
                        "estimated_hours": 3.0,
                        "checkpoints": ["Revisión de estándares de código y arquitectura"]
                    }
                ],
                "proof_of_work_options": [
                    {
                        "title": f"Aplicación Base: CRUD Interactivo de {goal}",
                        "difficulty": "base",
                        "description": f"Construye un sistema funcional para gestionar datos aplicando los fundamentos de {goal}.",
                        "criteria": [
                            "Estructura modular de archivos sin acoplamiento",
                            "Validación de datos de entrada y manejo de errores",
                            "README técnico con instrucciones de ejecución"
                        ]
                    },
                    {
                        "title": f"Aplicación Reto: Dashboard con Integración de API",
                        "difficulty": "challenge",
                        "description": f"Desarrolla un panel interactivo con persistencia y filtros avanzados.",
                        "criteria": [
                            "Consumo asíncrono y caché de datos",
                            "Manejo robusto de estados de carga y error",
                            "Testing unitario de la lógica de negocio principal"
                        ]
                    },
                    {
                        "title": f"Proyecto Portafolio: Herramienta de Producción para {goal}",
                        "difficulty": "portfolio",
                        "description": f"Proyecto completo listo para desplegar y añadir al portafolio profesional.",
                        "criteria": [
                            "Arquitectura hexagonal o limpia con separación de responsabilidades",
                            "Suite de tests automatizados con cobertura >= 80%",
                            "Despliegue en vivo accesible con CI/CD configurado"
                        ]
                    }
                ]
            },
            {
                "title": f"Etapa 2: Aplicación Avanzada y Arquitectura en {goal}",
                "duration_days": weeks_stage2 * 7,
                "estimated_hours": 25.0,
                "primary_resource": {
                    "title": f"Técnicas Avanzadas y Optimización en {goal}",
                    "url": primary_res["url"],
                    "platform": primary_res["platform"],
                    "estimated_hours": 15.0,
                    "checkpoints": [
                        "Patrones de arquitectura avanzados",
                        "Perfilado de rendimiento y optimización",
                        "Seguridad y casos de borde"
                    ]
                },
                "auxiliary_resources": [
                    {
                        "title": aux1_res["title"],
                        "url": aux1_res["url"],
                        "platform": aux1_res["platform"],
                        "estimated_hours": 10.0,
                        "checkpoints": ["Casos de estudio en producción"]
                    }
                ],
                "proof_of_work_options": [
                    {
                        "title": f"Sistema Distribuido / Portafolio Avanzado de {goal}",
                        "difficulty": "portfolio",
                        "description": f"Solución técnica robusta de alto impacto para reclutadores.",
                        "criteria": [
                            "Manejo de concurrencia y persistencia eficiente",
                            "Documentación técnica de arquitectura con diagramas",
                            "Métricas de rendimiento verificables"
                        ]
                    }
                ]
            }
        ]
    }

async def plan_roadmap_with_ai(goal: str, weekly_hours: int, search_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Executes Route Architect mode: synthesizes user goal + real search results into a structured 1+2 roadmap.
    """
    safe_hours = max(1, int(weekly_hours)) if (weekly_hours and weekly_hours > 0) else 1
    if not settings.GROQ_API_KEY:
        return generate_fallback_roadmap(goal, safe_hours, search_results)

    system_prompt = (
        "Eres el Arquitecto Curricular de SketchTrack, una plataforma de estudio autodidacta anti-tutorial hell.\n"
        "Tu objetivo es crear una ruta de estudio realista encadenada por etapas secuenciales.\n"
        "REGLAS OBLIGATORIAS:\n"
        "1. Aplica la REGLA 1+2 en cada etapa: Exactamente 1 Curso Principal y como MÁXIMO 2 Recursos Auxiliares.\n"
        "2. URLs VERIFICADAS: Usa ÚNICAMENTE las URLs provistas en la lista de recursos encontrados. NO inventes URLs ni dominios 404.\n"
        "3. Duración realista: Considera que 1 hora de video equivale a 2.25 horas de estudio real con práctica. Calcula semanas según las horas semanales del usuario.\n"
        "4. En cada etapa debes proponer 3 proyectos de Proof of Work (Nivel Base, Nivel Reto, Nivel Portafolio) con 3 a 5 criterios técnicos de aceptación cada uno.\n"
        "5. Devuelve EXCLUSIVAMENTE un JSON válido con las claves: roadmap_title, description, weekly_hours, stages (array de etapas con title, duration_days, estimated_hours, primary_resource {title, url, platform, estimated_hours, checkpoints []}, auxiliary_resources [{title, url, platform, estimated_hours, checkpoints []}], proof_of_work_options [{title, difficulty, description, criteria []}])."
    )

    resources_context = json.dumps(search_results, ensure_ascii=False, indent=2)
    user_prompt = (
        f"Objetivo de aprendizaje del usuario: {goal}\n"
        f"Disponibilidad horaria: {safe_hours} horas por semana.\n"
        f"Recursos reales encontrados en internet y YouTube:\n{resources_context}\n\n"
        "Genera la ruta de estudio en formato JSON estructurado respetando la regla 1+2."
    )

    try:
        raw_json = await call_groq_llm(system_prompt, user_prompt)
        parsed = json.loads(clean_json_text(raw_json))
        return parsed
    except Exception as e:
        # Graceful fallback to deterministic generator using the search results
        return generate_fallback_roadmap(goal, safe_hours, search_results)

async def scaffold_project_with_ai(course_title: str, course_url: str, weekly_hours: int) -> Dict[str, Any]:
    """
    Executes Project Scaffolding mode: generates 3 Proof of Work options for a given course.
    """
    fallback_options = [
        {
            "title": f"Proyecto Práctico Base para {course_title}",
            "difficulty": "base",
            "description": f"Aplicación focalizada en asimilar los conceptos troncales de {course_title}.",
            "criteria": [
                "Estructura de carpetas limpia y desacoplada",
                "Tratamiento adecuado de errores de usuario",
                "Documentación mínima de instalación y uso"
            ]
        },
        {
            "title": f"Proyecto Reto: Solución Completa con Persistencia",
            "difficulty": "challenge",
            "description": f"Sistema con arquitectura orientada a componentes o capas para {course_title}.",
            "criteria": [
                "Persistencia y validación estricta de esquemas",
                "Pruebas automatizadas de los flujos críticos",
                "Accesibilidad y diseño responsivo verificado"
            ]
        },
        {
            "title": f"Proyecto Portafolio: Aplicación Profesional Desplegada",
            "difficulty": "portfolio",
            "description": f"Entregable de nivel senior listo para revisión técnica de reclutadores.",
            "criteria": [
                "Patrones de diseño limpios aplicados",
                "Pipeline CI/CD y despliegue público en vivo",
                "Métricas de rendimiento y monitoreo documentadas"
            ]
        }
    ]

    if not settings.GROQ_API_KEY:
        return {"course_title": course_title, "options": fallback_options}

    system_prompt = (
        "Eres el Especialista en Proof of Work de SketchTrack.\n"
        "Dado un curso principal, diseña 3 opciones de proyectos prácticos (Nivel Base, Nivel Reto, Nivel Portafolio) "
        "con 3 a 5 criterios técnicos de aceptación rigurosos y medibles cada uno.\n"
        "Devuelve EXCLUSIVAMENTE un JSON válido con la clave 'options' (array con title, difficulty ['base'|'challenge'|'portfolio'], description, criteria [strings])."
    )
    safe_hours = max(1, int(weekly_hours)) if (weekly_hours and weekly_hours > 0) else 1
    user_prompt = f"Curso principal: {course_title} ({course_url})\nDisponibilidad del estudiante: {safe_hours}h/semana."

    try:
        raw_json = await call_groq_llm(system_prompt, user_prompt)
        parsed = json.loads(clean_json_text(raw_json))
        return parsed
    except Exception:
        return {"course_title": course_title, "options": fallback_options}
