# Git Workflow for OCM-OCR

เอกสารมาตรฐานทีมสำหรับการพัฒนา OCR บน GitHub (`Yterayut/OCM-OCR`)

## 1) Branching Strategy

- `main` = production-ready only
- ห้ามพัฒนา feature ตรงบน `main`
- สร้าง branch ใหม่จาก `main` ทุกครั้ง

รูปแบบชื่อ branch:
- `feature/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`
- `hotfix/<short-name>`

ตัวอย่าง:
- `feature/ocr-feedback-api`
- `fix/parse-error-json`
- `chore/workflow-sanitizer`

## 2) Daily Flow (Developer)

```bash
# 1) เริ่มงานใหม่
git checkout main
git pull origin main
git checkout -b feature/ocr-feedback-api

# 2) ทำงาน + commit
git add .
git commit -m "feat: add OCR feedback ingestion endpoint"

# 3) push branch
git push -u origin feature/ocr-feedback-api
```

## 3) Merge Policy

merge เข้า `main` เมื่อ:
- tests ผ่าน
- OCR response schema ไม่แตก
- ไม่มี secret/credential ในไฟล์
- ผ่าน review

merge command (non-fast-forward):
```bash
git checkout main
git pull origin main
git merge --no-ff feature/ocr-feedback-api
git push origin main
```

## 4) Tag Policy

- ไม่ต้อง tag ทุก commit
- ให้ tag ตอน release/milestone ที่พร้อมใช้งานจริง

ตัวอย่าง tag:
- `v1.0.0` major release
- `v1.1.0` feature release
- `v1.1.1` hotfix

คำสั่ง:
```bash
git checkout main
git pull origin main
git tag -a v1.1.0 -m "OCR release v1.1.0"
git push origin v1.1.0
```

## 5) Pull Code ไปใช้ที่ Server

ใช้งานจริงให้ดึงจาก `main` เท่านั้น:
```bash
git checkout main
git pull origin main
```

กรณีต้องทดสอบ branch เฉพาะ:
```bash
git fetch origin
git checkout feature/ocr-feedback-api
git pull origin feature/ocr-feedback-api
```

## 6) Sync main กลับเข้า branch ที่กำลังทำงาน

```bash
git checkout feature/ocr-feedback-api
git fetch origin
git merge origin/main
# หรือใช้ rebase ตามทีมตกลง
# git rebase origin/main
```

## 7) Commit Message Convention

- `feat:` ฟีเจอร์ใหม่
- `fix:` แก้บั๊ก
- `chore:` งานดูแลระบบ/infra
- `refactor:` ปรับโครงสร้างไม่เปลี่ยน behavior
- `docs:` เอกสาร
- `test:` เทสต์

ตัวอย่าง:
- `fix: return standardized JSON for parse_error`
- `feat: add telegram notification for OCR runtime errors`

## 8) Secret & Sensitive Data Policy (สำคัญ)

ห้าม push ข้อมูลเหล่านี้ขึ้น GitHub:
- API key / token / PAT
- username/password
- n8n credentials block
- private keys
- `.env`, `.env.prod`, database dump, backup files

ก่อน push ให้ตรวจ:
```bash
git status
git diff --staged
```

ถ้าเผลอหลุด secret:
1. Revoke/rotate key ทันที
2. ลบจาก repo history (ตามความเหมาะสม)
3. แจ้งทีม

## 9) Recommended PR Checklist

- [ ] branch สร้างจาก `main` ล่าสุด
- [ ] ไม่มีไฟล์ secret/sensitive
- [ ] test ผ่าน
- [ ] response schema ไม่แตก
- [ ] เพิ่ม/อัปเดต docs ที่เกี่ยวข้อง
- [ ] ระบุ rollback plan

## 10) Release Checklist

- [ ] merge เข้า `main` แล้ว
- [ ] สร้าง tag release
- [ ] deploy ตาม runbook
- [ ] smoke test ผ่าน
- [ ] monitor log/error/latency หลัง deploy

---

## Quick Commands Summary

```bash
# new work
git checkout main && git pull origin main
git checkout -b feature/<name>

# push
git add . && git commit -m "feat: ..."
git push -u origin feature/<name>

# merge
git checkout main && git pull origin main
git merge --no-ff feature/<name>
git push origin main

# tag release
git tag -a vX.Y.Z -m "release vX.Y.Z"
git push origin vX.Y.Z
```
