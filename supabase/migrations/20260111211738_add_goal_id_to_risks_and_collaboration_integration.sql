/*
  # Risk Tablosuna Hedef Bağlantısı ve İşbirliği Entegrasyonu

  1. Değişiklikler
    - `risks` tablosuna `goal_id` alanı eklenir
    - `risks` tablosuna `collaboration_item_id` alanı eklenir (işbirliği planlarından gelen riskler için)
    - Foreign key ilişkileri kurulur
    - İndeksler oluşturulur

  2. Güvenlik
    - Mevcut RLS politikaları korunur
    - Yeni alanlar mevcut politikalarla uyumludur
*/

-- Add goal_id to risks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'goal_id'
  ) THEN
    ALTER TABLE risks ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add collaboration_item_id to risks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'collaboration_item_id'
  ) THEN
    ALTER TABLE risks ADD COLUMN collaboration_item_id UUID REFERENCES collaboration_plan_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risks_goal_id ON risks(goal_id);
CREATE INDEX IF NOT EXISTS idx_risks_collaboration_item_id ON risks(collaboration_item_id);

-- Add comment
COMMENT ON COLUMN risks.goal_id IS 'Bağlı olduğu stratejik hedef';
COMMENT ON COLUMN risks.collaboration_item_id IS 'İşbirliği planından aktarılan riskler için kaynak referansı';
