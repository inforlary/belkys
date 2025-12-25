/*
  # ic_process_flow_diagrams tablosu

  Süreçlerin görsel akış şemalarını saklayan tablo
*/

CREATE TABLE IF NOT EXISTS ic_process_flow_diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid NOT NULL REFERENCES ic_plans(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  diagram_name text NOT NULL,
  diagram_type text NOT NULL DEFAULT 'flowchart' CHECK (diagram_type IN ('flowchart', 'swimlane', 'bpmn', 'other')),
  diagram_data jsonb NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_current boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_flow_diagrams_org_plan ON ic_process_flow_diagrams(organization_id, ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_flow_diagrams_process ON ic_process_flow_diagrams(process_id);
CREATE INDEX IF NOT EXISTS idx_ic_flow_diagrams_current ON ic_process_flow_diagrams(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_ic_flow_diagrams_data ON ic_process_flow_diagrams USING gin(diagram_data);