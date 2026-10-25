import pytest
from app.services.web_search import is_safe_url, scrape_url_metadata
from app.config import settings

# -----------------------------------------------------------------------------
# 1. SSRF Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ssrf_url_validation():
    # Cloud metadata
    assert is_safe_url("http://169.254.169.254/latest/meta-data/") is False
    assert is_safe_url("http://169.254.1.1/") is False

    # Loopback
    assert is_safe_url("http://127.0.0.1:8000/api/health") is False
    assert is_safe_url("http://127.0.1.1/") is False
    assert is_safe_url("http://localhost:8000") is False
    assert is_safe_url("http://localhost.localdomain") is False
    assert is_safe_url("http://[::1]:8000/") is False

    # Private RFC 1918 ranges
    assert is_safe_url("http://10.0.0.1/") is False
    assert is_safe_url("http://10.254.0.1:3000/") is False
    assert is_safe_url("http://172.16.0.1/") is False
    assert is_safe_url("http://172.31.255.255/") is False
    assert is_safe_url("http://192.168.1.1/") is False
    assert is_safe_url("http://192.168.0.100:8080/") is False

    # Non-HTTP schemes
    assert is_safe_url("file:///etc/passwd") is False
    assert is_safe_url("gopher://127.0.0.1:70/") is False
    assert is_safe_url("ftp://example.com/test") is False

    # Valid public domain
    assert is_safe_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ") is True

@pytest.mark.asyncio
async def test_scrape_url_metadata_ssrf_blocked():
    meta = await scrape_url_metadata("http://169.254.169.254/latest/meta-data/")
    assert meta["url"] == "http://169.254.169.254/latest/meta-data/"
    assert meta["description"] == ""

    meta_loopback = await scrape_url_metadata("http://127.0.0.1:8000/secret")
    assert meta_loopback["url"] == "http://127.0.0.1:8000/secret"
    assert meta_loopback["description"] == ""


# -----------------------------------------------------------------------------
# 2. BOLA / IDOR Tests across all mutation endpoints
# -----------------------------------------------------------------------------
def test_bola_idor_mutation_endpoints_cross_tenant_blocked(client):
    headers_tenant_a = {"X-Workspace-Id": "tenant-a"}
    headers_tenant_b = {"X-Workspace-Id": "tenant-b"}

    # Tenant A creates a demo roadmap
    demo_res = client.post("/api/roadmaps/seed-demo", headers=headers_tenant_a)
    assert demo_res.status_code == 200
    roadmap_a_id = demo_res.json()["roadmap_id"]

    details_a = client.get(f"/api/roadmaps/{roadmap_a_id}", headers=headers_tenant_a).json()
    stage1 = details_a["stages"][0]
    stage1_id = stage1["id"]
    res1 = stage1["resources"][0]
    res1_id = res1["id"]

    # 1. Tenant B tries to update Stage of Tenant A -> 404
    put_stage = client.put(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}",
        headers=headers_tenant_b,
        json={"title": "Hacked Title"}
    )
    assert put_stage.status_code == 404

    # 2. Tenant B tries to add a resource to Tenant A's stage -> 404
    post_res = client.post(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}/resources",
        headers=headers_tenant_b,
        json={
            "slot_type": "aux_2",
            "title": "Hacked Resource",
            "url": "https://example.com/hacked"
        }
    )
    assert post_res.status_code == 404

    # 3. Tenant B tries to update Tenant A's resource -> 404
    put_res = client.put(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}/resources/{res1_id}",
        headers=headers_tenant_b,
        json={"title": "Hacked Resource Title"}
    )
    assert put_res.status_code == 404

    # 4. Tenant B tries to delete Tenant A's resource -> 404
    del_res = client.delete(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}/resources/{res1_id}",
        headers=headers_tenant_b
    )
    assert del_res.status_code == 404

    # 5. Tenant B tries to update Tenant A's proof of work -> 404
    put_pow = client.put(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}/proof-of-work",
        headers=headers_tenant_b,
        json={"evidence_url": "https://github.com/attacker/repo"}
    )
    assert put_pow.status_code == 404

    # 6. Tenant B tries to seal Tenant A's stage -> 404
    seal_pow = client.post(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}/seal-pow",
        headers=headers_tenant_b,
        json={"evidence_url": "https://github.com/attacker/repo"}
    )
    assert seal_pow.status_code == 404

    # 7. Tenant B tries to trigger catchup sync on Tenant A's stage -> 404
    sync_res = client.post(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}/catchup-sync",
        headers=headers_tenant_b,
        json={"shift_days": 5}
    )
    assert sync_res.status_code == 404

    # 8. Tenant B tries to create a stage in Tenant A's roadmap -> 404
    post_stage = client.post(
        f"/api/roadmaps/{roadmap_a_id}/stages",
        headers=headers_tenant_b,
        json={"title": "Injected Stage"}
    )
    assert post_stage.status_code == 404

    # Verification: Tenant A performing the mutations succeeds
    valid_put = client.put(
        f"/api/roadmaps/{roadmap_a_id}/stages/{stage1_id}",
        headers=headers_tenant_a,
        json={"title": "Updated by Owner"}
    )
    assert valid_put.status_code == 200


# -----------------------------------------------------------------------------
# 3. CORS Configuration Tests
# -----------------------------------------------------------------------------
def test_cors_configuration_no_wildcard_with_credentials(client):
    assert "*" not in settings.CORS_ORIGINS

    # Preflight request from an allowed origin
    res = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res.headers.get("access-control-allow-credentials") == "true"

    # Request from an unauthorized origin should NOT receive allow-origin
    res_unauth = client.options(
        "/api/health",
        headers={
            "Origin": "http://malicious-site.com",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert res_unauth.headers.get("access-control-allow-origin") is None


# -----------------------------------------------------------------------------
# 4. Manual Roadmap Creation & Interactive Stage Adding Tests
# -----------------------------------------------------------------------------
def test_manual_roadmap_creation_instantiates_initial_stage(client):
    headers = {"X-Workspace-Id": "manual-ws"}
    create_res = client.post(
        "/api/roadmaps",
        headers=headers,
        json={
            "title": "Aprender Rust",
            "description": "De cero a sistemas en Rust",
            "weekly_hours": 12
        }
    )
    assert create_res.status_code == 201
    roadmap_id = create_res.json()["id"]

    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert details["title"] == "Aprender Rust"
    assert len(details["stages"]) == 1

    stage1 = details["stages"][0]
    assert stage1["position_index"] == 0
    assert stage1["status"] == "active"
    assert "Fundamentos" in stage1["title"]
    assert stage1["proof_of_work"] is not None

def test_add_stage_endpoint(client):
    headers = {"X-Workspace-Id": "manual-ws-2"}
    create_res = client.post(
        "/api/roadmaps",
        headers=headers,
        json={"title": "Aprender Go"}
    )
    assert create_res.status_code == 201
    roadmap_id = create_res.json()["id"]

    # Add second stage using POST /api/roadmaps/{roadmap_id}/stages
    stage2_res = client.post(
        f"/api/roadmaps/{roadmap_id}/stages",
        headers=headers,
        json={
            "title": "Etapa 2: Concurrencia con Goroutines",
            "duration_days": 21,
            "estimated_hours": 25.0
        }
    )
    assert stage2_res.status_code == 201
    stage2_data = stage2_res.json()
    assert stage2_data["position_index"] == 1
    assert stage2_data["status"] == "locked"
    assert stage2_data["title"] == "Etapa 2: Concurrencia con Goroutines"

    # Verify roadmap has both stages linked sequentially
    details = client.get(f"/api/roadmaps/{roadmap_id}", headers=headers).json()
    assert len(details["stages"]) == 2
    s1, s2 = details["stages"][0], details["stages"][1]
    assert s1["status"] == "active"
    assert s2["status"] == "locked"
    assert s2["start_date"] > s1["start_date"]
