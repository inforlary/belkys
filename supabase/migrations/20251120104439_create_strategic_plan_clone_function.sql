/*
  # Strategic Plan Cloning System
  
  1. Overview
    Creates a comprehensive function to clone/duplicate a strategic plan with all its related data
    
  2. Features
    - Clones the strategic plan with new name and dates
    - Copies all objectives with new IDs
    - Copies all goals with new IDs and updated references
    - Copies all indicators with new IDs and updated references
    - Copies all activities with new IDs and updated references
    - Optionally copies PESTLE and SWOT analyses
    - Maintains all relationships in the hierarchy
    - Returns the new strategic plan ID
    
  3. Function Parameters
    - p_source_plan_id: UUID of the plan to clone
    - p_new_name: Name for the new plan
    - p_new_start_year: Start year for the new plan
    - p_new_end_year: End year for the new plan
    - p_copy_analyses: Boolean to include PESTLE/SWOT (default true)
    - p_user_id: UUID of the user performing the clone
    
  4. Security
    - Function uses SECURITY DEFINER to bypass RLS during cloning
    - Validates user has access to source plan
    - Sets new plan's organization_id from source plan
*/

-- Drop function if exists
DROP FUNCTION IF EXISTS clone_strategic_plan(uuid, text, integer, integer, boolean, uuid);

-- Create the clone function
CREATE OR REPLACE FUNCTION clone_strategic_plan(
  p_source_plan_id uuid,
  p_new_name text,
  p_new_start_year integer,
  p_new_end_year integer,
  p_copy_analyses boolean DEFAULT true,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_plan_id uuid;
  v_organization_id uuid;
  v_objective_map jsonb := '{}'::jsonb;
  v_goal_map jsonb := '{}'::jsonb;
  v_old_objective_id uuid;
  v_new_objective_id uuid;
  v_old_goal_id uuid;
  v_new_goal_id uuid;
BEGIN
  -- Validate source plan exists and get organization_id
  SELECT organization_id INTO v_organization_id
  FROM strategic_plans
  WHERE id = p_source_plan_id;
  
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Source strategic plan not found';
  END IF;
  
  -- Validate user has access to the source plan's organization
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id 
    AND (organization_id = v_organization_id OR role = 'super_admin')
  ) THEN
    RAISE EXCEPTION 'User does not have access to this organization';
  END IF;
  
  -- Create new strategic plan
  INSERT INTO strategic_plans (
    organization_id,
    name,
    start_year,
    end_year,
    vision,
    mission,
    status,
    created_by
  )
  SELECT
    organization_id,
    p_new_name,
    p_new_start_year,
    p_new_end_year,
    vision,
    mission,
    'draft',
    p_user_id
  FROM strategic_plans
  WHERE id = p_source_plan_id
  RETURNING id INTO v_new_plan_id;
  
  -- Clone objectives and build mapping
  FOR v_old_objective_id IN 
    SELECT id FROM objectives WHERE strategic_plan_id = p_source_plan_id
  LOOP
    INSERT INTO objectives (
      strategic_plan_id,
      organization_id,
      code,
      title,
      description
    )
    SELECT
      v_new_plan_id,
      organization_id,
      code,
      title,
      description
    FROM objectives
    WHERE id = v_old_objective_id
    RETURNING id INTO v_new_objective_id;
    
    -- Store mapping
    v_objective_map := v_objective_map || jsonb_build_object(v_old_objective_id::text, v_new_objective_id);
  END LOOP;
  
  -- Clone goals and build mapping
  FOR v_old_goal_id IN 
    SELECT id FROM goals WHERE objective_id IN (
      SELECT id FROM objectives WHERE strategic_plan_id = p_source_plan_id
    )
  LOOP
    INSERT INTO goals (
      objective_id,
      organization_id,
      department_id,
      vice_president_id,
      code,
      title,
      description,
      start_date,
      end_date,
      status
    )
    SELECT
      (v_objective_map->>objective_id::text)::uuid,
      organization_id,
      department_id,
      vice_president_id,
      code,
      title,
      description,
      start_date,
      end_date,
      'not_started'
    FROM goals
    WHERE id = v_old_goal_id
    RETURNING id INTO v_new_goal_id;
    
    -- Store mapping
    v_goal_map := v_goal_map || jsonb_build_object(v_old_goal_id::text, v_new_goal_id);
  END LOOP;
  
  -- Clone indicators
  INSERT INTO indicators (
    goal_id,
    organization_id,
    code,
    name,
    description,
    measurement_unit,
    calculation_method,
    data_source,
    collection_frequency,
    reporting_frequency,
    responsible_person,
    baseline_value,
    target_value,
    goal_impact_percentage,
    status
  )
  SELECT
    (v_goal_map->>goal_id::text)::uuid,
    organization_id,
    code,
    name,
    description,
    measurement_unit,
    calculation_method,
    data_source,
    collection_frequency,
    reporting_frequency,
    responsible_person,
    baseline_value,
    target_value,
    goal_impact_percentage,
    'active'
  FROM indicators
  WHERE goal_id IN (
    SELECT id FROM goals WHERE objective_id IN (
      SELECT id FROM objectives WHERE strategic_plan_id = p_source_plan_id
    )
  );
  
  -- Clone activities
  INSERT INTO activities (
    goal_id,
    organization_id,
    department_id,
    program_id,
    sub_program_id,
    name,
    title,
    description,
    start_date,
    end_date,
    status,
    assigned_user_id
  )
  SELECT
    (v_goal_map->>goal_id::text)::uuid,
    organization_id,
    department_id,
    program_id,
    sub_program_id,
    name,
    title,
    description,
    start_date,
    end_date,
    'planning',
    assigned_user_id
  FROM activities
  WHERE goal_id IN (
    SELECT id FROM goals WHERE objective_id IN (
      SELECT id FROM objectives WHERE strategic_plan_id = p_source_plan_id
    )
  );
  
  -- Clone PESTLE factors if requested
  IF p_copy_analyses THEN
    INSERT INTO pestle_factors (
      strategic_plan_id,
      organization_id,
      category,
      title,
      description,
      impact_level,
      probability,
      timeframe
    )
    SELECT
      v_new_plan_id,
      organization_id,
      category,
      title,
      description,
      impact_level,
      probability,
      timeframe
    FROM pestle_factors
    WHERE strategic_plan_id = p_source_plan_id;
    
    -- Clone SWOT items if requested
    INSERT INTO swot_items (
      strategic_plan_id,
      organization_id,
      category,
      title,
      description,
      priority
    )
    SELECT
      v_new_plan_id,
      organization_id,
      category,
      title,
      description,
      priority
    FROM swot_items
    WHERE strategic_plan_id = p_source_plan_id;
  END IF;
  
  RETURN v_new_plan_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clone_strategic_plan TO authenticated;

-- Add comment
COMMENT ON FUNCTION clone_strategic_plan IS 'Clones a strategic plan with all its objectives, goals, indicators, activities, and optionally PESTLE/SWOT analyses';
