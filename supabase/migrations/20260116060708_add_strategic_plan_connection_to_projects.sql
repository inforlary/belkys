/*
  # Add Strategic Plan Connection to Projects

  ## Changes
  1. Alter projects table
    - Add `related_goal_id` (uuid, nullable, foreign key to goals) - Connected strategic goal
    - Add `related_activity_id` (uuid, nullable, foreign key to activities) - Connected strategic activity
    - At least one should be filled if strategic plan connection is enabled
  
  2. Indexes
    - Add index for related_goal_id
    - Add index for related_activity_id
  
  3. Comments
    - Add descriptive comments for new columns
*/

-- Add strategic plan connection columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS related_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL;

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_projects_related_goal_id ON projects(related_goal_id);
CREATE INDEX IF NOT EXISTS idx_projects_related_activity_id ON projects(related_activity_id);

-- Add comments
COMMENT ON COLUMN projects.related_goal_id IS 'Connected strategic goal (optional)';
COMMENT ON COLUMN projects.related_activity_id IS 'Connected strategic activity (optional)';
