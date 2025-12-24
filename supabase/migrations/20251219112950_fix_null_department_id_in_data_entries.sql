/*
  # Fix NULL department_id in indicator_data_entries

  1. Problem
    - Some indicator_data_entries records have NULL department_id
    - Directors cannot see these entries in DataApprovals page
    - This happens when entries were created before department_id was added

  2. Solution
    - Update NULL department_id values using the user's department_id
    - Add check constraint to prevent future NULL department_id entries
    - Update DataApprovals query to show NULL department_id entries as fallback

  3. Security
    - Only update entries where department_id is NULL
    - Use the entered_by user's department_id from profiles
*/

-- Update NULL department_id values using the user's department_id
UPDATE indicator_data_entries ide
SET department_id = p.department_id
FROM profiles p
WHERE ide.entered_by = p.id
  AND ide.department_id IS NULL
  AND p.department_id IS NOT NULL;

-- Add NOT NULL constraint (first set a default for any remaining NULLs)
-- For any remaining NULLs (where user also has no department), use the first department in the organization
UPDATE indicator_data_entries ide
SET department_id = (
  SELECT d.id
  FROM departments d
  WHERE d.organization_id = ide.organization_id
  LIMIT 1
)
WHERE ide.department_id IS NULL;

-- Now add NOT NULL constraint
ALTER TABLE indicator_data_entries
  ALTER COLUMN department_id SET NOT NULL;

-- Update INSERT policy to ensure department_id is always set
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    entered_by = auth.uid()
    AND department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.department_id = indicator_data_entries.department_id
    )
  );
