import pytest
from datetime import date, timedelta
from app.models import Roadmap, StageNode, StageResource, ProofOfWork
from app.services.timeline_engine import calculate_catchup, format_date

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_seed_demo_roadmap(client):
    headers = {"X-Workspace-Id": "test-ws"}
    res = client.post("/api/roadmaps/seed-demo", headers=headers)
    assert res.status_code == 200
    roadmap_id = res.json()["roadmap_id"]

    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers)
    assert details.status_code == 200
    data = details.json()
    assert len(data["stages"]) == 3
    assert data["stages"][0]["status"] == "active"
    assert data["stages"][1]["status"] == "locked"
    assert data["stages"][2]["status"] == "locked"
    # Stage 1 has 1 primary + 2 aux
    res_list = data["stages"][0]["resources"]
    assert len(res_list) == 3
    assert any(r["slot_type"] == "primary" for r in res_list)
    assert any(r["slot_type"] == "aux_1" for r in res_list)
    assert any(r["slot_type"] == "aux_2" for r in res_list)

def test_enforce_1_plus_2_capacity_rule(client):
    headers = {"X-Workspace-Id": "test-ws"}
    # Seed roadmap
    seed_res = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = seed_res.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage1_id = details["stages"][0]["id"]

    # Attempt to add a 2nd primary resource -> Should fail with 422 CAPACITY_LIMIT_EXCEEDED
    err_primary = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage1_id}/resources",
        headers=headers,
        json={
            "slot_type": "primary",
            "title": "Curso Extra Prohibido",
            "url": "https://youtube.com/watch?v=123",
            "platform": "youtube",
            "estimated_hours": 10.0
        }
    )
    assert err_primary.status_code == 422
    assert err_primary.json()["detail"]["code"] == "CAPACITY_LIMIT_EXCEEDED"

    # Attempt to add a 3rd auxiliary resource -> Should fail with 422 CAPACITY_LIMIT_EXCEEDED
    err_aux = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage1_id}/resources",
        headers=headers,
        json={
            "slot_type": "aux_1",
            "title": "Tercer Recurso Auxiliar Prohibido",
            "url": "https://youtube.com/watch?v=456",
            "platform": "youtube",
            "estimated_hours": 4.0
        }
    )
    assert err_aux.status_code == 422
    assert err_aux.json()["detail"]["code"] == "CAPACITY_LIMIT_EXCEEDED"

def test_magnetic_train_auto_shift(client):
    headers = {"X-Workspace-Id": "test-ws"}
    seed_res = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = seed_res.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()

    stage1 = details["stages"][0]
    stage2 = details["stages"][1]
    stage2_initial_start = stage2["start_date"]

    # Stretch stage 1 by increasing duration_days by 10 days
    new_duration = stage1["duration_days"] + 10
    update_res = client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage1['id']}",
        headers=headers,
        json={"duration_days": new_duration}
    )
    assert update_res.status_code == 200

    # Fetch updated details
    updated_details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    new_stage2_start = updated_details["stages"][1]["start_date"]

    # Verify stage 2 shifted forward
    assert new_stage2_start > stage2_initial_start

def test_proof_of_work_contractual_sealing(client):
    headers = {"X-Workspace-Id": "test-ws"}
    seed_res = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = seed_res.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage1 = details["stages"][0]
    stage2 = details["stages"][1]

    # Trying to seal without completed criteria must fail (400)
    fail_seal = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage1['id']}/seal-pow",
        headers=headers,
        json={"evidence_url": "https://github.com/myuser/myproject"}
    )
    assert fail_seal.status_code == 400

    # Mark all criteria as completed
    pow_data = stage1["proof_of_work"]
    updated_criteria = [
        {"id": c["id"], "text": c["text"], "completed": True}
        for c in pow_data["acceptance_criteria"]
    ]
    client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage1['id']}/proof-of-work",
        headers=headers,
        json={"acceptance_criteria": updated_criteria}
    )

    # Now seal with valid evidence URL
    seal_res = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage1['id']}/seal-pow",
        headers=headers,
        json={"evidence_url": "https://github.com/myuser/myproject-completed"}
    )
    assert seal_res.status_code == 200
    assert seal_res.json()["next_stage_unlocked"] == stage2["id"]

    # Verify stage 1 is completed and stage 2 is active
    refreshed = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert refreshed["stages"][0]["status"] == "completed"
    assert refreshed["stages"][1]["status"] == "active"

def test_icebox_lifecycle(client):
    headers = {"X-Workspace-Id": "test-ws"}
    add_res = client.post(
        "/api/icebox",
        headers=headers,
        json={"url": "https://github.com/fastapi/fastapi", "title": "Repo FastAPI"}
    )
    assert add_res.status_code == 201
    item_id = add_res.json()["id"]

    # List icebox
    items = client.get("/api/icebox", headers=headers).json()
    assert len(items) == 1
    assert items[0]["title"] == "Repo FastAPI"

    # Delete icebox item
    del_res = client.delete(f"/api/icebox/{item_id}", headers=headers)
    assert del_res.status_code == 200
    assert len(client.get("/api/icebox", headers=headers).json()) == 0

def test_web_search_endpoint(client):
    res = client.post("/api/ai/web-search", json={"query": "fastapi tutorial", "limit": 4})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    # Check that URLs are valid http(s)
    for r in data["results"]:
        assert r["url"].startswith("http")
