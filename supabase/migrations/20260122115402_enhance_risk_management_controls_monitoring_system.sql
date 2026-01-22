/*
  # Enhance Risk Management: Controls, Treatments and Monitoring System

  1. New Features
    - Auto-generated control codes with format K-YYYY-XXX (year auto-updates)
    - Auto-generated action codes with format E-YYYY-XXX (year auto-updates)
    - Auto-generated monitoring codes with format IZ-YYYY-XXX (year auto-updates)
    - File storage as base64 in database for controls, treatments and evidence
    - Quarterly monitoring records (Q1, Q2, Q3, Q4)
    
  2. Table Updates
    - Add missing columns to risk_controls table
    - Add missing columns to risk_treatments table
    - Create risk_monitoring_records table
    
  3. Functions
    - Auto-code generation functions for controls, treatments, and monitoring
    - Triggers for automatic code assignment
    
  4. Security
    - RLS policies for all new tables and columns
*/

-- Add missing columns to risk_controls
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_controls' AND column_name = 'code'
  ) THEN
    ALTER TABLE risk_controls ADD COLUMN code text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_controls' AND column_name = 'responsible_person_id'
  ) THEN
    ALTER TABLE risk_controls ADD COLUMN responsible_person_id uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_controls' AND column_name = 'effectiveness_status'
  ) THEN
    ALTER TABLE risk_controls ADD COLUMN effectiveness_status text CHECK (effectiveness_status IN ('Etkili', 'Kısmen Etkili', 'Etkisiz'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_controls' AND column_name = 'evidence_file'
  ) THEN
    ALTER TABLE risk_controls ADD COLUMN evidence_file text;
  END IF;
END $$;

-- Add missing columns to risk_treatments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'code'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN code text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'resources_required'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN resources_required text CHECK (resources_required IN ('Bütçe', 'Personel', 'Yazılım', 'Eğitim'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'actual_cost'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN actual_cost decimal(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'evidence_file'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN evidence_file text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'resource_type'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN resource_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'responsible_person_id'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN responsible_person_id uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'target_date'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN target_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'risk_treatments' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE risk_treatments ADD COLUMN progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
  END IF;
END $$;

-- Create risk_monitoring_records table
CREATE TABLE IF NOT EXISTS risk_monitoring_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monitoring_number text UNIQUE,
  quarter text NOT NULL,
  monitoring_date date NOT NULL DEFAULT CURRENT_DATE,
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  current_likelihood integer NOT NULL CHECK (current_likelihood >= 1 AND current_likelihood <= 5),
  current_impact integer NOT NULL CHECK (current_impact >= 1 AND current_impact <= 5),
  current_score integer NOT NULL,
  previous_score integer,
  score_change text CHECK (score_change IN ('Arttı', 'Aynı', 'Azaldı')),
  controls_applied text,
  controls_effectiveness text CHECK (controls_effectiveness IN ('Tümü Etkili', 'Kısmen Etkili', 'Etkisiz')),
  actions_on_time integer DEFAULT 0,
  delayed_actions integer DEFAULT 0,
  assessment_notes text,
  action_recommendations text,
  monitored_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on risk_monitoring_records
ALTER TABLE risk_monitoring_records ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risk_monitoring_records_org ON risk_monitoring_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_monitoring_records_risk ON risk_monitoring_records(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_monitoring_records_quarter ON risk_monitoring_records(quarter);
CREATE INDEX IF NOT EXISTS idx_risk_controls_code ON risk_controls(code);
CREATE INDEX IF NOT EXISTS idx_risk_treatments_code ON risk_treatments(code);

-- Function to generate control code (K-YYYY-XXX format)
CREATE OR REPLACE FUNCTION generate_control_code(org_id uuid)
RETURNS text AS $$
DECLARE
  current_year text;
  next_number integer;
  new_code text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN code ~ ('^K-' || current_year || '-[0-9]+$') 
      THEN substring(code from '[0-9]+$')::integer 
      ELSE 0 
    END
  ), 0) + 1
  INTO next_number
  FROM risk_controls
  WHERE organization_id = org_id;
  
  new_code := 'K-' || current_year || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate treatment/action code (E-YYYY-XXX format)
CREATE OR REPLACE FUNCTION generate_treatment_code(org_id uuid)
RETURNS text AS $$
DECLARE
  current_year text;
  next_number integer;
  new_code text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN code ~ ('^E-' || current_year || '-[0-9]+$') 
      THEN substring(code from '[0-9]+$')::integer 
      ELSE 0 
    END
  ), 0) + 1
  INTO next_number
  FROM risk_treatments
  WHERE organization_id = org_id;
  
  new_code := 'E-' || current_year || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate monitoring code (IZ-YYYY-XXX format)
CREATE OR REPLACE FUNCTION generate_monitoring_code(org_id uuid)
RETURNS text AS $$
DECLARE
  current_year text;
  next_number integer;
  new_code text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN monitoring_number ~ ('^IZ-' || current_year || '-[0-9]+$') 
      THEN substring(monitoring_number from '[0-9]+$')::integer 
      ELSE 0 
    END
  ), 0) + 1
  INTO next_number
  FROM risk_monitoring_records
  WHERE organization_id = org_id;
  
  new_code := 'IZ-' || current_year || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-generate control code
CREATE OR REPLACE FUNCTION auto_generate_control_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_control_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_control_code ON risk_controls;
CREATE TRIGGER trigger_auto_control_code
  BEFORE INSERT ON risk_controls
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_control_code();

-- Trigger to auto-generate treatment code
CREATE OR REPLACE FUNCTION auto_generate_treatment_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_treatment_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_treatment_code ON risk_treatments;
CREATE TRIGGER trigger_auto_treatment_code
  BEFORE INSERT ON risk_treatments
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_treatment_code();

-- Trigger to auto-generate monitoring code
CREATE OR REPLACE FUNCTION auto_generate_monitoring_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.monitoring_number IS NULL THEN
    NEW.monitoring_number := generate_monitoring_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_monitoring_code ON risk_monitoring_records;
CREATE TRIGGER trigger_auto_monitoring_code
  BEFORE INSERT ON risk_monitoring_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_monitoring_code();

-- RLS Policies for risk_monitoring_records
CREATE POLICY "Users can view monitoring records from their organization"
  ON risk_monitoring_records FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create monitoring records for their organization"
  ON risk_monitoring_records FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update monitoring records from their organization"
  ON risk_monitoring_records FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete monitoring records"
  ON risk_monitoring_records FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
    )
  );