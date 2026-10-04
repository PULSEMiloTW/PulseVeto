-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_encrypted" TEXT,
    "disabled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admin_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organization_access_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "lookup_hash" TEXT NOT NULL,
    "verification_hash" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "last_four" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "last_used_at" DATETIME,
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_access_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "organization_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_path" TEXT,
    "logo_url" TEXT,
    "description" TEXT,
    "starts_at" DATETIME,
    "ends_at" DATETIME,
    "theme_color" TEXT NOT NULL DEFAULT '#ff4655',
    "default_key_ttl_minutes" INTEGER NOT NULL DEFAULT 1440,
    "public_sharing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "maps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name_en" TEXT NOT NULL,
    "name_zh_tw" TEXT NOT NULL,
    "splash_url" TEXT,
    "local_image_path" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "official" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "event_maps" (
    "event_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    PRIMARY KEY ("event_id", "map_id"),
    CONSTRAINT "event_maps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_maps_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "veto_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team_a_name" TEXT NOT NULL,
    "team_a_logo" TEXT,
    "team_b_name" TEXT NOT NULL,
    "team_b_logo" TEXT,
    "opens_at" DATETIME,
    "starts_at" DATETIME,
    "completed_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "overlay_theme" TEXT NOT NULL DEFAULT 'vct-tc',
    "public_sharing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "coin_toss_winner" TEXT,
    "coin_toss_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "veto_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veto_session_id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_sessions_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "veto_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veto_session_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result_order" INTEGER,
    "custom_label" TEXT,
    "side_selection_mode" TEXT NOT NULL DEFAULT 'NONE',
    "side_selector" TEXT,
    "preassigned_side" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "veto_steps_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "veto_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veto_session_id" TEXT NOT NULL,
    "veto_step_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "veto_actions_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "veto_actions_veto_step_id_fkey" FOREIGN KEY ("veto_step_id") REFERENCES "veto_steps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "veto_actions_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "map_side_selections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veto_session_id" TEXT NOT NULL,
    "veto_action_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "selector_side" TEXT NOT NULL,
    "opponent_side" TEXT NOT NULL,
    "is_admin_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "is_decider" BOOLEAN NOT NULL DEFAULT false,
    "from_coin_toss" BOOLEAN NOT NULL DEFAULT false,
    "selected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "map_side_selections_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "map_side_selections_veto_action_id_fkey" FOREIGN KEY ("veto_action_id") REFERENCES "veto_actions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "map_side_selections_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_access_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veto_session_id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "lookup_hash" TEXT NOT NULL,
    "verification_hash" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "last_four" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "last_used_at" DATETIME,
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_access_keys_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "public_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veto_session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_four" TEXT NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_tokens_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "event_id" TEXT,
    "veto_session_id" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "ip_masked" TEXT,
    "details_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "organization_access_keys_lookup_hash_key" ON "organization_access_keys"("lookup_hash");

-- CreateIndex
CREATE UNIQUE INDEX "organization_sessions_token_hash_key" ON "organization_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "events_organization_id_idx" ON "events"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_maps_event_id_sort_order_key" ON "event_maps"("event_id", "sort_order");

-- CreateIndex
CREATE INDEX "veto_sessions_event_id_status_idx" ON "veto_sessions"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_sessions_token_hash_key" ON "team_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "team_sessions_veto_session_id_team_idx" ON "team_sessions"("veto_session_id", "team");

-- CreateIndex
CREATE UNIQUE INDEX "veto_steps_veto_session_id_step_number_key" ON "veto_steps"("veto_session_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "veto_actions_veto_step_id_key" ON "veto_actions"("veto_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "veto_actions_veto_session_id_map_id_key" ON "veto_actions"("veto_session_id", "map_id");

-- CreateIndex
CREATE UNIQUE INDEX "map_side_selections_veto_action_id_key" ON "map_side_selections"("veto_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_access_keys_lookup_hash_key" ON "team_access_keys"("lookup_hash");

-- CreateIndex
CREATE INDEX "team_access_keys_veto_session_id_team_idx" ON "team_access_keys"("veto_session_id", "team");

-- CreateIndex
CREATE UNIQUE INDEX "public_tokens_token_hash_key" ON "public_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "public_tokens_veto_session_id_type_idx" ON "public_tokens"("veto_session_id", "type");

-- CreateIndex
CREATE INDEX "audit_logs_veto_session_id_created_at_idx" ON "audit_logs"("veto_session_id", "created_at");
