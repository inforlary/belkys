/*
  # İç Kontrol Standartları Tablolarını Kaldır

  1. Değişiklikler
    - ic_actions tablosundan general_condition_id foreign key kaldırılır
    - ic_general_conditions tablosu silinir
    - ic_standards tablosu silinir
    - ic_components tablosu silinir

  2. Etki
    - Standartlar sayfası artık kullanılmayacak
    - Eylem planları artık standartlara bağlı olmayacak
    - Tüm standart verileri silinecek

  3. Security
    - Tabloların CASCADE ile silinmesi güvenli
*/

-- ic_actions tablosundan general_condition_id foreign key ve column'u kaldır
ALTER TABLE ic_actions
DROP CONSTRAINT IF EXISTS ic_actions_general_condition_id_fkey;

ALTER TABLE ic_actions
DROP COLUMN IF EXISTS general_condition_id;

-- ic_general_conditions tablosunu sil
DROP TABLE IF EXISTS ic_general_conditions CASCADE;

-- ic_standards tablosunu sil
DROP TABLE IF EXISTS ic_standards CASCADE;

-- ic_components tablosunu sil
DROP TABLE IF EXISTS ic_components CASCADE;