/*
  # Risk İlişki Bağlantıları Ekleme

  1. Değişiklikler
    - `risks` tablosuna ilişki türüne göre bağlantı kolonları eklenir:
      - `related_goal_id`: Stratejik hedef bağlantısı (goals)
      - `related_activity_id`: Stratejik faaliyet bağlantısı (activities)
      - `related_process_id`: Süreç bağlantısı (qm_processes)
      - `related_project_id`: Proje bağlantısı (gelecekte kullanılacak)

  2. Amaç
    - Riskleri ilişki türüne göre ilgili kayıtlara bağlamak
    - Stratejik riskler → Hedef ve faaliyet
    - Operasyonel riskler → Süreç
    - Proje riskleri → Proje
    - Kurumsal riskler → Bağımsız
*/

-- İlişki bağlantı kolonlarını ekle
ALTER TABLE risks
ADD COLUMN IF NOT EXISTS related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS related_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS related_process_id UUID REFERENCES qm_processes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS related_project_id UUID;

-- İndeksler ekle
CREATE INDEX IF NOT EXISTS idx_risks_related_goal ON risks(related_goal_id);
CREATE INDEX IF NOT EXISTS idx_risks_related_activity ON risks(related_activity_id);
CREATE INDEX IF NOT EXISTS idx_risks_related_process ON risks(related_process_id);
CREATE INDEX IF NOT EXISTS idx_risks_related_project ON risks(related_project_id);

COMMENT ON COLUMN risks.related_goal_id IS 'Stratejik ilişki türü için bağlı hedef';
COMMENT ON COLUMN risks.related_activity_id IS 'Stratejik ilişki türü için bağlı faaliyet (opsiyonel)';
COMMENT ON COLUMN risks.related_process_id IS 'Operasyonel ilişki türü için bağlı süreç';
COMMENT ON COLUMN risks.related_project_id IS 'Proje ilişki türü için bağlı proje (gelecekte kullanılacak)';
