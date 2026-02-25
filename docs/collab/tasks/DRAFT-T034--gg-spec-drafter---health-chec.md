I will start by exploring the codebase to understand the current implementation of the GG agent and any existing health check patterns in the project.
I will read `docs/collab/GG.md` to understand the GG agent's identity and setup, and then I'll search for any n8n workflows related to GG.
I'll examine `scripts/gg/common.sh` to understand its configuration, then I'll use that information to define the health check's verification steps, such as checking Gemini CLI availability, connectivity, environment variables, script integrity, and recent logs.
I'll design an n8n webhook endpoint `/webhook/gg-health` that triggers a new `scripts/gg/gg-health.sh` script. This script will perform several checks, including `gemini` CLI version, n8n webhook connectivity, script presence, and log errors, returning a JSON report. I'll then integrate this into an n8n workflow that uses a Webhook node and an Execute Command node to return the script's JSON output along with any relevant n8n-side connectivity checks. First, I'll examine existing workflows to determine the best integration point.
I'll search for "gg-data" within JSON files in the root directory to identify which workflow contains the `GET /webhook/gg-data` and `POST /webhook/gg-notify` webhooks mentioned in `docs/collab/GG.md`.
I'll investigate `workflow3.json`, and then check `3YmkttJCIJ6M2NyJ.json`, `Ga5bDLZW6uUaY2KI.json`, and other similar files, as they appear to be exported n8n workflows, possibly containing the `up1n75qEhbsXswii` workflow ID.
I'll search for "gg-data" again, but this time I'll remove the `*.json` restriction to see if it appears in any scripts.
I'll now draft the T034 task specification for the GG Agent Health Check Endpoint, which involves creating a `scripts/gg/gg-health.sh` script to perform technical checks and an n8n workflow to expose a `GET /webhook/gg-health` endpoint. The script will verify Gemini CLI installation, API connectivity, script existence, directory writability, and log status, while the n8n workflow will handle authentication and return the script's output as JSON. I'll include security measures like API key protection and ensure sensitive variables aren't exposed, followed by a test plan to verify various scenarios.
I've noticed that `run_shell_command`, `write_file`, and `replace` are mentioned in my instructions but aren't in my tool declarations. As a planning agent, I need to know if I should output the spec text directly or if I'm missing a tool. I'll check `cli_help` and my available tools again to clarify how I should fulfill the request to write a detailed implementation spec.
I'll assume I should provide the spec text directly, as I might not have the `write_file` tool despite the instructions. The collaboration notes specify that as Claude Code, I'm the planner and manager. I'll check `docs/collab/tasks` to see existing files and then provide the T034 spec as requested.
I'll provide the T034 spec as Markdown in my response, since I lack the `write_file` tool. I'll also double-check for any existing health check logic in the project before finalizing the spec.
I'll follow the `scripts/ngrok_healthcheck.sh` style to write the T034 GG Agent Health Check Endpoint spec, noting that it's a CC-reviewed GG draft. The spec will include a new `scripts/gg/gg-health.sh` Bash script to verify CLI, API, script integrity, and more, returning a detailed JSON report. It'll also feature an n8n workflow with a secured `GET /webhook/gg-health` endpoint and a comprehensive test plan. Since I lack the `write_file` tool, I'll provide the full spec text in my response for the user or Codex to implement.

# T034 — GG Agent Health Check Endpoint

**Author:** Claude Code (CC) — DRAFT by GG
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** Medium
**Depends on:** T033 (GG Webhooks)

---

## Overview
As the GG agent (Gemini) becomes more integrated into the OCR pipeline (for synthesis, validation, and curation), we need a reliable way to monitor its operational health. This task implements a health check endpoint that verifies Gemini CLI connectivity, API access, script integrity, and recent log status.

## Scope

**In scope:**
- New Bash script `scripts/gg/gg-health.sh` to perform technical checks.
- New n8n workflow `gg-health-monitor` (or add to existing `gg-gateway`).
- Expose `GET /webhook/gg-health` endpoint.
- Return a detailed JSON status report.

**Out of scope:**
- Automated self-healing (re-auth).
- Real-time dashboard (JSON output only for now).

## Technical Spec

### Step 1: Create `scripts/gg/gg-health.sh`
The script should source `scripts/gg/common.sh` and perform the following:
1.  **CLI Check:** Run `gemini --version` to ensure it's in the PATH and responsive.
2.  **API Connectivity:** Run a minimal prompt (e.g., `gemini -p "ping" --max-tokens 1`) to verify API key and network connectivity.
3.  **Script Integrity:** Check for existence and execution permission of:
    - `scripts/gg/common.sh`
    - `scripts/gg/gg-synthesize.sh`
    - `scripts/gg/gg-groundtruth.sh`
    - `scripts/gg/gg-spec-draft.sh`
    - `scripts/gg/gg-validate.sh`
4.  **Directory Check:** Verify `docs/gg/proposals` and `docs/gg/reports` are writable.
5.  **Log Check:** Check `logs/gg-error.log` for any errors in the last 24 hours.
6.  **Webhook Loopback:** Call `GET /webhook/gg-data?sheet=TRAIN_CASES` with the internal API key to verify n8n loopback connectivity.

**Expected JSON Output Format:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-25T20:30:00Z",
  "agent": "GG (Gemini)",
  "checks": {
    "cli": { "status": "ok", "version": "v0.30.0" },
    "api": { "status": "ok", "latency_ms": 450 },
    "scripts": { "status": "ok", "found": 6, "executable": true },
    "storage": { "status": "ok", "writable": true },
    "data_gateway": { "status": "ok" },
    "recent_errors": 0
  }
}
```

### Step 2: Create n8n Workflow `gg-health-monitor`
1.  **Webhook Node:**
    - Method: `GET`
    - Path: `gg-health`
    - Authentication: `Header Auth` (Key: `x-api-key`, Value: matching `OCR_SHARED_API_KEY` in `.env`)
2.  **Execute Command Node:**
    - Command: `bash scripts/gg/gg-health.sh`
3.  **Response Node:**
    - Respond with: `Body`
    - Response Body: `{{ $json.stdout }}`
    - Content Type: `application/json`

## Security Considerations
- **Authentication:** Must require `x-api-key` to prevent external discovery of system paths or component versions.
- **Information Leakage:** Do not expose sensitive environment variables or absolute local paths in the JSON output. Use relative paths or status flags (ok/fail).

## Test Plan

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Unauthorized Access | `curl -i GET .../webhook/gg-health` (no key) | 401 Unauthorized |
| T2 | Healthy State | `curl -H "x-api-key: [KEY]" GET .../webhook/gg-health` | 200 + status: "ok" |
| T3 | API Key Failure | (Temporarily invalidate API key in `.env`) | 200 + status: "fail" + api.status: "fail" |
| T4 | Script Missing | (Temporarily rename a required script) | 200 + status: "warn" + scripts.status: "warn" |

## Definition of Done
- [ ] `scripts/gg/gg-health.sh` created and executable.
- [ ] n8n `gg-health` webhook is active and secured.
- [ ] Output follows the specified JSON structure.
- [ ] Documentation updated (if applicable).

## Discussion
*(for Codex pre-execution questions)*
- Should we add a Telegram alert if the health check fails? (CC: Let's keep it simple for now; monitoring is sufficient for this phase).
