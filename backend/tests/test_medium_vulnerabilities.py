import time
import pytest
from sqlmodel import Session, text
from app.services.ai_copilot import RATE_LIMIT_STORE, check_ip_rate_limit
from app.database import engine

def test_rate_limit_status_does_not_consume_tokens(client):
    test_ip = "192.0.2.100"
    RATE_LIMIT_STORE.pop(test_ip, None)

    # Calling /api/ai/status repeatedly should NOT consume any tokens
    res1 = client.get("/api/ai/status", headers={"X-Forwarded-For": test_ip})
    assert res1.status_code == 200
    rem1 = res1.json()["rate_limit_remaining"]

    res2 = client.get("/api/ai/status", headers={"X-Forwarded-For": test_ip})
    assert res2.status_code == 200
    rem2 = res2.json()["rate_limit_remaining"]
    assert rem1 == rem2, "Token was consumed on status check!"

    # check_ip_rate_limit directly with consume=True
    check1 = check_ip_rate_limit(test_ip, consume=True)
    assert check1["allowed"] is True
    assert check1["remaining"] == rem1 - 1

    # Check status again; remaining should reflect the single consumed token
    res3 = client.get("/api/ai/status", headers={"X-Forwarded-For": test_ip})
    assert res3.status_code == 200
    assert res3.json()["rate_limit_remaining"] == rem1 - 1

def test_rate_limit_store_purges_stale_ips():
    now = time.time()
    stale_ip = "198.51.100.1"
    active_ip = "198.51.100.2"

    # Insert a stale entry older than 1 hour (3700s ago)
    RATE_LIMIT_STORE[stale_ip] = [now - 3700]
    RATE_LIMIT_STORE[active_ip] = [now - 50]

    # Checking any IP triggers the prune of stale IPs
    check_ip_rate_limit("198.51.100.3", consume=False)

    assert stale_ip not in RATE_LIMIT_STORE, "Stale IP was not purged from RATE_LIMIT_STORE!"
    assert active_ip in RATE_LIMIT_STORE, "Active IP was incorrectly purged!"

def test_slot_type_restriction_in_roadmaps(client):
    headers = {"X-Workspace-Id": "ws-slot-test"}
    demo_res = client.post("/api/roadmaps/seed-demo", headers=headers)
    assert demo_res.status_code == 200
    roadmap_id = demo_res.json()["roadmap_id"]

    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]

    # 1. Custom/arbitrary slot_type must be rejected with HTTP 422
    res_custom = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/resources",
        headers=headers,
        json={
            "slot_type": "custom_bypass",
            "title": "Bypass Resource",
            "url": "https://example.com/bypass"
        }
    )
    assert res_custom.status_code == 422

    res_aux3 = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/resources",
        headers=headers,
        json={
            "slot_type": "aux_3",
            "title": "Aux 3 Resource",
            "url": "https://example.com/aux3"
        }
    )
    assert res_aux3.status_code == 422

def test_slot_type_restriction_in_icebox(client):
    headers = {"X-Workspace-Id": "ws-icebox-slot-test"}
    seed = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = seed.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]

    # Quick capture item
    cap = client.post(
        "/api/icebox",
        headers=headers,
        json={"url": "https://example.com/docs", "title": "Test Item"}
    )
    assert cap.status_code == 201
    item_id = cap.json()["id"]

    # Try promoting with invalid slot_type
    promote = client.post(
        f"/api/icebox/{item_id}/promote",
        headers=headers,
        json={"stage_id": stage_id, "slot_type": "arbitrary_slot"}
    )
    assert promote.status_code == 422

def test_start_date_strict_format_validation(client):
    headers = {"X-Workspace-Id": "ws-date-test"}
    seed = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = seed.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]

    # 1. Malformed date string on update must be rejected with 422 (not 500)
    for bad_date in ["not-a-date", "2025-13-01", "2025-02-30", "2025/01/01", "2025-1-1"]:
        put_res = client.put(
            f"/api/roadmaps/{roadmap_id}/stages/{stage_id}",
            headers=headers,
            json={"start_date": bad_date}
        )
        assert put_res.status_code == 422, f"Failed for bad date {bad_date}: {put_res.text}"

    # 2. Valid date string succeeds
    good_res = client.put(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}",
        headers=headers,
        json={"start_date": "2026-05-15"}
    )
    assert good_res.status_code == 200

    # 3. Create stage with bad date must also fail with 422
    create_res = client.post(
        f"/api/roadmaps/{roadmap_id}/stages",
        headers=headers,
        json={"title": "Bad Date Stage", "start_date": "invalid"}
    )
    assert create_res.status_code == 422

def test_web_search_request_validation(client):
    # 1. Limit > 10 should fail validation with 422
    res_high_limit = client.post(
        "/api/ai/web-search",
        json={"query": "python tutorial", "limit": 25}
    )
    assert res_high_limit.status_code == 422

    # 2. Limit < 1 should fail validation with 422
    res_low_limit = client.post(
        "/api/ai/web-search",
        json={"query": "python tutorial", "limit": 0}
    )
    assert res_low_limit.status_code == 422

    # 3. Empty query should fail with 422
    res_empty_q = client.post(
        "/api/ai/web-search",
        json={"query": "", "limit": 5}
    )
    assert res_empty_q.status_code == 422

    # 4. Whitespace query should fail with 422
    res_space_q = client.post(
        "/api/ai/web-search",
        json={"query": "   ", "limit": 5}
    )
    assert res_space_q.status_code == 422

def test_sqlite_wal_and_busy_timeout_configured():
    # Verify pragmas executed on engine
    with Session(engine) as session:
        busy_timeout = session.exec(text("PRAGMA busy_timeout;")).first()
        journal_mode = session.exec(text("PRAGMA journal_mode;")).first()

    assert busy_timeout[0] == 5000, f"Expected busy_timeout=5000, got {busy_timeout}"
    # In file-based sqlite it is 'wal', in in-memory test databases it is 'memory'
    assert journal_mode[0].lower() in ("wal", "memory"), f"Unexpected journal_mode: {journal_mode}"

def test_clean_json_text_multi_block_and_conversational():
    from app.services.ai_copilot import clean_json_text
    import json

    # 1. Non-JSON code block (e.g. bash) before JSON code block
    mixed_blocks = (
        "Here are instructions:\n"
        "```bash\n"
        "npm install\n"
        "```\n"
        "And here is the roadmap data:\n"
        "```json\n"
        "{\"roadmap_title\": \"Fullstack JS\", \"weekly_hours\": 10}\n"
        "```\n"
    )
    cleaned = clean_json_text(mixed_blocks)
    parsed = json.loads(cleaned)
    assert parsed["roadmap_title"] == "Fullstack JS"

    # 2. Conversational text without backticks and with trailing curly braces
    conversational = (
        "¡Hola! Aquí tienes la configuración: "
        "{\"course_title\": \"React\", \"options\": []} "
        "Recuerda usar las llaves {correctamente}."
    )
    cleaned2 = clean_json_text(conversational)
    parsed2 = json.loads(cleaned2)
    assert parsed2["course_title"] == "React"

def test_copilot_weekly_hours_and_empty_inputs(client):
    # 1. weekly_hours = 0 must fail validation with 422 (preventing ZeroDivisionError)
    res_zero_hours = client.post(
        "/api/ai/copilot",
        json={"mode": "architect", "goal": "Aprender Python", "weekly_hours": 0}
    )
    assert res_zero_hours.status_code == 422

    # 2. weekly_hours > 168 must fail validation with 422
    res_excess_hours = client.post(
        "/api/ai/copilot",
        json={"mode": "architect", "goal": "Aprender Python", "weekly_hours": 200}
    )
    assert res_excess_hours.status_code == 422

    # 3. Whitespace goal must be rejected with 400
    res_ws_goal = client.post(
        "/api/ai/copilot",
        json={"mode": "architect", "goal": "   ", "weekly_hours": 10}
    )
    assert res_ws_goal.status_code == 400

    # 4. Whitespace course_title must be rejected with 400
    res_ws_title = client.post(
        "/api/ai/copilot",
        json={"mode": "scaffolding", "course_title": "   ", "weekly_hours": 10}
    )
    assert res_ws_title.status_code == 400

def test_catchup_sync_bounds_validation(client):
    headers = {"X-Workspace-Id": "ws-catchup-bounds"}
    seed = client.post("/api/roadmaps/seed-demo", headers=headers)
    roadmap_id = seed.json()["roadmap_id"]
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    stage_id = details["stages"][0]["id"]

    # shift_days <= 0 must fail with 422
    res_zero = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/catchup-sync",
        headers=headers,
        json={"shift_days": 0}
    )
    assert res_zero.status_code == 422

    # shift_days > 180 (e.g. 181, 500) must fail with 422
    res_large = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/catchup-sync",
        headers=headers,
        json={"shift_days": 500}
    )
    assert res_large.status_code == 422

    res_181 = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/catchup-sync",
        headers=headers,
        json={"shift_days": 181}
    )
    assert res_181.status_code == 422

    # shift_days == 180 succeeds
    res_180 = client.post(
        f"/api/roadmaps/{roadmap_id}/stages/{stage_id}/catchup-sync",
        headers=headers,
        json={"shift_days": 180}
    )
    assert res_180.status_code == 200

