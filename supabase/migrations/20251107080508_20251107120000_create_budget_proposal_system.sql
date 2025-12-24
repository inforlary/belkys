/*
  # Bütçe Teklif Sistemi

  1. Tables
    - budget_proposal_campaigns - Bütçe hazırlık dönemleri
    - department_budget_limits - Müdürlük limitleri (opsiyonel)
    - budget_proposals - Bütçe teklifleri
    - budget_proposal_items - Teklif kalemleri (gösterge bağlantılı)
    - budget_proposal_approvals - Çoklu seviyeli onaylar
    - budget_proposal_history - Değişiklik geçmişi
    - budget_proposal_comments - Yorumlar

  2. Features
    - Mali yıl bazlı dönemler
    - 3 yıllık projeksiyon
    - Gösterge entegrasyonu
    - Versiyon kontrolü
    - Çoklu onay akışı
*/

CREATE TABLE IF NOT EXISTS budget_proposal_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  fiscal_year integer NOT NULL,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'review', 'approval', 'completed', 'cancelled')),
  allow_over_limit boolean DEFAULT false,
  require_indicator_link boolean DEFAULT true,
  require_justification boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_budget_campaigns_org ON budget_proposal_campaigns(organization_id);
CREATE INDEX idx_budget_campaigns_fiscal ON budget_proposal_campaigns(fiscal_year);

CREATE TABLE IF NOT EXISTS department_budget_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES budget_proposal_campaigns(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  year1_limit numeric(15,2),
  year2_limit numeric(15,2),
  year3_limit numeric(15,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(campaign_id, department_id)
);

CREATE INDEX idx_dept_limits_campaign ON department_budget_limits(campaign_id);

CREATE TABLE IF NOT EXISTS budget_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES budget_proposal_campaigns(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  version integer DEFAULT 1,
  is_latest boolean DEFAULT true,
  parent_proposal_id uuid REFERENCES budget_proposals(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'vp_review', 'vp_approved', 'vp_revision_requested', 'finance_review', 'finance_approved', 'finance_revision_requested', 'final_review', 'approved', 'rejected')),
  total_year1 numeric(15,2) DEFAULT 0,
  total_year2 numeric(15,2) DEFAULT 0,
  total_year3 numeric(15,2) DEFAULT 0,
  notes text,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(campaign_id, department_id, version)
);

CREATE INDEX idx_proposals_campaign ON budget_proposals(campaign_id);
CREATE INDEX idx_proposals_dept ON budget_proposals(department_id);

CREATE TABLE IF NOT EXISTS budget_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES budget_proposals(id) ON DELETE CASCADE NOT NULL,
  program_id uuid REFERENCES programs(id),
  sub_program_id uuid REFERENCES sub_programs(id),
  activity_id uuid REFERENCES activities(id),
  indicator_id uuid REFERENCES indicators(id),
  institutional_code_id uuid REFERENCES budget_institutional_codes(id),
  expense_economic_code_id uuid REFERENCES expense_economic_codes(id),
  financing_type_id uuid REFERENCES financing_types(id),
  year1 integer NOT NULL,
  year1_amount numeric(15,2) NOT NULL DEFAULT 0,
  year2 integer NOT NULL,
  year2_amount numeric(15,2) NOT NULL DEFAULT 0,
  year3 integer NOT NULL,
  year3_amount numeric(15,2) NOT NULL DEFAULT 0,
  increase_percentage numeric(5,2),
  description text,
  justification text,
  year_end_estimate text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_proposal_items_proposal ON budget_proposal_items(proposal_id);
CREATE INDEX idx_proposal_items_indicator ON budget_proposal_items(indicator_id);

CREATE TABLE IF NOT EXISTS budget_proposal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES budget_proposals(id) ON DELETE CASCADE NOT NULL,
  approval_level text NOT NULL CHECK (approval_level IN ('vice_president', 'finance', 'president')),
  approver_id uuid REFERENCES auth.users(id) NOT NULL,
  approver_role text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('pending', 'approved', 'rejected', 'revision_requested')),
  comments text,
  internal_notes text,
  requested_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approvals_proposal ON budget_proposal_approvals(proposal_id);

CREATE TABLE IF NOT EXISTS budget_proposal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES budget_proposals(id) ON DELETE CASCADE,
  item_id uuid REFERENCES budget_proposal_items(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES auth.users(id) NOT NULL,
  changed_by_name text NOT NULL,
  changed_by_role text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  notes text
);

CREATE INDEX idx_proposal_history_proposal ON budget_proposal_history(proposal_id);

CREATE TABLE IF NOT EXISTS budget_proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES budget_proposals(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES budget_proposal_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  comment text NOT NULL,
  comment_type text DEFAULT 'note' CHECK (comment_type IN ('note', 'question', 'revision_request', 'approval_note')),
  parent_comment_id uuid REFERENCES budget_proposal_comments(id),
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_proposal_comments_proposal ON budget_proposal_comments(proposal_id);

CREATE OR REPLACE FUNCTION update_proposal_totals() RETURNS TRIGGER AS $$
BEGIN
  UPDATE budget_proposals SET
    total_year1 = COALESCE((SELECT SUM(year1_amount) FROM budget_proposal_items WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id)), 0),
    total_year2 = COALESCE((SELECT SUM(year2_amount) FROM budget_proposal_items WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id)), 0),
    total_year3 = COALESCE((SELECT SUM(year3_amount) FROM budget_proposal_items WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id)), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proposal_totals ON budget_proposal_items;
CREATE TRIGGER trigger_update_proposal_totals AFTER INSERT OR UPDATE OR DELETE ON budget_proposal_items FOR EACH ROW EXECUTE FUNCTION update_proposal_totals();

ALTER TABLE budget_proposal_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_budget_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_proposal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_proposal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_proposal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select" ON budget_proposal_campaigns FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "campaigns_all" ON budget_proposal_campaigns FOR ALL TO authenticated USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "limits_select" ON department_budget_limits FOR SELECT TO authenticated USING (department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president')));
CREATE POLICY "limits_all" ON department_budget_limits FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "proposals_select" ON budget_proposals FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "proposals_insert" ON budget_proposals FOR INSERT TO authenticated WITH CHECK (department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "proposals_update_dept" ON budget_proposals FOR UPDATE TO authenticated USING (department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid()) AND status IN ('draft', 'vp_revision_requested', 'finance_revision_requested'));
CREATE POLICY "proposals_update_admin" ON budget_proposals FOR UPDATE TO authenticated USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president')));
CREATE POLICY "items_select" ON budget_proposal_items FOR SELECT TO authenticated USING (proposal_id IN (SELECT id FROM budget_proposals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "items_dept" ON budget_proposal_items FOR ALL TO authenticated USING (proposal_id IN (SELECT bp.id FROM budget_proposals bp INNER JOIN profiles p ON p.id = auth.uid() WHERE bp.department_id = p.department_id AND bp.status IN ('draft', 'vp_revision_requested', 'finance_revision_requested')));
CREATE POLICY "items_admin" ON budget_proposal_items FOR ALL TO authenticated USING (proposal_id IN (SELECT id FROM budget_proposals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president'))));
CREATE POLICY "approvals_select" ON budget_proposal_approvals FOR SELECT TO authenticated USING (proposal_id IN (SELECT id FROM budget_proposals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "approvals_all" ON budget_proposal_approvals FOR ALL TO authenticated USING (approver_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "history_select" ON budget_proposal_history FOR SELECT TO authenticated USING (proposal_id IN (SELECT id FROM budget_proposals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "history_insert" ON budget_proposal_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comments_select" ON budget_proposal_comments FOR SELECT TO authenticated USING ((NOT is_internal OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president'))) AND proposal_id IN (SELECT id FROM budget_proposals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "comments_insert" ON budget_proposal_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND proposal_id IN (SELECT id FROM budget_proposals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "comments_update" ON budget_proposal_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
