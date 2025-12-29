/*
  # İç Kontrol Tablolarında Silme Constraint'lerini Düzelt

  1. Problem
    - ic_processes, ic_risks, ic_control_tests tablolarındaki foreign key'lerde ON DELETE davranışı eksik
    - Bu, kayıtların silinmesini engelliyor ve 409 hatalarına neden oluyor
    - Kullanıcılar süreç, risk veya test kayıtlarını silemiyor

  2. Değişiklikler
    - ic_risks.process_id: ON DELETE SET NULL (süreç silindiğinde risk kalabilir)
    - ic_controls.process_id: ON DELETE SET NULL (süreç silindiğinde kontrol kalabilir)
    - ic_controls.risk_id: ON DELETE SET NULL (risk silindiğinde kontrol kalabilir)
    - ic_findings.control_test_id: ON DELETE SET NULL (test silindiğinde bulgu kalabilir)
    - ic_findings.risk_id: ON DELETE SET NULL (risk silindiğinde bulgu kalabilir)
    - ic_findings.control_id: ON DELETE SET NULL (kontrol silindiğinde bulgu kalabilir)
    - ic_kiks_actions için yeni constraint'ler

  3. Güvenlik
    - SET NULL kullanarak veri bütünlüğünü koruyoruz
    - Bağımlı kayıtlar silinmiyor, sadece referanslar temizleniyor
    - Audit trail korunuyor
*/

-- ic_risks tablosu - process_id constraint'ini düzelt
ALTER TABLE ic_risks
  DROP CONSTRAINT IF EXISTS ic_risks_process_id_fkey;

ALTER TABLE ic_risks
  ADD CONSTRAINT ic_risks_process_id_fkey
  FOREIGN KEY (process_id) REFERENCES ic_processes(id) ON DELETE SET NULL;

-- ic_controls tablosu - process_id constraint'ini düzelt
ALTER TABLE ic_controls
  DROP CONSTRAINT IF EXISTS ic_controls_process_id_fkey;

ALTER TABLE ic_controls
  ADD CONSTRAINT ic_controls_process_id_fkey
  FOREIGN KEY (process_id) REFERENCES ic_processes(id) ON DELETE SET NULL;

-- ic_controls tablosu - risk_id constraint'ini düzelt
ALTER TABLE ic_controls
  DROP CONSTRAINT IF EXISTS ic_controls_risk_id_fkey;

ALTER TABLE ic_controls
  ADD CONSTRAINT ic_controls_risk_id_fkey
  FOREIGN KEY (risk_id) REFERENCES ic_risks(id) ON DELETE SET NULL;

-- ic_findings tablosu - control_test_id constraint'ini düzelt
ALTER TABLE ic_findings
  DROP CONSTRAINT IF EXISTS ic_findings_control_test_id_fkey;

ALTER TABLE ic_findings
  ADD CONSTRAINT ic_findings_control_test_id_fkey
  FOREIGN KEY (control_test_id) REFERENCES ic_control_tests(id) ON DELETE SET NULL;

-- ic_findings tablosu - risk_id constraint'ini düzelt
ALTER TABLE ic_findings
  DROP CONSTRAINT IF EXISTS ic_findings_risk_id_fkey;

ALTER TABLE ic_findings
  ADD CONSTRAINT ic_findings_risk_id_fkey
  FOREIGN KEY (risk_id) REFERENCES ic_risks(id) ON DELETE SET NULL;

-- ic_findings tablosu - control_id constraint'ini düzelt
ALTER TABLE ic_findings
  DROP CONSTRAINT IF EXISTS ic_findings_control_id_fkey;

ALTER TABLE ic_findings
  ADD CONSTRAINT ic_findings_control_id_fkey
  FOREIGN KEY (control_id) REFERENCES ic_controls(id) ON DELETE SET NULL;

-- ic_process_steps tablosu için
ALTER TABLE ic_process_steps
  DROP CONSTRAINT IF EXISTS ic_process_steps_process_id_fkey;

ALTER TABLE ic_process_steps
  ADD CONSTRAINT ic_process_steps_process_id_fkey
  FOREIGN KEY (process_id) REFERENCES ic_processes(id) ON DELETE CASCADE;

-- ic_activity_process_mappings tablosu için (eğer varsa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ic_activity_process_mappings'
  ) THEN
    ALTER TABLE ic_activity_process_mappings
      DROP CONSTRAINT IF EXISTS ic_activity_process_mappings_process_id_fkey;

    ALTER TABLE ic_activity_process_mappings
      ADD CONSTRAINT ic_activity_process_mappings_process_id_fkey
      FOREIGN KEY (process_id) REFERENCES ic_processes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ic_activity_risk_mappings tablosu için (eğer varsa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ic_activity_risk_mappings'
  ) THEN
    ALTER TABLE ic_activity_risk_mappings
      DROP CONSTRAINT IF EXISTS ic_activity_risk_mappings_risk_id_fkey;

    ALTER TABLE ic_activity_risk_mappings
      ADD CONSTRAINT ic_activity_risk_mappings_risk_id_fkey
      FOREIGN KEY (risk_id) REFERENCES ic_risks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ic_kiks_actions tablosu için constraint ekle (eğer yoksa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ic_kiks_actions'
  ) THEN
    -- control_test_id için
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ic_kiks_actions'
      AND column_name = 'control_test_id'
    ) THEN
      ALTER TABLE ic_kiks_actions
        DROP CONSTRAINT IF EXISTS ic_kiks_actions_control_test_id_fkey;

      ALTER TABLE ic_kiks_actions
        ADD CONSTRAINT ic_kiks_actions_control_test_id_fkey
        FOREIGN KEY (control_test_id) REFERENCES ic_control_tests(id) ON DELETE SET NULL;
    END IF;

    -- finding_id için
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ic_kiks_actions'
      AND column_name = 'finding_id'
    ) THEN
      ALTER TABLE ic_kiks_actions
        DROP CONSTRAINT IF EXISTS ic_kiks_actions_finding_id_fkey;

      ALTER TABLE ic_kiks_actions
        ADD CONSTRAINT ic_kiks_actions_finding_id_fkey
        FOREIGN KEY (finding_id) REFERENCES ic_findings(id) ON DELETE SET NULL;
    END IF;

    -- control_id için
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ic_kiks_actions'
      AND column_name = 'control_id'
    ) THEN
      ALTER TABLE ic_kiks_actions
        DROP CONSTRAINT IF EXISTS ic_kiks_actions_control_id_fkey;

      ALTER TABLE ic_kiks_actions
        ADD CONSTRAINT ic_kiks_actions_control_id_fkey
        FOREIGN KEY (control_id) REFERENCES ic_controls(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ic_automatic_action_queue için
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ic_automatic_action_queue'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ic_automatic_action_queue'
      AND column_name = 'control_test_id'
    ) THEN
      ALTER TABLE ic_automatic_action_queue
        DROP CONSTRAINT IF EXISTS ic_automatic_action_queue_control_test_id_fkey;

      ALTER TABLE ic_automatic_action_queue
        ADD CONSTRAINT ic_automatic_action_queue_control_test_id_fkey
        FOREIGN KEY (control_test_id) REFERENCES ic_control_tests(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ic_automatic_action_queue'
      AND column_name = 'risk_id'
    ) THEN
      ALTER TABLE ic_automatic_action_queue
        DROP CONSTRAINT IF EXISTS ic_automatic_action_queue_risk_id_fkey;

      ALTER TABLE ic_automatic_action_queue
        ADD CONSTRAINT ic_automatic_action_queue_risk_id_fkey
        FOREIGN KEY (risk_id) REFERENCES ic_risks(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- collaboration_plan_items için (eğer ic_risk_id kolonu varsa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaboration_plan_items'
    AND column_name = 'ic_risk_id'
  ) THEN
    ALTER TABLE collaboration_plan_items
      DROP CONSTRAINT IF EXISTS collaboration_plan_items_ic_risk_id_fkey;

    ALTER TABLE collaboration_plan_items
      ADD CONSTRAINT collaboration_plan_items_ic_risk_id_fkey
      FOREIGN KEY (ic_risk_id) REFERENCES ic_risks(id) ON DELETE SET NULL;
  END IF;
END $$;
