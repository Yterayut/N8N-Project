# OCR Canonical Schema Standards v1

## 1) Common Response Envelope

```json
{
  "success": true,
  "request_id": "string",
  "status": "success|parse_error|error",
  "bills_count": 0,
  "data": { "bills": [] },
  "errors": []
}
```

## 2) Shared Bill Schema (all types)

```json
{
  "vendor_tax_id": "",
  "invoice_number": "",
  "invoice_date_th": "",
  "customer_name": "",
  "address": "",
  "currency": "THB",
  "total": 0,
  "list_detail": [
    { "description": "", "unit_price": 0, "quantity": 0, "amount": 0 }
  ]
}
```

Required fields (all bill types):
- `vendor_tax_id`
- `invoice_number`
- `invoice_date_th`
- `total`

Optional fields (all bill types):
- `customer_name`, `address`, `currency`, `list_detail[*]`

Default policy (all bill types):
- Unknown text: `""`
- Unknown numeric: `0`
- Unknown array: `[]`

## 3) Type Extensions + Required/Optional/Default

### 3.1 Fuel
- Extra required: none
- Extra optional: none
- Default: use shared defaults only

### 3.2 Electricity
- Extra required: `meter_number`, `electricity_ref`
- Extra optional: `electricity_user_id`, `units_used`
- Defaults:
  - `meter_number`: `""`
  - `electricity_ref`: `""`
  - `electricity_user_id`: `""`
  - `units_used`: `0`

### 3.3 Fleet Card
- Extra required: `card_number`, `vehicle_plate`, `odometer`
- Extra optional: none
- Defaults:
  - `card_number`: `""`
  - `vehicle_plate`: `""`
  - `odometer`: `""`

### 3.4 Parking
- Extra required: none
- Extra optional: none
- Default: use shared defaults only

### 3.5 Mixed
- Keep one bill object per source bill only (no cross-merge)
- Required/optional follow detected dominant type per bill

## 4) Minimum Validation Rules

1. `vendor_tax_id`: 13 digits and starts with `0`.
2. `invoice_number`: non-empty string.
3. `invoice_date_th`: `DD/MM/BBBB` (Buddhist year).
4. `total`: numeric and `> 0`.
5. `list_detail[*].amount`: numeric and `>= 0`.
6. Electricity:
- `meter_number`: exactly 10 digits.
- `electricity_ref`: exactly 12 digits.
7. Fleet:
- `card_number`: digits only, length by issuer policy.
- `vehicle_plate`: normalize spacing before validate.
- `odometer`: numeric and non-decreasing per same vehicle history.

## 5) Non-hallucination Rule

- If value is missing/unclear, keep default values above.
- Never fabricate tax ID, invoice number, date, or amount.
