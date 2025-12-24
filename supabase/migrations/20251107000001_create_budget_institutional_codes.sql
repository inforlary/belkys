CREATE TABLE IF NOT EXISTS budget_institutional_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  il_kodu varchar(2) NOT NULL CHECK (il_kodu ~ '^\d{2}$'),
  il_adi varchar(50) NOT NULL,
  mahalli_idare_turu smallint NOT NULL CHECK (mahalli_idare_turu BETWEEN 1 AND 4),
  kurum_kodu varchar(2) NOT NULL CHECK (kurum_kodu ~ '^\d{2}$'),
  kurum_adi varchar(100) NOT NULL,
  birim_kodu varchar(2) NOT NULL CHECK (birim_kodu ~ '^\d{2}$'),
  birim_adi varchar(100) NOT NULL,
  tam_kod varchar(15),
  aciklama text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  UNIQUE(organization_id, il_kodu, mahalli_idare_turu, kurum_kodu, birim_kodu)
);

CREATE INDEX idx_budget_institutional_codes_org ON budget_institutional_codes(organization_id);
CREATE INDEX idx_budget_institutional_codes_il ON budget_institutional_codes(il_kodu);
CREATE INDEX idx_budget_institutional_codes_kurum ON budget_institutional_codes(kurum_kodu);
CREATE INDEX idx_budget_institutional_codes_active ON budget_institutional_codes(is_active);
CREATE INDEX idx_budget_institutional_codes_tam_kod ON budget_institutional_codes(tam_kod);

CREATE OR REPLACE FUNCTION generate_budget_institutional_tam_kod()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tam_kod := NEW.il_kodu || '.' || NEW.mahalli_idare_turu || '.' || NEW.kurum_kodu || '.' || NEW.birim_kodu;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_institutional_codes_generate_tam_kod
  BEFORE INSERT OR UPDATE ON budget_institutional_codes
  FOR EACH ROW
  EXECUTE FUNCTION generate_budget_institutional_tam_kod();

ALTER TABLE budget_institutional_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget institutional codes in their organization"
  ON budget_institutional_codes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert budget institutional codes"
  ON budget_institutional_codes FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can update budget institutional codes"
  ON budget_institutional_codes FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can delete budget institutional codes"
  ON budget_institutional_codes FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'budget_institutional_code_id') THEN
    ALTER TABLE departments ADD COLUMN budget_institutional_code_id uuid REFERENCES budget_institutional_codes(id);
    CREATE INDEX idx_departments_budget_institutional_code ON departments(budget_institutional_code_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_programs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budget_programs' AND column_name = 'budget_institutional_code_id') THEN
      ALTER TABLE budget_programs ADD COLUMN budget_institutional_code_id uuid REFERENCES budget_institutional_codes(id);
      CREATE INDEX idx_budget_programs_budget_institutional_code ON budget_programs(budget_institutional_code_id);
    END IF;
  END IF;
END $$;
