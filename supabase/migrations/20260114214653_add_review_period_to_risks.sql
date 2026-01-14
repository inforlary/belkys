/*
  # Risk Gözden Geçirme Periyodu ve Hatırlatma Sistemi

  1. Yeni Alanlar
    - `review_period` (VARCHAR) - Gözden geçirme periyodu (MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL)
    - `last_review_date` (DATE) - Son gözden geçirme tarihi
    - `next_review_date` (DATE) - Sonraki gözden geçirme tarihi

  2. Özellikler
    - Review period değerleri için constraint
    - Otomatik indeks next_review_date için
    - Gözden geçirme tarihlerini izleme
*/

-- Add review period columns to risks table
ALTER TABLE risks
ADD COLUMN IF NOT EXISTS review_period VARCHAR(20),
ADD COLUMN IF NOT EXISTS last_review_date DATE,
ADD COLUMN IF NOT EXISTS next_review_date DATE;

-- Add check constraint for review_period values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'risks_review_period_check'
  ) THEN
    ALTER TABLE risks
    ADD CONSTRAINT risks_review_period_check
    CHECK (review_period IN ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'));
  END IF;
END $$;

-- Create index for efficient querying of upcoming reviews
CREATE INDEX IF NOT EXISTS idx_risks_next_review_date
ON risks(next_review_date)
WHERE next_review_date IS NOT NULL AND is_active = true;

-- Create index for review period filtering
CREATE INDEX IF NOT EXISTS idx_risks_review_period
ON risks(review_period)
WHERE review_period IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN risks.review_period IS 'Review frequency: MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL';
COMMENT ON COLUMN risks.last_review_date IS 'Date of last risk review';
COMMENT ON COLUMN risks.next_review_date IS 'Scheduled date for next review';

-- Create function to calculate next review date
CREATE OR REPLACE FUNCTION calculate_next_review_date(
  last_date DATE,
  period VARCHAR
) RETURNS DATE AS $$
BEGIN
  CASE period
    WHEN 'MONTHLY' THEN RETURN last_date + INTERVAL '1 month';
    WHEN 'QUARTERLY' THEN RETURN last_date + INTERVAL '3 months';
    WHEN 'SEMI_ANNUAL' THEN RETURN last_date + INTERVAL '6 months';
    WHEN 'ANNUAL' THEN RETURN last_date + INTERVAL '1 year';
    ELSE RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get risks due for review
CREATE OR REPLACE FUNCTION get_risks_due_for_review(
  org_id UUID,
  days_ahead INT DEFAULT 7
) RETURNS TABLE (
  risk_id UUID,
  risk_code VARCHAR,
  risk_name TEXT,
  next_review_date DATE,
  days_until_review INT,
  is_overdue BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.code,
    r.name,
    r.next_review_date,
    (r.next_review_date - CURRENT_DATE)::INT as days_until,
    (r.next_review_date < CURRENT_DATE) as overdue
  FROM risks r
  WHERE r.organization_id = org_id
    AND r.is_active = true
    AND r.next_review_date IS NOT NULL
    AND r.next_review_date <= CURRENT_DATE + days_ahead
  ORDER BY r.next_review_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION calculate_next_review_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_risks_due_for_review TO authenticated;