/*
  # Add Risk Appetite to Goals (Hedef Bazlı Risk İştahı)

  1. Changes
    - Add `risk_appetite_level` to goals table
      - Options: 'very_low', 'low', 'moderate', 'high', 'very_high'
      - Risk appetite level for the goal

    - Add `risk_appetite_description` to goals table
      - Detailed description of risk appetite (from Kamu Kurumsal Risk Yönetimi Rehberi)
      - Example: "Belediye sınırları içerisinde kalan yolların iyileştirilmesi için gerekli..."

    - Add `risk_appetite_max_score` to goals table
      - Maximum acceptable risk score for this goal
      - Used to identify risks that exceed the goal's risk appetite

  2. Purpose
    - Implements goal-based risk appetite management per Kamu Kurumsal Risk Yönetimi Rehberi
    - Enables tracking of risks that exceed goal-specific risk appetite thresholds
    - Aligns with the framework: AMAÇ → HEDEF → RİSKLER → RİSK İŞTAHI

  3. Security
    - No RLS changes needed (inherits from goals table)
*/

-- Add risk appetite columns to goals table
DO $$
BEGIN
  -- Add risk_appetite_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'risk_appetite_level'
  ) THEN
    ALTER TABLE goals ADD COLUMN risk_appetite_level text CHECK (risk_appetite_level IN ('very_low', 'low', 'moderate', 'high', 'very_high'));
  END IF;

  -- Add risk_appetite_description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'risk_appetite_description'
  ) THEN
    ALTER TABLE goals ADD COLUMN risk_appetite_description text;
  END IF;

  -- Add risk_appetite_max_score
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'risk_appetite_max_score'
  ) THEN
    ALTER TABLE goals ADD COLUMN risk_appetite_max_score integer CHECK (risk_appetite_max_score BETWEEN 1 AND 25);
  END IF;
END $$;

-- Add index for filtering goals by risk appetite level
CREATE INDEX IF NOT EXISTS idx_goals_risk_appetite_level ON goals(risk_appetite_level);

-- Add comment for documentation
COMMENT ON COLUMN goals.risk_appetite_level IS 'Hedefin risk iştahı seviyesi (Çok Düşük, Düşük, Orta, Yüksek, Çok Yüksek)';
COMMENT ON COLUMN goals.risk_appetite_description IS 'Hedefin risk iştahı açıklaması - Kamu Kurumsal Risk Yönetimi Rehberi formatında';
COMMENT ON COLUMN goals.risk_appetite_max_score IS 'Bu hedef için kabul edilebilir maksimum risk skoru (1-25 arası)';