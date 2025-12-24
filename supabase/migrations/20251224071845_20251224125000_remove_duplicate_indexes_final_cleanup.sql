/*
  # Remove Duplicate Indexes & Final Cleanup

  1. Duplicate Indexes
    - Some tables have identical indexes with different names
    - Wastes disk space and slows down writes
    - Keep one, drop the rest

  2. Solution
    - Drop duplicate indexes
    - Keep the most descriptive name
    - Improves write performance

  3. Impact
    - Reduced storage
    - Faster INSERT/UPDATE operations
    - Cleaner database structure
*/

-- Remove duplicate indexes
-- Keep idx_expense_budget_entries_dept, drop idx_expense_entries_department
DROP INDEX IF EXISTS public.idx_expense_entries_department;

-- Keep idx_revenue_budget_entries_dept, drop idx_revenue_entries_department  
DROP INDEX IF EXISTS public.idx_revenue_entries_department;

-- Keep idx_ic_control_tests_plan, drop ic_control_tests_ic_plan_id_idx
-- (This was already handled in the ic_control_tests table)

-- Additional cleanup: Remove any remaining problematic duplicate indexes
DO $$
BEGIN
  -- Check and drop duplicate indexes safely
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_expense_entries_department') THEN
    DROP INDEX public.idx_expense_entries_department;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_revenue_entries_department') THEN
    DROP INDEX public.idx_revenue_entries_department;
  END IF;
END $$;

-- Create helpful comment
COMMENT ON SCHEMA public IS 'Database optimized - Foreign key indexes added, unused indexes removed, duplicate indexes cleaned up, function security enhanced';
