-- Fix risk appetite to only three levels: low, moderate, high

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_risk_appetite_level_check;

ALTER TABLE goals ADD CONSTRAINT goals_risk_appetite_level_check 
CHECK (risk_appetite_level = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text]));