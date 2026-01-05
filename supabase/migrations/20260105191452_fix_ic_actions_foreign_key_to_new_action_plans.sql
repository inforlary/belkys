/*
  # ic_actions tablosunun foreign key'ini yeni ic_action_plans'a bağla

  1. Değişiklikler
    - ic_actions.action_plan_id foreign key'ini ic_action_plans_old'dan kaldır
    - ic_actions.action_plan_id foreign key'ini yeni ic_action_plans'a ekle
    
  2. Notlar
    - Mevcut veriler temizlenir (eski planlarla uyumlu olmadığı için)
    - Yeni yapıda ic_actions ve ic_action_plans ilişkisi kurulur
*/

-- Eski verileri temizle (artık geçersiz çünkü eski planlara bağlılar)
DELETE FROM ic_actions;

-- Eski foreign key constraint'i kaldır
ALTER TABLE ic_actions 
DROP CONSTRAINT IF EXISTS ic_actions_action_plan_id_fkey;

-- Yeni foreign key constraint'i ekle
ALTER TABLE ic_actions 
ADD CONSTRAINT ic_actions_action_plan_id_fkey 
FOREIGN KEY (action_plan_id) 
REFERENCES ic_action_plans(id) 
ON DELETE CASCADE;
