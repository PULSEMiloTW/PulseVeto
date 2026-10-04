-- Bo5 決勝圖由系統自動指定，並交由 Team A 選邊。
-- 同步修正既有尚未或正在進行的 Bo5，已完成的選邊紀錄不受影響。
UPDATE "veto_steps"
SET "side_selector" = 'TEAM_A'
WHERE "action" = 'DECIDER'
  AND "veto_session_id" IN (
    SELECT "id"
    FROM "veto_sessions"
    WHERE "best_of" = 5
  );
