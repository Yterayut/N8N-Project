# 🔧 Manual Fix: Duplicate Facebook Reply Issue

## ⚠️ Problem
FB Action Switch has Output 0 and 1 both connecting to "FB Graph Reply Text", causing duplicate replies.

---

## ✅ Solution: Add Merge Node via UI

### Step 1: Start n8n
```bash
cd /Users/teerayutyeerahem/My-project/n8n
./start-n8n.sh
```

Wait for: `Editor is now accessible via: https://...`

---

### Step 2: Open Workflow in Browser
1. Open: http://localhost:5678
2. Click "My workflow 3" to open it

---

### Step 3: Add Merge Node

1. **Click "+" button** or press `Tab` to add new node
2. **Search "Merge"** and select "Merge" node
3. **Configure Merge node:**
   - Name: `Merge FB Replies`
   - Mode: `Append`
   - Position: Place it between "FB Action Switch" and "FB Graph Reply Text"

---

### Step 4: Reconnect Nodes

#### Delete old connections:
1. Click on the line from **FB Action Switch Output 0** → **FB Graph Reply Text**
2. Press `Delete` key
3. Click on the line from **FB Action Switch Output 1** → **FB Graph Reply Text**
4. Press `Delete` key

#### Create new connections:
1. **From FB Action Switch Output 0** (fb_complaint)
   - Drag to **Merge FB Replies Input 1**

2. **From FB Action Switch Output 1** (fb_encouragement)
   - Drag to **Merge FB Replies Input 2**

3. **From Merge FB Replies**
   - Drag to **FB Graph Reply Text**

---

### Step 5: Verify Final Structure

```
FB Action Switch
  ├─ Output 0 (complaint)     ──┐
  ├─ Output 1 (encouragement) ──├→ Merge FB Replies → FB Graph Reply Text ✅
  ├─ Output 2 (sticker)       ──→ FB Graph Reply Sticker
  ├─ Output 3 (negative)      ──→ FB Graph Delete Comment
  └─ Output 4 (other)         ──→ Line Error Guard
```

---

### Step 6: Save Workflow

1. Click **"Save"** button (top right)
2. Workflow will auto-save and activate

---

## ✅ Result

- FB Graph Reply Text will only be called **once** per comment
- No more duplicate replies on Facebook!

---

## 📸 Visual Guide

### Before (WRONG):
```
Switch Output 0 → FB Graph Reply Text  ❌ Call 1
Switch Output 1 → FB Graph Reply Text  ❌ Call 2 (duplicate!)
```

### After (CORRECT):
```
Switch Output 0 ──┐
Switch Output 1 ──├→ Merge → FB Graph Reply Text ✅ (single call)
```

---

## 🔍 Troubleshooting

### If you don't see the Merge node option:
- Make sure n8n is fully started
- Refresh the browser (Cmd+R / Ctrl+R)
- Check n8n version: should be 1.98.2+

### If connections won't delete:
- Click the connection line first (it should highlight)
- Then press Delete key
- Or right-click → Delete

---

**Created:** 2025-11-05
**Issue:** Duplicate Facebook comment replies
**Fix:** Add Merge node between Switch and Reply nodes
