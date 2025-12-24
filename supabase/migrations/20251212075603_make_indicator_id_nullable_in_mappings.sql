/*
  # Gösterge ID'sini Opsiyonel Yap

  1. Değişiklikler
    - `program_activity_indicator_mappings` tablosunda `indicator_id` kolonunu nullable yap
    - Böylece faaliyetler performans göstergesi olmadan da eklenebilir
  
  2. Sebep
    - Her faaliyetin mutlaka bir performans göstergesi olması gerekmez
    - Bazı faaliyetler sadece süreç/işlem bazlı olabilir
    - Kullanıcılar gösterge olmadan da faaliyet ekleyebilmeli
*/

-- indicator_id kolonunu nullable yap
ALTER TABLE program_activity_indicator_mappings 
ALTER COLUMN indicator_id DROP NOT NULL;