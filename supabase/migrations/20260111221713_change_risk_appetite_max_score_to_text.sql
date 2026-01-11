-- Change risk_appetite_max_score from integer to text

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_risk_appetite_max_score_check;

ALTER TABLE goals ALTER COLUMN risk_appetite_max_score TYPE text USING risk_appetite_max_score::text;