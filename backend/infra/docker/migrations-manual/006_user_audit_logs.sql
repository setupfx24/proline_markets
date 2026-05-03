-- Trader activity audit (login, logout, order placement) for admin review.
CREATE TABLE IF NOT EXISTS user_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(80) NOT NULL,
    ip_address VARCHAR(64),
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_audit_logs_user ON user_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_action ON user_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_created ON user_audit_logs(created_at DESC);
