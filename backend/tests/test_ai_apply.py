def test_apply_roadmap_creates_entities(client):
    headers = {"X-Workspace-Id": "ai-test-ws"}
    payload = {
        "roadmap_title": "Ruta de Aprendizaje Rust",
        "description": "Aprender Rust para sistemas",
        "weekly_hours": 10,
        "stages": [
            {
                "title": "Etapa 1: Sintaxis y Borrow Checker",
                "duration_days": 14,
                "estimated_hours": 20.0,
                "primary_resource": {
                    "title": "El Libro de Rust (Oficial)",
                    "url": "https://doc.rust-lang.org/book/",
                    "platform": "docs",
                    "estimated_hours": 12.0,
                    "checkpoints": ["Ownership", "Borrowing y Lifetimes"]
                },
                "auxiliary_resources": [
                    {
                        "title": "Rustlings: Ejercicios Prácticos",
                        "url": "https://github.com/rust-lang/rustlings",
                        "platform": "course",
                        "estimated_hours": 8.0,
                        "checkpoints": ["Variables y Funciones"]
                    }
                ],
                "proof_of_work_options": [
                    {
                        "title": "CLI de Búsqueda de Archivos (Mini-Grep)",
                        "difficulty": "challenge",
                        "description": "Herramienta de línea de comandos en Rust.",
                        "criteria": ["Lectura de argumentos", "Gestión de errores con Result"]
                    }
                ]
            }
        ]
    }

    res = client.post("/api/ai/apply-roadmap", headers=headers, json=payload)
    assert res.status_code == 200
    roadmap_id = res.json()["roadmap_id"]

    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert details["title"] == "Ruta de Aprendizaje Rust"
    assert len(details["stages"]) == 1
    stage = details["stages"][0]
    assert stage["status"] == "active"
    assert len(stage["resources"]) == 2
    assert stage["proof_of_work"]["title"] == "CLI de Búsqueda de Archivos (Mini-Grep)"
