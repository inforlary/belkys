/*
  # Add Sum Only Calculation Method

  1. Changes
    - Drop existing constraint 'indicators_calculation_method_check'
    - Add new constraint that includes 'sum_only' method
  
  2. New Calculation Method
    - sum_only: Basit Toplam (Başlangıç değeri kullanmadan sadece dönemsel toplamlar)
      * Mevcut Değer = Dönemsel Değerlerin Toplamı
      * Performans % = (Toplam / Hedef) × 100
  
  3. Use Cases
    - Yıllık proje sayısı
    - Toplam eğitim saati
    - Toplam harcama tutarı
*/

-- Drop existing constraint
ALTER TABLE indicators DROP CONSTRAINT IF EXISTS indicators_calculation_method_check;

-- Add new constraint with sum_only method
ALTER TABLE indicators ADD CONSTRAINT indicators_calculation_method_check 
CHECK (calculation_method IN (
  'standard',
  'cumulative',
  'percentage',
  'maintenance',
  'cumulative_increasing',
  'cumulative_decreasing',
  'percentage_increasing',
  'percentage_decreasing',
  'maintenance_increasing',
  'maintenance_decreasing',
  'increasing',
  'decreasing',
  'sum_only'
));