/*
  # İşbirliği Planlama Sistemi Geliştirmeleri

  1. Değişiklikler
    - `collaboration_plans` tablosuna `goal_id` eklendi (hedeflere bağlı)
    - Yeni tablo: `collaboration_plan_cost_estimates` (yıl bazlı maliyet tahmini)
    - `total_budget` kaldırıldı (artık cost_estimates toplamından hesaplanacak)
    
  2. Yeni Tablo: collaboration_plan_cost_estimates
    - plan_id: İşbirliği planı referansı
    - year: Yıl
    - amount: Tutar
    - Her plan için yıl bazlı maliyet takibi
    
  3. Özellikler
    - Hedef bazlı işbirliği planlaması
    - Çok yıllı maliyet tahmini
    - Otomatik toplam hesaplama
*/

-- collaboration_plans tablosuna goal_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaboration_plans' AND column_name = 'goal_id'
  ) THEN
    ALTER TABLE collaboration_plans ADD COLUMN goal_id uuid REFERENCES goals(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_collaboration_plans_goal ON collaboration_plans(goal_id);
  END IF;
END $$;

-- Yıl bazlı maliyet tahmini tablosu
CREATE TABLE IF NOT EXISTS collaboration_plan_cost_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES collaboration_plans(id) ON DELETE CASCADE,
  year integer NOT NULL,
  amount numeric(15, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, year)
);

CREATE INDEX IF NOT EXISTS idx_cost_estimates_plan ON collaboration_plan_cost_estimates(plan_id);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_year ON collaboration_plan_cost_estimates(year);

-- RLS for cost_estimates
ALTER TABLE collaboration_plan_cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cost estimates for their org plans"
  ON collaboration_plan_cost_estimates FOR SELECT
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM collaboration_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can insert cost estimates"
  ON collaboration_plan_cost_estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    plan_id IN (
      SELECT id FROM collaboration_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can update cost estimates"
  ON collaboration_plan_cost_estimates FOR UPDATE
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM collaboration_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can delete cost estimates"
  ON collaboration_plan_cost_estimates FOR DELETE
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM collaboration_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- Updated_at trigger for cost_estimates
CREATE OR REPLACE FUNCTION update_cost_estimate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cost_estimates_updated_at
  BEFORE UPDATE ON collaboration_plan_cost_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_cost_estimate_updated_at();
