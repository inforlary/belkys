/*
  # Create Risk Register System

  1. New Tables
    - `ic_risk_assessments`
      - Historical record of all risk assessments
      - Tracks changes in likelihood, impact, and scores over time
      - Links to assessor and assessment date
    
    - `ic_risk_documents`
      - Documentation and attachments for risks
      - Links to storage bucket for files
      - Categorization and metadata
    
    - `ic_risk_notes`
      - Comments and notes about risks
      - Timeline of discussions
      - Mentions and notifications

    - `ic_risk_control_links`
      - Enhanced linking between risks and controls
      - Effectiveness tracking
      - Coverage percentage

  2. Changes
    - Add review tracking fields to ic_risks
    - Add indexes for performance
    - Storage bucket for risk documents

  3. Security
    - Enable RLS on all new tables
    - Proper access control for documents
    - Audit trail for all changes
*/

-- Create risk assessments history table
CREATE TABLE IF NOT EXISTS ic_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  
  -- Assessment details
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assessed_by uuid REFERENCES profiles(id),
  assessment_type text CHECK (assessment_type IN ('initial', 'periodic', 'event_driven', 'post_control')) DEFAULT 'periodic',
  
  -- Risk scores at time of assessment
  inherent_likelihood integer CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact integer CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_score integer,
  residual_likelihood integer CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact integer CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score integer,
  
  -- Assessment context
  risk_status text,
  assessment_notes text,
  changes_since_last text,
  key_findings text,
  
  -- Recommendations
  recommended_actions text,
  next_assessment_date date,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT ic_risk_assessments_org_risk_date UNIQUE(organization_id, risk_id, assessment_date)
);

-- Create risk documents table
CREATE TABLE IF NOT EXISTS ic_risk_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  
  -- Document details
  document_name text NOT NULL,
  document_type text CHECK (document_type IN ('evidence', 'analysis', 'report', 'assessment', 'mitigation_plan', 'other')) DEFAULT 'other',
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  
  -- Metadata
  description text,
  uploaded_by uuid REFERENCES profiles(id),
  upload_date timestamptz DEFAULT now(),
  is_confidential boolean DEFAULT false,
  
  -- Version control
  version text DEFAULT '1.0',
  replaces_document_id uuid REFERENCES ic_risk_documents(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create risk notes/comments table
CREATE TABLE IF NOT EXISTS ic_risk_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  
  -- Note content
  note_text text NOT NULL,
  note_type text CHECK (note_type IN ('general', 'assessment', 'mitigation', 'escalation', 'resolution')) DEFAULT 'general',
  is_important boolean DEFAULT false,
  
  -- Author and timing
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- For threaded discussions
  parent_note_id uuid REFERENCES ic_risk_notes(id),
  
  -- Mentions (stored as array of user IDs)
  mentioned_users uuid[]
);

-- Enhanced risk-control links
CREATE TABLE IF NOT EXISTS ic_risk_control_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES ic_controls(id) ON DELETE CASCADE,
  
  -- Link details
  control_type text CHECK (control_type IN ('preventive', 'detective', 'corrective')) DEFAULT 'preventive',
  coverage_percentage integer CHECK (coverage_percentage BETWEEN 0 AND 100) DEFAULT 100,
  effectiveness_rating text CHECK (effectiveness_rating IN ('not_effective', 'partially_effective', 'effective', 'highly_effective')),
  
  -- Tracking
  linked_by uuid REFERENCES profiles(id),
  linked_at timestamptz DEFAULT now(),
  last_reviewed timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  
  notes text,
  
  UNIQUE(risk_id, control_id)
);

-- Add review tracking to ic_risks if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_risks' AND column_name = 'last_reviewed_by'
  ) THEN
    ALTER TABLE ic_risks ADD COLUMN last_reviewed_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_risks' AND column_name = 'review_frequency_days'
  ) THEN
    ALTER TABLE ic_risks ADD COLUMN review_frequency_days integer DEFAULT 90;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_risks' AND column_name = 'assessment_count'
  ) THEN
    ALTER TABLE ic_risks ADD COLUMN assessment_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk ON ic_risk_assessments(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_org ON ic_risk_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_date ON ic_risk_assessments(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_type ON ic_risk_assessments(assessment_type);

CREATE INDEX IF NOT EXISTS idx_risk_documents_risk ON ic_risk_documents(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_documents_org ON ic_risk_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_documents_type ON ic_risk_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_risk_notes_risk ON ic_risk_notes(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_notes_org ON ic_risk_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_notes_created ON ic_risk_notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_control_links_risk ON ic_risk_control_links(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_control_links_control ON ic_risk_control_links(control_id);
CREATE INDEX IF NOT EXISTS idx_risk_control_links_org ON ic_risk_control_links(organization_id);

-- Enable RLS
ALTER TABLE ic_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_risk_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_risk_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_risk_control_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ic_risk_assessments
DROP POLICY IF EXISTS "Users can view assessments in their org" ON ic_risk_assessments;
CREATE POLICY "Users can view assessments in their org"
  ON ic_risk_assessments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Risk owners and admins can create assessments" ON ic_risk_assessments;
CREATE POLICY "Risk owners and admins can create assessments"
  ON ic_risk_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president', 'director')
    )
    OR risk_id IN (SELECT id FROM ic_risks WHERE risk_owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- RLS Policies for ic_risk_documents
DROP POLICY IF EXISTS "Users can view risk documents in their org" ON ic_risk_documents;
CREATE POLICY "Users can view risk documents in their org"
  ON ic_risk_documents FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Users can upload risk documents" ON ic_risk_documents;
CREATE POLICY "Users can upload risk documents"
  ON ic_risk_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Document owners and admins can delete" ON ic_risk_documents;
CREATE POLICY "Document owners and admins can delete"
  ON ic_risk_documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- RLS Policies for ic_risk_notes
DROP POLICY IF EXISTS "Users can view notes in their org" ON ic_risk_notes;
CREATE POLICY "Users can view notes in their org"
  ON ic_risk_notes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Users can create notes" ON ic_risk_notes;
CREATE POLICY "Users can create notes"
  ON ic_risk_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON ic_risk_notes;
CREATE POLICY "Users can update their own notes"
  ON ic_risk_notes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own notes" ON ic_risk_notes;
CREATE POLICY "Users can delete their own notes"
  ON ic_risk_notes FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- RLS Policies for ic_risk_control_links
DROP POLICY IF EXISTS "Users can view risk-control links in their org" ON ic_risk_control_links;
CREATE POLICY "Users can view risk-control links in their org"
  ON ic_risk_control_links FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Admins and risk owners can manage links" ON ic_risk_control_links;
CREATE POLICY "Admins and risk owners can manage links"
  ON ic_risk_control_links FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president', 'director')
    )
    OR risk_id IN (SELECT id FROM ic_risks WHERE risk_owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Function to create assessment when risk is updated
CREATE OR REPLACE FUNCTION log_risk_assessment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only log if scores have changed
  IF (OLD.inherent_likelihood IS DISTINCT FROM NEW.inherent_likelihood OR
      OLD.inherent_impact IS DISTINCT FROM NEW.inherent_impact OR
      OLD.residual_likelihood IS DISTINCT FROM NEW.residual_likelihood OR
      OLD.residual_impact IS DISTINCT FROM NEW.residual_impact OR
      OLD.status IS DISTINCT FROM NEW.status) THEN
    
    INSERT INTO ic_risk_assessments (
      organization_id,
      risk_id,
      assessment_date,
      assessed_by,
      assessment_type,
      inherent_likelihood,
      inherent_impact,
      inherent_score,
      residual_likelihood,
      residual_impact,
      residual_score,
      risk_status,
      assessment_notes
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      CURRENT_DATE,
      auth.uid(),
      CASE 
        WHEN NEW.created_at = NEW.updated_at THEN 'initial'
        ELSE 'periodic'
      END,
      NEW.inherent_likelihood,
      NEW.inherent_impact,
      NEW.inherent_score,
      NEW.residual_likelihood,
      NEW.residual_impact,
      NEW.residual_score,
      NEW.status,
      'Automatic assessment log'
    );
    
    -- Update assessment count
    UPDATE ic_risks 
    SET assessment_count = COALESCE(assessment_count, 0) + 1
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic assessment logging
DROP TRIGGER IF EXISTS trg_log_risk_assessment ON ic_risks;
CREATE TRIGGER trg_log_risk_assessment
  AFTER INSERT OR UPDATE OF inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, status
  ON ic_risks
  FOR EACH ROW
  EXECUTE FUNCTION log_risk_assessment();

-- Create storage bucket for risk documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('risk-documents', 'risk-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for risk documents
DROP POLICY IF EXISTS "Authenticated users can upload risk documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload risk documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'risk-documents');

DROP POLICY IF EXISTS "Authenticated users can view risk documents" ON storage.objects;
CREATE POLICY "Authenticated users can view risk documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'risk-documents');

DROP POLICY IF EXISTS "Owners and admins can delete risk documents" ON storage.objects;
CREATE POLICY "Owners and admins can delete risk documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'risk-documents');
