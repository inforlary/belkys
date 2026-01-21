/*
  # Eski Proje Yönetimi Tablolarını Sil

  1. Değişiklikler
    - Eski projects tablosunu ve ilgili tabloları sil
    - project_milestones, project_tasks, project_team_members gibi tabloları sil
  
  2. Notlar
    - Yeni proje yönetimi modülü için temiz bir başlangıç
    - Veriler yedeklenmedi, tamamen siliniyor
*/

DROP TABLE IF EXISTS project_team_members CASCADE;
DROP TABLE IF EXISTS project_tasks CASCADE;
DROP TABLE IF EXISTS project_milestones CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
