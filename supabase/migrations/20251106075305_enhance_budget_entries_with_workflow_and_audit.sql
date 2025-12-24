/*
  # Bütçe Fiş Onay Akışı ve Denetim İzi Sistemi
  
  1. Tablo Değişiklikleri
    - `expense_budget_entries` ve `revenue_budget_entries` tablolarına eklemeler:
      - `status` - Fiş durumu (draft, pending_approval, approved, posted, rejected)
      - `department_id` - Hangi müdürlük oluşturdu
      - `approved_by` - Kim onayladı (Mali İşler Müdürü)
      - `approved_at` - Ne zaman onaylandı
      - `posted_by` - Kim muhasebeleştirdi (Gerçekleştirme Görevlisi/Muhasebe)
      - `posted_at` - Ne zaman muhasebeleştirildi
      - `rejection_reason` - Reddedilme sebebi
      - `last_modified_by` - Son değişikliği yapan
      
  2. Yeni Tablolar
    - `budget_entry_audit_log` - Tüm değişikliklerin detaylı kaydı
      - Her alan değişikliği ayrı satır olarak kaydedilir
      - Kimin, ne zaman, hangi alanı, eski değer, yeni değer
    
    - `budget_entry_comments` - Fişlere yorum ekleme
      - Onaylayıcı veya reddeden kişi yorum bırakabilir
  
  3. Workflow Kuralları
    - **TASLAK (draft)**: Müdürlük kullanıcısı oluşturur, düzenleyebilir
    - **ONAY BEKLİYOR (pending_approval)**: Müdürlük onaya gönderir, artık düzenleyemez
    - **ONAYLANDI (approved)**: Mali İşler Müdürü onaylar, düzenleyebilir
    - **MUHASEBELEŞTİ (posted)**: Muhasebe kayıtlara alır, kimse düzenleyemez
    - **REDDEDİLDİ (rejected)**: Mali İşler reddeder, müdürlük tekrar düzenleyebilir
  
  4. RLS Politikaları
    - Müdürlük: Kendi departmanının fişlerini görür, taslak oluşturur
    - Mali İşler (spending_authority): Tüm fişleri görür, onaylar, düzenler
    - Muhasebe (realization_officer/accountant): Onaylanmış fişleri muhasebeleştirir
    - Admin: Her şeyi yapabilir
  
  5. Trigger'lar
    - Her UPDATE işleminde audit log'a otomatik kayıt
    - updated_at ve last_modified_by otomatik güncelleme
*/

-- 1. EXPENSE_BUDGET_ENTRIES tablosunu güncelle
DO $$ 
BEGIN
  -- Status kolonu ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'status'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected'));
  END IF;
  
  -- Department_id ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE RESTRICT;
  END IF;
  
  -- Onay bilgileri
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN approved_at timestamptz;
  END IF;
  
  -- Muhasebeleştirme bilgileri
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'posted_by'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN posted_by uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'posted_at'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN posted_at timestamptz;
  END IF;
  
  -- Red sebebi
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN rejection_reason text;
  END IF;
  
  -- Son değiştiren
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_budget_entries' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN last_modified_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- 2. REVENUE_BUDGET_ENTRIES tablosunu güncelle (aynı yapı)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'status'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE RESTRICT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN approved_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'posted_by'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN posted_by uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'posted_at'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN posted_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN rejection_reason text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN last_modified_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- 3. Denetim İzi (Audit Log) Tablosu
CREATE TABLE IF NOT EXISTS budget_entry_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('expense', 'revenue')),
  entry_id uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES profiles(id),
  changed_at timestamptz DEFAULT now(),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'approved', 'rejected', 'posted', 'deleted')),
  field_name text,
  old_value text,
  new_value text,
  change_reason text
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entry ON budget_entry_audit_log(entry_type, entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON budget_entry_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON budget_entry_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON budget_entry_audit_log(changed_at);

ALTER TABLE budget_entry_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON budget_entry_audit_log FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'spending_authority', 'realization_officer', 'accountant')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON budget_entry_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND changed_by = auth.uid()
  );

-- 4. Yorumlar Tablosu
CREATE TABLE IF NOT EXISTS budget_entry_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('expense', 'revenue')),
  entry_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id),
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entry ON budget_entry_comments(entry_type, entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON budget_entry_comments(user_id);

ALTER TABLE budget_entry_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments in their organization"
  ON budget_entry_comments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can add comments"
  ON budget_entry_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- 5. TRIGGER: Otomatik Audit Log
CREATE OR REPLACE FUNCTION log_budget_entry_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_entry_type text;
BEGIN
  -- Entry type'ı belirle
  IF TG_TABLE_NAME = 'expense_budget_entries' THEN
    v_entry_type := 'expense';
  ELSE
    v_entry_type := 'revenue';
  END IF;
  
  -- Organization ID'yi al
  v_org_id := NEW.organization_id;
  
  -- INSERT işlemi
  IF TG_OP = 'INSERT' THEN
    INSERT INTO budget_entry_audit_log (
      organization_id, entry_type, entry_id, changed_by, action
    ) VALUES (
      v_org_id, v_entry_type, NEW.id, NEW.created_by, 'created'
    );
    RETURN NEW;
  END IF;
  
  -- UPDATE işlemi - Değişen alanları kaydet
  IF TG_OP = 'UPDATE' THEN
    -- Status değişikliği
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO budget_entry_audit_log (
        organization_id, entry_type, entry_id, changed_by, action, field_name, old_value, new_value
      ) VALUES (
        v_org_id, v_entry_type, NEW.id, auth.uid(), 'status_changed', 'status', OLD.status, NEW.status
      );
    END IF;
    
    -- Description değişikliği
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO budget_entry_audit_log (
        organization_id, entry_type, entry_id, changed_by, action, field_name, old_value, new_value
      ) VALUES (
        v_org_id, v_entry_type, NEW.id, auth.uid(), 'updated', 'description', OLD.description, NEW.description
      );
    END IF;
    
    -- Program değişikliği
    IF OLD.program_id IS DISTINCT FROM NEW.program_id THEN
      INSERT INTO budget_entry_audit_log (
        organization_id, entry_type, entry_id, changed_by, action, field_name, old_value, new_value
      ) VALUES (
        v_org_id, v_entry_type, NEW.id, auth.uid(), 'updated', 'program_id', OLD.program_id::text, NEW.program_id::text
      );
    END IF;
    
    -- Institutional code değişikliği
    IF OLD.institutional_code_id IS DISTINCT FROM NEW.institutional_code_id THEN
      INSERT INTO budget_entry_audit_log (
        organization_id, entry_type, entry_id, changed_by, action, field_name, old_value, new_value
      ) VALUES (
        v_org_id, v_entry_type, NEW.id, auth.uid(), 'updated', 'institutional_code_id', OLD.institutional_code_id::text, NEW.institutional_code_id::text
      );
    END IF;
    
    -- Last modified by güncelle
    NEW.last_modified_by := auth.uid();
    NEW.updated_at := now();
    
    RETURN NEW;
  END IF;
  
  -- DELETE işlemi
  IF TG_OP = 'DELETE' THEN
    INSERT INTO budget_entry_audit_log (
      organization_id, entry_type, entry_id, changed_by, action
    ) VALUES (
      v_org_id, v_entry_type, OLD.id, auth.uid(), 'deleted'
    );
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ları oluştur
DROP TRIGGER IF EXISTS expense_entry_audit_trigger ON expense_budget_entries;
CREATE TRIGGER expense_entry_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON expense_budget_entries
  FOR EACH ROW EXECUTE FUNCTION log_budget_entry_changes();

DROP TRIGGER IF EXISTS revenue_entry_audit_trigger ON revenue_budget_entries;
CREATE TRIGGER revenue_entry_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON revenue_budget_entries
  FOR EACH ROW EXECUTE FUNCTION log_budget_entry_changes();

-- 6. YENİ RLS POLİTİKALARI (eskilerini değiştir)

-- EXPENSE_BUDGET_ENTRIES için yeni politikalar
DROP POLICY IF EXISTS "Users can view expense entries in their organization" ON expense_budget_entries;
DROP POLICY IF EXISTS "Users can insert expense entries in their department" ON expense_budget_entries;
DROP POLICY IF EXISTS "Users can update their own expense entries" ON expense_budget_entries;
DROP POLICY IF EXISTS "Users can delete their own expense entries" ON expense_budget_entries;

-- SELECT: Herkes kendi organizasyonundakileri görebilir, ama müdürlük sadece kendi departmanını görür
CREATE POLICY "Users can view expense entries based on role"
  ON expense_budget_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admin ve mali yetkilileri her şeyi görebilir
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'spending_authority', 'realization_officer', 'accountant')
      )
      OR
      -- Müdürlük kullanıcısı sadece kendi departmanını görür
      department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  );

-- INSERT: Müdürlük kullanıcısı kendi departmanı için taslak oluşturabilir
CREATE POLICY "Department users can create draft expense entries"
  ON expense_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND status = 'draft'
  );

-- UPDATE: Karmaşık kurallar
CREATE POLICY "Users can update expense entries based on status and role"
  ON expense_budget_entries FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admin her şeyi güncelleyebilir
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
      OR
      -- Müdürlük kullanıcısı: sadece kendi taslak veya reddedilmiş fişlerini güncelleyebilir
      (
        created_by = auth.uid()
        AND department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
        AND status IN ('draft', 'rejected')
      )
      OR
      -- Mali İşler: onay bekleyen ve onaylanmış fişleri güncelleyebilir
      (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role = 'spending_authority'
        )
        AND status IN ('pending_approval', 'approved')
      )
      OR
      -- Muhasebe: onaylanmış fişleri muhasebeleştirebilir
      (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role IN ('realization_officer', 'accountant')
        )
        AND status = 'approved'
      )
    )
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- DELETE: Sadece taslak durumda ve kendi oluşturduğu veya admin
CREATE POLICY "Users can delete draft expense entries"
  ON expense_budget_entries FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status = 'draft'
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- REVENUE_BUDGET_ENTRIES için aynı politikalar
DROP POLICY IF EXISTS "Users can view revenue entries in their organization" ON revenue_budget_entries;
DROP POLICY IF EXISTS "Users can insert revenue entries" ON revenue_budget_entries;
DROP POLICY IF EXISTS "Users can update revenue entries" ON revenue_budget_entries;
DROP POLICY IF EXISTS "Users can delete revenue entries" ON revenue_budget_entries;

CREATE POLICY "Users can view revenue entries based on role"
  ON revenue_budget_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'spending_authority', 'realization_officer', 'accountant')
      )
      OR
      department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Department users can create draft revenue entries"
  ON revenue_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND status = 'draft'
  );

CREATE POLICY "Users can update revenue entries based on status and role"
  ON revenue_budget_entries FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
      OR
      (
        created_by = auth.uid()
        AND department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
        AND status IN ('draft', 'rejected')
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role = 'spending_authority'
        )
        AND status IN ('pending_approval', 'approved')
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role IN ('realization_officer', 'accountant')
        )
        AND status = 'approved'
      )
    )
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete draft revenue entries"
  ON revenue_budget_entries FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status = 'draft'
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- 7. İndeksler ekle
CREATE INDEX IF NOT EXISTS idx_expense_entries_status ON expense_budget_entries(status);
CREATE INDEX IF NOT EXISTS idx_expense_entries_department ON expense_budget_entries(department_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_approved_by ON expense_budget_entries(approved_by);
CREATE INDEX IF NOT EXISTS idx_expense_entries_posted_by ON expense_budget_entries(posted_by);

CREATE INDEX IF NOT EXISTS idx_revenue_entries_status ON revenue_budget_entries(status);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_department ON revenue_budget_entries(department_id);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_approved_by ON revenue_budget_entries(approved_by);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_posted_by ON revenue_budget_entries(posted_by);