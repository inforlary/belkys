/*
  # Alt Standart Durumları Unique Constraint Düzeltmesi

  1. Değişiklikler
    - Mevcut unique constraint kaldırılıyor: (sub_standard_id, organization_id)
    - Yeni unique constraint ekleniyor: (sub_standard_id, organization_id, ic_plan_id)
    - Bu sayede aynı alt standart için farklı planlarda farklı mevcut durum açıklamaları tutulabilir
  
  2. Notlar
    - Her İç Kontrol Planı için ayrı mevcut durum kaydı tutulabilecek
    - Aynı kuruluşta aynı alt standart için farklı planlar farklı duruma sahip olabilir
*/

-- Mevcut unique constraint'i kaldır
ALTER TABLE ic_kiks_sub_standard_statuses
DROP CONSTRAINT IF EXISTS ic_kiks_sub_standard_statuses_sub_standard_id_organization__key;

-- Yeni unique constraint ekle (ic_plan_id dahil)
ALTER TABLE ic_kiks_sub_standard_statuses
ADD CONSTRAINT ic_kiks_sub_standard_statuses_sub_standard_id_org_plan_key 
UNIQUE (sub_standard_id, organization_id, ic_plan_id);
