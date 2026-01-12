/*
  # İç Kontrol Eylem Tablolarındaki Karakter Sınırlarını Genişlet

  1. Değişiklikler
    - `ic_actions.title`: 300 → 1000 karakter
    - `ic_action_plans.name`: 300 → 1000 karakter
    - `ic_action_documents.name`: 300 → 500 karakter
  
  2. Neden
    - Kullanıcılar uzun eylem başlıkları girerken "value too long" hatası alıyordu
    - Daha uzun açıklayıcı başlıklar için alan sağlanması gerekiyor
*/

-- ic_actions tablosunda title alanını genişlet
ALTER TABLE ic_actions 
  ALTER COLUMN title TYPE varchar(1000);

-- ic_action_plans tablosunda name alanını genişlet
ALTER TABLE ic_action_plans 
  ALTER COLUMN name TYPE varchar(1000);

-- ic_action_documents tablosunda name alanını genişlet
ALTER TABLE ic_action_documents 
  ALTER COLUMN name TYPE varchar(500);
