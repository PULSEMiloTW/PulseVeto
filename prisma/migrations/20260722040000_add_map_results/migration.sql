CREATE TABLE "map_results" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "veto_session_id" TEXT NOT NULL,
  "veto_action_id" TEXT NOT NULL,
  "team_a_score" INTEGER NOT NULL DEFAULT 0,
  "team_b_score" INTEGER NOT NULL DEFAULT 0,
  "winner" TEXT,
  "is_next_map" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "map_results_veto_session_id_fkey" FOREIGN KEY ("veto_session_id") REFERENCES "veto_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "map_results_veto_action_id_fkey" FOREIGN KEY ("veto_action_id") REFERENCES "veto_actions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "map_results_veto_action_id_key" ON "map_results"("veto_action_id");
CREATE INDEX "map_results_veto_session_id_idx" ON "map_results"("veto_session_id");
