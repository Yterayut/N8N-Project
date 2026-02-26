-- OCR feedback loop core tables
-- Safe to apply on PostgreSQL/MySQL with minor syntax adjustments.

CREATE TABLE IF NOT EXISTS ocr_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(128) NOT NULL UNIQUE,
  tenant_id VARCHAR(128) NULL,
  document_id VARCHAR(128) NULL,
  page_no INTEGER NULL,
  file_hash VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL,
  http_code INTEGER NOT NULL,
  decision VARCHAR(32) NULL,
  doc_type VARCHAR(64) NULL,
  confidence NUMERIC(6,4) NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  candidates_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  est_cost_thb NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_requests_tenant_doc_page
  ON ocr_requests (tenant_id, document_id, page_no);
CREATE INDEX IF NOT EXISTS idx_ocr_requests_status_created
  ON ocr_requests (status, created_at);

CREATE TABLE IF NOT EXISTS ocr_predictions (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(128) NOT NULL,
  raw_json TEXT NULL,
  normalized_json TEXT NULL,
  validation_errors_json TEXT NULL,
  dedupe_key VARCHAR(256) NULL,
  ocr_version VARCHAR(64) NULL,
  prompt_version VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocr_predictions_request_id
    FOREIGN KEY (request_id) REFERENCES ocr_requests(request_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ocr_predictions_request_id
  ON ocr_predictions (request_id);
CREATE INDEX IF NOT EXISTS idx_ocr_predictions_dedupe_key
  ON ocr_predictions (dedupe_key);

CREATE TABLE IF NOT EXISTS ocr_feedback (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NULL,
  document_id VARCHAR(128) NULL,
  page_no INTEGER NULL,
  ocr_raw_output_json TEXT NOT NULL,
  admin_final_output_json TEXT NOT NULL,
  field_diff_json TEXT NULL,
  edit_score NUMERIC(8,4) NULL,
  approved_by VARCHAR(128) NULL,
  approved_at TIMESTAMP NULL,
  quality_label VARCHAR(32) NOT NULL DEFAULT 'trusted',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocr_feedback_request_id
    FOREIGN KEY (request_id) REFERENCES ocr_requests(request_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ocr_feedback_request_id
  ON ocr_feedback (request_id);
CREATE INDEX IF NOT EXISTS idx_ocr_feedback_document_page
  ON ocr_feedback (document_id, page_no);
CREATE INDEX IF NOT EXISTS idx_ocr_feedback_quality
  ON ocr_feedback (quality_label, created_at);

CREATE TABLE IF NOT EXISTS ocr_learning_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_type VARCHAR(64) NOT NULL,
  pattern_json TEXT NOT NULL,
  replacement_json TEXT NOT NULL,
  source_feedback_count INTEGER NOT NULL DEFAULT 0,
  precision_score NUMERIC(8,4) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_learning_rules_status
  ON ocr_learning_rules (status, updated_at);
