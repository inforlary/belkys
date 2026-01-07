/*
  # Update IC Standards Code Format

  1. Changes
    - Update ic_standards code format from KOS1 to KOS.01
    - Update ic_standards code format from KOS2 to KOS.02
    - This allows action codes to be formatted as KOS.01.1, KOS.01.2, etc.

  2. Notes
    - Only updates the code format, all other data remains the same
*/

-- Update all standard codes to use dotted format
UPDATE ic_standards SET code = 'KOS.01' WHERE code = 'KOS1';
UPDATE ic_standards SET code = 'KOS.02' WHERE code = 'KOS2';
UPDATE ic_standards SET code = 'KOS.03' WHERE code = 'KOS3';
UPDATE ic_standards SET code = 'KOS.04' WHERE code = 'KOS4';
UPDATE ic_standards SET code = 'KOS.05' WHERE code = 'KOS5';
UPDATE ic_standards SET code = 'KOS.06' WHERE code = 'KOS6';
UPDATE ic_standards SET code = 'KOS.07' WHERE code = 'KOS7';
UPDATE ic_standards SET code = 'KOS.08' WHERE code = 'KOS8';
UPDATE ic_standards SET code = 'KOS.09' WHERE code = 'KOS9';
UPDATE ic_standards SET code = 'KOS.10' WHERE code = 'KOS10';
UPDATE ic_standards SET code = 'KOS.11' WHERE code = 'KOS11';
UPDATE ic_standards SET code = 'KOS.12' WHERE code = 'KOS12';
UPDATE ic_standards SET code = 'KOS.13' WHERE code = 'KOS13';
UPDATE ic_standards SET code = 'KOS.14' WHERE code = 'KOS14';
UPDATE ic_standards SET code = 'KOS.15' WHERE code = 'KOS15';
UPDATE ic_standards SET code = 'KOS.16' WHERE code = 'KOS16';
UPDATE ic_standards SET code = 'KOS.17' WHERE code = 'KOS17';
UPDATE ic_standards SET code = 'KOS.18' WHERE code = 'KOS18';
