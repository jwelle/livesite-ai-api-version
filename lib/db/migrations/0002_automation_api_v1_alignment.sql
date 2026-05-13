ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS created_via varchar(32),
  ADD COLUMN IF NOT EXISTS external_source varchar(64),
  ADD COLUMN IF NOT EXISTS api_key_id varchar,
  ADD COLUMN IF NOT EXISTS external_source_id varchar(128);

CREATE INDEX IF NOT EXISTS "IDX_demos_created_via" ON demos (created_via);
CREATE INDEX IF NOT EXISTS "IDX_demos_api_key_id" ON demos (api_key_id);
