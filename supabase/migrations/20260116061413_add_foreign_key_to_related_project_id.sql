/*
  # Add Foreign Key to related_project_id

  ## Changes
  1. Add foreign key constraint to risks.related_project_id
    - References projects(id)
    - ON DELETE SET NULL (if project deleted, set to null)
*/

-- Add foreign key constraint
ALTER TABLE risks
DROP CONSTRAINT IF EXISTS risks_related_project_id_fkey;

ALTER TABLE risks
ADD CONSTRAINT risks_related_project_id_fkey 
FOREIGN KEY (related_project_id) 
REFERENCES projects(id) 
ON DELETE SET NULL;

COMMENT ON COLUMN risks.related_project_id IS 'Proje ilişki türü için bağlı proje';
