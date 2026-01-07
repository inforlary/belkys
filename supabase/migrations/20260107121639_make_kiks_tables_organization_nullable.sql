/*
  # Make KİKS tables organization_id nullable for global standards
  
  1. Changes
    - Make organization_id nullable in ic_kiks_categories
    - Make organization_id nullable in ic_kiks_main_standards
    - Make organization_id nullable in ic_kiks_sub_standards
  
  2. Reason
    - KİKS standards should be global (organization_id = NULL) and available to all organizations
*/

ALTER TABLE ic_kiks_categories ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE ic_kiks_main_standards ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE ic_kiks_sub_standards ALTER COLUMN organization_id DROP NOT NULL;
