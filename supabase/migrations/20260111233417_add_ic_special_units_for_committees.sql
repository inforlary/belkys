/*
  # İç Kontrol Özel Birimlerini Genişletme

  1. Yeni Özel Birimler
    - IC_MONITORING_BOARD: İç Kontrol İzleme ve Yönlendirme Kurulu
    - INTERNAL_AUDIT_BOARD: İç Denetim Kurulu
    - INTERNAL_AUDIT_COORDINATION_BOARD: İç Denetim Koordinasyon Kurulu

  2. Mevcut Birimler
    - TOP_MANAGEMENT: Üst Yönetim (zaten mevcut)

  3. Notlar
    - Bu birimler hem sorumlu birim hem de iş birliği yapılacak birimler olarak kullanılabilir
    - Kullanıcılar departman seçimine ek olarak bu özel birimleri de seçebilir
*/

-- Tabloya açıklama ekle
COMMENT ON COLUMN ic_actions.special_responsible_types IS 'Sorumlu özel birimler: TOP_MANAGEMENT (Üst Yönetim), IC_MONITORING_BOARD (İç Kontrol İzleme ve Yönlendirme Kurulu), INTERNAL_AUDIT_BOARD (İç Denetim Kurulu), INTERNAL_AUDIT_COORDINATION_BOARD (İç Denetim Koordinasyon Kurulu)';

COMMENT ON COLUMN ic_actions.related_special_responsible_types IS 'İş birliği yapılacak özel birimler - JSONB array formatında aynı değerler kullanılabilir';

-- Mevcut veriler üzerinde herhangi bir işlem yapma, sadece yeni seçeneklerin kullanılabilir olduğunu belgeliyoruz
