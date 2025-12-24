/*
  # Faaliyet Gerekçesi Unique Constraint Düzeltmesi
  
  ## Sorun
  Mevcut unique constraint sadece (organization_id, department_id, activity_id) üçlüsünü 
  kontrol ediyor. Bu, aynı faaliyet için farklı mali yıllarda gerekçe oluşturmayı engelliyor.
  
  ## Değişiklikler
  1. Eski constraint'i kaldırma: (organization_id, department_id, activity_id)
  2. Yeni constraint ekleme: (organization_id, department_id, activity_id, fiscal_year)
  
  ## Neden Gerekli
  Sistem mali yıl bazlı çalıştığı için, aynı faaliyet için her yıl ayrı bir gerekçe 
  olabilmelidir. Bu düzeltme ile 2026, 2027, 2028 gibi farklı yıllar için aynı faaliyet 
  için ayrı gerekçeler oluşturulabilir.
*/

-- Eski constraint'i kaldır
ALTER TABLE activity_justifications 
DROP CONSTRAINT IF EXISTS activity_justifications_organization_id_department_id_activ_key;

-- Yeni constraint ekle (fiscal_year dahil)
ALTER TABLE activity_justifications 
ADD CONSTRAINT activity_justifications_org_dept_activity_year_key 
UNIQUE (organization_id, department_id, activity_id, fiscal_year);