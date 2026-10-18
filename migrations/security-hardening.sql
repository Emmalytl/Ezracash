-- Additive only. Run on a preview/test database first. No records are deleted.
CREATE TABLE IF NOT EXISTS login_rate_limits (
 key TEXT PRIMARY KEY,
 hits INTEGER NOT NULL,
 reset_at TIMESTAMPTZ NOT NULL
);
-- Expired rows can be pruned periodically by a maintenance role:
-- DELETE FROM login_rate_limits WHERE reset_at < NOW() - INTERVAL '1 day';
-- A runtime account needs SELECT/INSERT/UPDATE on this table. Existing app schema
-- setup still needs broader privileges until migrations are fully separated.
