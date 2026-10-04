PRAGMA foreign_keys=OFF;
CREATE TABLE "new_organization_discord_members" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "discord_user_id" TEXT NOT NULL,
  "username" TEXT,
  "avatar_url" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "organization_discord_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_organization_discord_members" ("id", "organization_id", "discord_user_id", "username", "avatar_url", "created_at", "updated_at") SELECT "id", "organization_id", "discord_user_id", "username", "avatar_url", "created_at", "updated_at" FROM "organization_discord_members";
DROP TABLE "organization_discord_members";
ALTER TABLE "new_organization_discord_members" RENAME TO "organization_discord_members";
CREATE INDEX "organization_discord_members_organization_id_idx" ON "organization_discord_members"("organization_id");
CREATE INDEX "organization_discord_members_discord_user_id_idx" ON "organization_discord_members"("discord_user_id");
CREATE UNIQUE INDEX "organization_discord_members_organization_id_discord_user_id_key" ON "organization_discord_members"("organization_id", "discord_user_id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
