import pytest
from datetime import date, timedelta
from sqlmodel import select
from app.models import Roadmap, StageNode, StageResource, ProofOfWork
from app.services.ai_copilot import generate_fallback_roadmap, plan_roadmap_with_ai, scaffold_project_with_ai
from app.services.timeline_engine import apply_catchup_sync, format_date

@pytest.mark.asyncio
async def test_vuln_13_ai_copilot_zero_division_guard():
    # 1. generate_fallback_roadmap with weekly_hours=0 and negative values
    res_zero = generate_fallback_roadmap("Python", 0, [])
    assert res_zero["weekly_hours"] >= 1
    assert "0h/semana" not in res_zero["description"]
    assert res_zero["stages"][0]["duration_days"] > 0

    res_neg = generate_fallback_roadmap("Python", -5, [])
    assert res_neg["weekly_hours"] >= 1

    # 2. plan_roadmap_with_ai fallback
    plan_zero = await plan_roadmap_with_ai("Python", 0, [])
    assert plan_zero["weekly_hours"] >= 1

    # 3. scaffold_project_with_ai fallback
    scaffold_zero = await scaffold_project_with_ai("React", "https://example.com", 0)
    assert len(scaffold_zero["options"]) == 3

def test_vuln_14_study_streak_consecutive_and_reset(client, db_session):
    headers = {"X-Workspace-Id": "ws-streak-test"}

    # Scenario 0: Fresh roadmap created today (streak_days=0, last_check_in_date=today)
    fresh_rm = client.post("/api/roadmaps", headers=headers, json={"title": "Fresh Roadmap"}).json()
    fresh_id = fresh_rm["id"]
    fresh_details = client.get(f"/api/roadmaps/{fresh_id}", headers=headers).json()
    fresh_stage_id = fresh_details["stages"][0]["id"]

    # Add a resource to fresh roadmap
    res_add = client.post(
        f"/api/roadmaps/{fresh_id}/stages/{fresh_stage_id}/resources",
        headers=headers,
        json={"slot_type": "primary", "title": "Initial Course", "url": "https://example.com/c"}
    )
    fresh_res_id = res_add.json()["resource_id"]

    # First check-in on creation day must increment streak_days from 0 to 1
    res_day1 = client.put(
        f"/api/roadmaps/{fresh_id}/stages/{fresh_stage_id}/resources/{fresh_res_id}",
        headers=headers,
        json={"title": "Updated Course Title"}
    )
    assert res_day1.status_code == 200
    fresh_refreshed = client.get(f"/api/roadmaps/{fresh_id}", headers=headers).json()
    assert fresh_refreshed["streak_days"] == 1

    # Same day subsequent update must keep streak at 1
    client.put(
        f"/api/roadmaps/{fresh_id}/stages/{fresh_stage_id}/resources/{fresh_res_id}",
        headers=headers,
        json={"title": "Updated Course Again"}
    )
    fresh_refreshed_again = client.get(f"/api/roadmaps/{fresh_id}", headers=headers).json()
    assert fresh_refreshed_again["streak_days"] == 1

    demo = client.post("/api/roadmaps/seed-demo", headers=headers)
    assert demo.status_code == 200
    roadmap_id = demo.json()["roadmap_id"]

    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]
    resource_id = details["stages"][0]["resources"][0]["id"]

    today = date.today()

    # Seed roadmap starts with streak_days=3, last_check_in_date=today
    rm = db_session.get(Roadmap, roadmap_id)
    assert rm is not None
    rm.streak_days = 3
    # Scenario 1: last check-in was yesterday (diff == 1) -> should increment to 4
    rm.last_check_in_date = format_date(today - timedelta(days=1))
    db_session.add(rm)
    db_session.commit()

    res_update1 = client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/resources/{resource_id}",
        headers=headers,
        json={"title": "Updated Resource Day 1"}
    )
    assert res_update1.status_code == 200
    refreshed1 = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert refreshed1["streak_days"] == 4
    assert refreshed1["last_check_in_date"] == format_date(today)

    # Scenario 2: updating again on the same day -> streak does NOT increment
    res_update2 = client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/resources/{resource_id}",
        headers=headers,
        json={"title": "Updated Resource Same Day"}
    )
    assert res_update2.status_code == 200
    refreshed2 = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert refreshed2["streak_days"] == 4

    # Scenario 3: last check-in was 3 days ago (skipped days) -> streak resets to 1
    rm = db_session.get(Roadmap, roadmap_id)
    assert rm is not None
    rm.streak_days = 10
    rm.last_check_in_date = format_date(today - timedelta(days=3))
    db_session.add(rm)
    db_session.commit()

    res_update3 = client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/resources/{resource_id}",
        headers=headers,
        json={"title": "Updated Resource After Gap"}
    )
    assert res_update3.status_code == 200
    refreshed3 = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert refreshed3["streak_days"] == 1
    assert refreshed3["last_check_in_date"] == format_date(today)

def test_vuln_15_seal_proof_of_work_empty_criteria_rejected(client, db_session):
    headers = {"X-Workspace-Id": "ws-pow-empty-criteria"}
    demo = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = demo.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]

    # 1. Update PoW to have empty criteria list []
    client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/proof-of-work",
        headers=headers,
        json={"acceptance_criteria": []}
    )

    # 2. Attempting to seal with empty criteria must fail with 400
    seal_fail = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/seal-pow",
        headers=headers,
        json={"evidence_url": "https://github.com/test/repo"}
    )
    assert seal_fail.status_code == 400
    assert "al menos un criterio" in seal_fail.json()["detail"].lower()

    # 3. String-based criteria in acceptance_criteria (e.g. from LLM or raw input)
    # Must fail with 400 instead of crashing with 500 AttributeError
    pow_item = db_session.exec(select(ProofOfWork).where(ProofOfWork.stage_id == stage_id)).first()
    pow_item.acceptance_criteria_json = '["Criterio en texto plano"]'
    db_session.add(pow_item)
    db_session.commit()

    seal_str_criteria = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/seal-pow",
        headers=headers,
        json={"evidence_url": "https://github.com/test/repo"}
    )
    assert seal_str_criteria.status_code == 400
    assert "100%" in seal_str_criteria.json()["detail"]

    # 4. Selecting an option with string criteria normalizes them to dicts
    pow_item.options_json = '[{"index": 0, "title": "Opt 1", "criteria": ["Default"]}, {"index": 1, "title": "Opt 2", "description": "Desc", "difficulty": "challenge", "criteria": ["String 1", "String 2"]}]'
    pow_item.selected_option_index = 0
    db_session.add(pow_item)
    db_session.commit()

    select_opt = client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/proof-of-work",
        headers=headers,
        json={"selected_option_index": 1}
    )
    assert select_opt.status_code == 200
    refreshed_pow = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()["stages"][0]["proof_of_work"]
    # Verified criteria were normalized to dicts with completed=False
    assert len(refreshed_pow["acceptance_criteria"]) == 2
    assert refreshed_pow["acceptance_criteria"][0]["completed"] is False
    assert refreshed_pow["acceptance_criteria"][0]["text"] == "String 1"

    # 5. Set criteria with completed=False -> fails
    client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/proof-of-work",
        headers=headers,
        json={"acceptance_criteria": [{"id": "c1", "text": "Do task", "completed": False}]}
    )
    seal_incomplete = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/seal-pow",
        headers=headers,
        json={"evidence_url": "https://github.com/test/repo"}
    )
    assert seal_incomplete.status_code == 400
    assert "100%" in seal_incomplete.json()["detail"]

    # 6. Set completed=True -> succeeds
    client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/proof-of-work",
        headers=headers,
        json={"acceptance_criteria": [{"id": "c1", "text": "Do task", "completed": True}]}
    )
    seal_ok = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/seal-pow",
        headers=headers,
        json={"evidence_url": "https://github.com/test/repo"}
    )
    assert seal_ok.status_code == 200

def test_vuln_16_catchup_bounds_validation(client, db_session):
    headers = {"X-Workspace-Id": "ws-shift-bounds"}
    demo = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = demo.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]

    # Boundary 180: Valid
    res_180 = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/catchup-sync",
        headers=headers,
        json={"shift_days": 180}
    )
    assert res_180.status_code == 200

    # Boundary 181: Invalid (422)
    res_181 = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/catchup-sync",
        headers=headers,
        json={"shift_days": 181}
    )
    assert res_181.status_code == 422

    # Direct timeline engine check raises ValueError for out of bounds and non-int
    with pytest.raises(ValueError, match="1 y 180"):
        apply_catchup_sync(db_session, roadmap_id, stage_id, 0)
    with pytest.raises(ValueError, match="1 y 180"):
        apply_catchup_sync(db_session, roadmap_id, stage_id, 181)
    with pytest.raises(ValueError, match="1 y 180"):
        apply_catchup_sync(db_session, roadmap_id, stage_id, True)  # bool should not bypass int check

    # calculate_duration_days hardening
    from app.services.timeline_engine import calculate_duration_days
    assert calculate_duration_days(20.0, 0) > 0
    assert calculate_duration_days(20.0, -5) > 0
    assert calculate_duration_days(20.0, None) > 0

def test_vuln_20_n_plus_one_batching_verification(client):
    headers = {"X-Workspace-Id": "ws-n-plus-1-test"}

    # Create 3 roadmaps
    r1 = client.post("/api/roadmaps", headers=headers, json={"title": "Roadmap 1"}).json()["id"]
    r2 = client.post("/api/roadmaps", headers=headers, json={"title": "Roadmap 2"}).json()["id"]
    r3 = client.post("/api/roadmaps/seed-demo", headers=headers).json()["roadmap_id"]

    # Add extra stages to r1
    client.post(f"/api/roadmaps/{r1}/stages", headers=headers, json={"title": "R1 Stage 2"})
    client.post(f"/api/roadmaps/{r1}/stages", headers=headers, json={"title": "R1 Stage 3"})

    # List all roadmaps: verifies batch stage counts
    all_roadmaps = client.get("/api/roadmaps", headers=headers).json()
    assert len(all_roadmaps) >= 3

    r1_info = next(r for r in all_roadmaps if r["id"] == r1)
    r2_info = next(r for r in all_roadmaps if r["id"] == r2)
    r3_info = next(r for r in all_roadmaps if r["id"] == r3)

    assert r1_info["stage_count"] == 3  # initial + 2 added
    assert r2_info["stage_count"] == 1  # initial stage
    assert r3_info["stage_count"] == 3  # seed demo has 3 stages

    # get_roadmap_details for r3 (seed demo with 3 stages, resources, pow)
    details = client.get(f"/api/roadmaps/{r3}", headers=headers).json()
    assert len(details["stages"]) == 3
    for s in details["stages"]:
        assert "resources" in s
        assert "proof_of_work" in s
        assert len(s["resources"]) >= 1
        assert s["proof_of_work"] is not None
