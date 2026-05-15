ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS location_id varchar(128);

CREATE INDEX IF NOT EXISTS "IDX_demos_location_id" ON demos (location_id);
CREATE INDEX IF NOT EXISTS "IDX_demos_user_location_id" ON demos (user_id, location_id);
