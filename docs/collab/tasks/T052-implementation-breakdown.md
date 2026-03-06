# T052 — Implementation Breakdown

แตก T052 ออกเป็น subtasks implementable ตามลำดับดังนี้:

1. [T052A-metric-integrity-split.md](/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/collab/tasks/T052A-metric-integrity-split.md)
- เป้าหมาย: ทำ KPI ให้เชื่อถือได้ก่อน
- ผลลัพธ์หลัก: แยก `audited` / `accepted` / `proxy`

2. [T052B-canonical-vendor-layout-routing.md](/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/collab/tasks/T052B-canonical-vendor-layout-routing.md)
- เป้าหมาย: ทำ vendor/layout routing ให้สะอาด
- ผลลัพธ์หลัก: canonical vendor + layout grouping

3. [T052C-critical-field-validation-repair.md](/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/collab/tasks/T052C-critical-field-validation-repair.md)
- เป้าหมาย: ดัน critical-field quality ขึ้นจริง
- ผลลัพธ์หลัก: validator + targeted repair + decision gate

4. [T052D-trusted-example-memory.md](/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/collab/tasks/T052D-trusted-example-memory.md)
- เป้าหมาย: ใช้ examples อย่างมีชั้นความเชื่อถือ
- ผลลัพธ์หลัก: trusted example ranking

5. [T052E-admin-feedback-rule-learning.md](/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/collab/tasks/T052E-admin-feedback-rule-learning.md)
- เป้าหมาย: ทำให้ admin corrections กลายเป็น deterministic improvement
- ผลลัพธ์หลัก: suggestion/draft rule pipeline

6. [T052F-holdout-benchmark-release-gate.md](/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/collab/tasks/T052F-holdout-benchmark-release-gate.md)
- เป้าหมาย: บังคับ release ด้วย evidence
- ผลลัพธ์หลัก: holdout benchmark + release gate

## Recommended execution order

### Sprint 1
- T052A
- T052B

### Sprint 2
- T052C

### Sprint 3
- T052D
- T052E

### Sprint 4
- T052F

## Critical path

ถ้าจะเอา "ใกล้ 100%" ให้เร็วที่สุด:
1. ทำ `T052A` ก่อนเพื่อหยุด metric ที่หลอกตา
2. ทำ `T052B` เพื่อให้ routing/examples/rules ใช้ข้อมูลชุดเดียวกัน
3. ทำ `T052C` เพราะตัวนี้เป็นงานที่ขยับความแม่นจริงมากที่สุด

