/*
  # Risk Onay İş Akışı Sistemi

  1. Değişiklikler
    - `risks` tablosuna onay iş akışı için kolonlar eklendi:
      - `submitted_at` - Onaya gönderilme tarihi
      - `submitted_by_id` - Onaya gönderen kullanıcı
      - `reviewed_at` - Müdür inceleme tarihi
      - `reviewed_by_id` - İnceleyen müdür
      - `approved_at` - Yönetici onay tarihi
      - `approved_by_id` - Onaylayan yönetici
      - `rejection_reason` - Red gerekçesi

  2. İş Akışı
    - DRAFT: Taslak (Kullanıcı/Müdür tarafından oluşturuldu)
    - IN_REVIEW: İncelemede (Müdür inceliyor)
    - PENDING_APPROVAL: Onay Bekliyor (Yönetici onaylayacak)
    - APPROVED: Onaylandı
    - REJECTED: Reddedildi
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE risks ADD COLUMN submitted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'submitted_by_id'
  ) THEN
    ALTER TABLE risks ADD COLUMN submitted_by_id uuid REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE risks ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'reviewed_by_id'
  ) THEN
    ALTER TABLE risks ADD COLUMN reviewed_by_id uuid REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE risks ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'approved_by_id'
  ) THEN
    ALTER TABLE risks ADD COLUMN approved_by_id uuid REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE risks ADD COLUMN rejection_reason text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_risks_submitted_by ON risks(submitted_by_id);
CREATE INDEX IF NOT EXISTS idx_risks_reviewed_by ON risks(reviewed_by_id);
CREATE INDEX IF NOT EXISTS idx_risks_approved_by ON risks(approved_by_id);
CREATE INDEX IF NOT EXISTS idx_risks_approval_status ON risks(approval_status);
CREATE INDEX IF NOT EXISTS idx_risks_submitted_at ON risks(submitted_at);
