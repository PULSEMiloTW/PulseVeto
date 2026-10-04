-- Bo5 決勝圖由系統自動指定，並交由 Team B 選邊。
-- 已完成的實際選邊紀錄保存在 map_side_selections，不由此 migration 改寫。
UPDATE "veto_steps"
SET "side_selector" = 'TEAM_B'
WHERE "action" = 'DECIDER'
  AND "veto_session_id" IN (
    SELECT "id"
    FROM "veto_sessions"
    WHERE "best_of" = 5
  );
