ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "supabase_auth_user_id" varchar;

CREATE UNIQUE INDEX IF NOT EXISTS "users_supabase_auth_user_id_unique"
  ON "users" ("supabase_auth_user_id")
  WHERE "supabase_auth_user_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "admin_impersonations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "token" varchar(128) NOT NULL UNIQUE,
  "admin_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_admin_impersonations_admin"
  ON "admin_impersonations" ("admin_user_id");

CREATE INDEX IF NOT EXISTS "IDX_admin_impersonations_expires_at"
  ON "admin_impersonations" ("expires_at");
