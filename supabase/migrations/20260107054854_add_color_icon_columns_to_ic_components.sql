/*
  # İç Kontrol Bileşenlerine Renk ve İkon Kolonları Ekleme

  1. Yeni Kolonlar
    - `color` - Bileşenin UI'da gösterileceği renk kodu
    - `icon` - Bileşenin UI'da gösterileceği ikon adı
  
  2. Varsayılan Değerler
    - color: '#6B7280' (gri)
    - icon: 'Folder' (varsayılan)
*/

ALTER TABLE ic_components
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6B7280',
  ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'Folder';