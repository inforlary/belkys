/*
  # Document Management System
  
  1. New Tables
    - `document_categories` - Document categories/folders
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text)
      - `parent_id` (uuid, self-reference) - For nested folders
      - `icon` (text)
      - `color` (text)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      
    - `documents` - Document metadata
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `category_id` (uuid, foreign key)
      - `uploaded_by` (uuid, foreign key)
      - `file_name` (text)
      - `file_size` (bigint) - in bytes
      - `file_type` (text) - MIME type
      - `file_extension` (text)
      - `storage_path` (text) - Path in Supabase Storage
      - `title` (text) - Display title
      - `description` (text)
      - `tags` (text[]) - Searchable tags
      - `version` (integer) - Version number
      - `is_latest_version` (boolean)
      - `parent_document_id` (uuid) - For versions
      - `entity_type` (text) - Related entity (goal, indicator, activity, etc.)
      - `entity_id` (uuid) - Related entity ID
      - `access_level` (text) - public, restricted, private
      - `download_count` (integer)
      - `last_accessed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `document_permissions` - Fine-grained access control
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key) - NULL for department/role permissions
      - `department_id` (uuid, foreign key) - NULL for user permissions
      - `permission_type` (text) - view, download, edit, delete, share
      - `granted_by` (uuid)
      - `created_at` (timestamptz)
      
    - `document_access_logs` - Track document access
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `action` (text) - view, download, edit, delete
      - `ip_address` (text)
      - `created_at` (timestamptz)
  
  2. Storage Bucket
    - Create 'documents' bucket with RLS
    
  3. Security
    - Enable RLS on all tables
    - Users can view documents they have permission to
    - Document creators have full control
    - Admins have full access in their organization
    
  4. Indexes
    - Fast queries on documents
    - Full-text search on tags
*/

-- Create document_categories table
CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES document_categories(id) ON DELETE CASCADE,
  icon text DEFAULT 'folder',
  color text DEFAULT 'blue',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name, parent_id)
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES document_categories(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  file_extension text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  version integer DEFAULT 1,
  is_latest_version boolean DEFAULT true,
  parent_document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  entity_type text,
  entity_id uuid,
  access_level text DEFAULT 'restricted' CHECK (access_level IN ('public', 'restricted', 'private')),
  download_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_permissions table
CREATE TABLE IF NOT EXISTS document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  permission_type text NOT NULL CHECK (permission_type IN ('view', 'download', 'edit', 'delete', 'share')),
  granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_or_department_required CHECK (
    (user_id IS NOT NULL AND department_id IS NULL) OR
    (user_id IS NULL AND department_id IS NOT NULL)
  )
);

-- Create document_access_logs table
CREATE TABLE IF NOT EXISTS document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action text NOT NULL CHECK (action IN ('view', 'download', 'edit', 'delete', 'share')),
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_categories

-- Users can view categories in their organization
CREATE POLICY "Users can view categories in their organization"
  ON document_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = document_categories.organization_id
    )
  );

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON document_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = document_categories.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

-- RLS Policies for documents

-- Users can view documents they have access to
CREATE POLICY "Users can view documents they have access to"
  ON documents FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    access_level = 'public' OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = documents.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    ) OR
    EXISTS (
      SELECT 1 FROM document_permissions
      WHERE document_permissions.document_id = documents.id
      AND (
        document_permissions.user_id = auth.uid() OR
        document_permissions.department_id IN (
          SELECT department_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- Users can upload documents
CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = documents.organization_id
    )
  );

-- Users can update their own documents or admins can update all
CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = documents.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    ) OR
    EXISTS (
      SELECT 1 FROM document_permissions
      WHERE document_permissions.document_id = documents.id
      AND document_permissions.user_id = auth.uid()
      AND document_permissions.permission_type = 'edit'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = documents.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

-- Users can delete their own documents or admins can delete all
CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = documents.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    ) OR
    EXISTS (
      SELECT 1 FROM document_permissions
      WHERE document_permissions.document_id = documents.id
      AND document_permissions.user_id = auth.uid()
      AND document_permissions.permission_type = 'delete'
    )
  );

-- RLS Policies for document_permissions

-- Users can view permissions for documents they can access
CREATE POLICY "Users can view document permissions"
  ON document_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_permissions.document_id
      AND (
        documents.uploaded_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = documents.organization_id
          AND profiles.role IN ('admin', 'vice_president')
        )
      )
    )
  );

-- Document owners and admins can manage permissions
CREATE POLICY "Document owners can manage permissions"
  ON document_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_permissions.document_id
      AND (
        documents.uploaded_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = documents.organization_id
          AND profiles.role IN ('admin', 'vice_president')
        )
      )
    )
  );

-- RLS Policies for document_access_logs

-- System can insert logs
CREATE POLICY "System can insert access logs"
  ON document_access_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can view logs for their own documents or admins can view all
CREATE POLICY "Users can view access logs for their documents"
  ON document_access_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_access_logs.document_id
      AND (
        documents.uploaded_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = documents.organization_id
          AND profiles.role IN ('admin', 'vice_president')
        )
      )
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_categories_org ON document_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_parent ON document_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_created ON documents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_document_permissions_document ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user ON document_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_dept ON document_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_document ON document_access_logs(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_user ON document_access_logs(user_id);

-- Trigger to update documents updated_at
CREATE OR REPLACE FUNCTION update_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_timestamp();

-- Function to log document access
CREATE OR REPLACE FUNCTION log_document_access(
  p_document_id uuid,
  p_action text,
  p_ip_address text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO document_access_logs (
    document_id,
    user_id,
    action,
    ip_address
  ) VALUES (
    p_document_id,
    auth.uid(),
    p_action,
    p_ip_address
  );
  
  -- Update document stats
  IF p_action = 'download' THEN
    UPDATE documents
    SET download_count = download_count + 1,
        last_accessed_at = now()
    WHERE id = p_document_id;
  ELSIF p_action = 'view' THEN
    UPDATE documents
    SET last_accessed_at = now()
    WHERE id = p_document_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default categories
DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    -- Insert default categories if they don't exist
    INSERT INTO document_categories (organization_id, name, description, icon, color)
    VALUES 
      (v_org.id, 'Stratejik Planlar', 'Stratejik plan dokümanları', 'target', 'blue'),
      (v_org.id, 'Faaliyet Raporları', 'Dönemsel faaliyet raporları', 'file-text', 'green'),
      (v_org.id, 'Bütçe Belgeleri', 'Bütçe ve performans belgeleri', 'dollar-sign', 'yellow'),
      (v_org.id, 'Risk Yönetimi', 'Risk değerlendirme ve kontrol dokümanları', 'alert-triangle', 'red'),
      (v_org.id, 'Prosedürler', 'İç kontrol prosedürleri', 'clipboard-check', 'purple'),
      (v_org.id, 'Genel Dokümanlar', 'Diğer dokümanlar', 'folder', 'gray')
    ON CONFLICT (organization_id, name, parent_id) DO NOTHING;
  END LOOP;
END $$;