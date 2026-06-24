-- Migration 005: Admin audit log table
-- Bảng ghi lại mọi thao tác quản trị quan trọng của Admin

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50)  NOT NULL,
  entity_id       UUID         NOT NULL,
  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index để query nhanh theo admin, entity, và thời gian
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id
  ON admin_audit_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON admin_audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON admin_audit_logs(created_at DESC);
