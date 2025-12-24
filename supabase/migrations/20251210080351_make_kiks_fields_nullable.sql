/*
  # KİKS Tablolarında Alanları Nullable Yap

  1. Değişiklikler
    - ic_kiks_main_standards tablosundaki description, responsible_departments, collaboration_departments alanlarını nullable yap
    - ic_kiks_sub_standards tablosundaki description, responsible_departments, collaboration_departments alanlarını nullable yap
    
  2. Açıklama
    - Ana standart ve alt standartlarda bu alanlar artık kullanılmayacak
    - Sadece eylemler (actions) seviyesinde bu bilgiler tutulacak
*/

-- Ana Standartlar için alanları nullable yap
ALTER TABLE ic_kiks_main_standards 
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN responsible_departments SET DEFAULT '{}',
  ALTER COLUMN collaboration_departments SET DEFAULT '{}';

-- Alt Standartlar için alanları nullable yap  
ALTER TABLE ic_kiks_sub_standards 
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN responsible_departments SET DEFAULT '{}',
  ALTER COLUMN collaboration_departments SET DEFAULT '{}';
