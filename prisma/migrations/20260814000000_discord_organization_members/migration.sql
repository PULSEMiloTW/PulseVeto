CREATE TABLE "organization_discord_members" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "discord_user_id" TEXT NOT NULL,
  "username" TEXT,
  "avatar_url" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "organization_discord_members_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "organization_discord_members_discord_user_id_key"
  ON "organization_discord_members"("discord_user_id");

CREATE INDEX "organization_discord_members_organization_id_idx"
  ON "organization_discord_members"("organization_id");
