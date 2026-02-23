# T002: Create Regression Test Matrix

**Owner:** Codex
**Priority:** P1
**Status:** pending
**Depends On:** -

## Objective
สร้าง test matrix สำหรับตรวจสอบ OCR regression หลัง patch P0/P1

## Deliverable
ไฟล์ `docs/collab/tasks/regression-test-matrix.md` ที่มี:

### 1. Test Cases per Document Type
- **Fuel bill:** PTT, Shell, Bangchak, LPG manual form
- **Electricity:** PEA, MEA, different ref formats
- **Fleet card:** standard, missing quantity edge case
- **Parking:** standard

### 2. Test Scenarios
- Happy path (success + auto_pass)
- Parse error (bad PDF, corrupt image)
- Re-ask trigger (critical validation error)
- Re-ask fail (still has errors after re-ask)
- Duplicate bill detection
- Queue path (submit + process)
- Multi-file upload (2-3 files)
- Oversized file
- Wrong API key (401)
- No file attached (422)
- Admission denied (429)

### 3. Expected Output per Case
- HTTP status code
- decision field value
- confidence range
- bills_count
- key fields validated

### 4. Pass/Fail Criteria
- Define what "pass" means for each test case
- Define acceptable confidence thresholds

## Notes
- อ้างอิง `docs/improve.md` สำหรับ edge cases ที่ต้อง cover
- อ้างอิง `docs/test-workflow-documentation.md` สำหรับ flow details
