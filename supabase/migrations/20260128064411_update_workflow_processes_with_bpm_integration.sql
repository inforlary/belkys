/*
  # İş Akış Şemaları - BPM Süreç Entegrasyonu

  1. Değişiklikler
    - `workflow_processes` tablosundan kaldırılan kolonlar:
      - `main_process` (text) - Manuel süreç adı
      - `process` (text) - Manuel süreç adı
      - `sub_process` (text) - Manuel alt süreç adı

    - `workflow_processes` tablosuna eklenen kolonlar:
      - `bpm_process_id` (uuid, nullable) - BPM süreçlerine referans

  2. Otomatik Kod Üretimi
    - Fonksiyon: `generate_workflow_code()`
    - Format: WF-001, WF-002, WF-003...
    - Organizasyon bazında otomatik sıralama
    - Kod alanı NULL ise otomatik üretilir

  3. Güvenlik
    - Foreign key constraint ile BPM süreçlerine bağlantı
    - Mevcut RLS politikaları korunur
*/

-- Remove old columns from workflow_processes
ALTER TABLE workflow_processes
DROP COLUMN IF EXISTS main_process,
DROP COLUMN IF EXISTS process,
DROP COLUMN IF EXISTS sub_process;

-- Add new BPM process reference column
ALTER TABLE workflow_processes
ADD COLUMN IF NOT EXISTS bpm_process_id uuid REFERENCES bpm_processes(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_processes_bpm_process_id
ON workflow_processes(bpm_process_id);

-- Function to generate automatic workflow code
CREATE OR REPLACE FUNCTION generate_workflow_code(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_number integer;
  new_code text;
BEGIN
  -- Get the maximum existing number for this organization
  SELECT COALESCE(
    MAX(
      CASE
        WHEN code ~ '^WF-[0-9]+$'
        THEN substring(code from 'WF-([0-9]+)')::integer
        ELSE 0
      END
    ),
    0
  )
  INTO max_number
  FROM workflow_processes
  WHERE organization_id = org_id;

  -- Generate new code with incremented number
  new_code := 'WF-' || LPAD((max_number + 1)::text, 3, '0');

  RETURN new_code;
END;
$$;

-- Trigger function to auto-generate workflow code
CREATE OR REPLACE FUNCTION auto_generate_workflow_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only generate code if it's NULL or empty
  IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
    NEW.code := generate_workflow_code(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating workflow codes on insert
DROP TRIGGER IF EXISTS trigger_auto_generate_workflow_code ON workflow_processes;
CREATE TRIGGER trigger_auto_generate_workflow_code
  BEFORE INSERT ON workflow_processes
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_workflow_code();

-- Update existing workflows that don't have proper codes
DO $$
DECLARE
  workflow_record RECORD;
  new_code text;
BEGIN
  FOR workflow_record IN
    SELECT id, organization_id, code
    FROM workflow_processes
    WHERE code IS NULL OR TRIM(code) = '' OR code !~ '^WF-[0-9]+$'
  LOOP
    new_code := generate_workflow_code(workflow_record.organization_id);

    UPDATE workflow_processes
    SET code = new_code
    WHERE id = workflow_record.id;
  END LOOP;
END $$;
