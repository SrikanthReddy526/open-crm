-- Keep the original login time across refresh-token rotations (for the "active devices" page)
ALTER TABLE refresh_tokens ADD COLUMN session_started_at TIMESTAMPTZ;
UPDATE refresh_tokens SET session_started_at = created_at;
ALTER TABLE refresh_tokens ALTER COLUMN session_started_at SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN session_started_at SET DEFAULT now();
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- "Changes since" lookups used by /api/sync/pull
CREATE INDEX idx_visits_updated_at    ON field_visits(updated_at);
CREATE INDEX idx_reminders_updated_at ON reminders(updated_at);

-- List filters
CREATE INDEX idx_deals_owner      ON deals(owner_id);
CREATE INDEX idx_leads_updated_at ON leads(updated_at);
