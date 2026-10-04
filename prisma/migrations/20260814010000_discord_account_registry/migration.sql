CREATE TABLE "discord_accounts" (
  "discord_user_id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "avatar_url" TEXT,
  "first_login_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "login_count" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX "discord_accounts_last_login_at_idx"
  ON "discord_accounts"("last_login_at");

INSERT INTO "discord_accounts" ("discord_user_id", "username", "avatar_url", "first_login_at", "last_login_at", "login_count")
SELECT "discord_user_id", COALESCE("username", '尚未取得名稱'), "avatar_url", "created_at", "updated_at", 1
FROM "organization_discord_members";
