ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "IDX_ghl_connections_location_id"
  ON ghl_connections (location_id);
