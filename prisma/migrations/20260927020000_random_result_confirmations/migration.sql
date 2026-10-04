CREATE TABLE "random_confirmations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "veto_session_id" TEXT NOT NULL,
  "veto_action_id" TEXT NOT NULL,
  "team_a_confirmed_at" DATETIME,
  "team_b_confirmed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "random_confirmations_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "random_confirmations_veto_action_id_fkey" FOREIGN KEY ("veto_action_id") REFERENCES "veto_actions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "random_confirmations_veto_action_id_key" ON "random_confirmations"("veto_action_id");
CREATE INDEX "random_confirmations_veto_session_id_idx" ON "random_confirmations"("veto_session_id");
