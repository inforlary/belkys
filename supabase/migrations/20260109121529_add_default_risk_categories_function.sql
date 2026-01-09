/*
  # Add Default Risk Categories Function

  1. Function
    - `initialize_default_risk_categories(org_id UUID)` - Creates default risk categories for an organization
    
  2. Categories Structure
    - External Risks (Dış Riskler)
      - Political, Economic, Social, Technological, Legal, Environmental
    - Internal Risks (İç Riskler)
      - Operational, Financial, Compliance, HR, IT, Reputation
*/

CREATE OR REPLACE FUNCTION initialize_default_risk_categories(org_id UUID)
RETURNS void AS $$
DECLARE
  external_risks_id UUID;
  internal_risks_id UUID;
BEGIN
  -- Check if categories already exist
  IF EXISTS (
    SELECT 1 FROM risk_categories 
    WHERE organization_id = org_id
  ) THEN
    RETURN;
  END IF;

  -- Insert main categories
  INSERT INTO risk_categories (organization_id, code, name, description, type, order_index, parent_id)
  VALUES 
    (org_id, 'DIS', 'Dış Riskler', 'Kurum dışı kaynaklı riskler', 'EXTERNAL', 1, NULL)
  RETURNING id INTO external_risks_id;

  INSERT INTO risk_categories (organization_id, code, name, description, type, order_index, parent_id)
  VALUES 
    (org_id, 'IC', 'İç Riskler', 'Kurum içi kaynaklı riskler', 'INTERNAL', 2, NULL)
  RETURNING id INTO internal_risks_id;

  -- Insert external risk subcategories
  INSERT INTO risk_categories (organization_id, parent_id, code, name, description, type, order_index)
  VALUES 
    (org_id, external_risks_id, 'DIS-POL', 'Politik Riskler', 'Siyasi değişikliklerden kaynaklanan riskler', 'EXTERNAL', 1),
    (org_id, external_risks_id, 'DIS-EKO', 'Ekonomik Riskler', 'Ekonomik koşullardan kaynaklanan riskler', 'EXTERNAL', 2),
    (org_id, external_risks_id, 'DIS-SOS', 'Sosyal Riskler', 'Toplumsal değişimlerden kaynaklanan riskler', 'EXTERNAL', 3),
    (org_id, external_risks_id, 'DIS-TEK', 'Teknolojik Riskler', 'Teknoloji değişimlerinden kaynaklanan riskler', 'EXTERNAL', 4),
    (org_id, external_risks_id, 'DIS-YAS', 'Yasal Riskler', 'Mevzuat değişikliklerinden kaynaklanan riskler', 'EXTERNAL', 5),
    (org_id, external_risks_id, 'DIS-CEV', 'Çevresel Riskler', 'Çevre ve iklimden kaynaklanan riskler', 'EXTERNAL', 6);

  -- Insert internal risk subcategories
  INSERT INTO risk_categories (organization_id, parent_id, code, name, description, type, order_index)
  VALUES 
    (org_id, internal_risks_id, 'IC-OPR', 'Operasyonel Riskler', 'Günlük operasyonlardan kaynaklanan riskler', 'INTERNAL', 1),
    (org_id, internal_risks_id, 'IC-FIN', 'Finansal Riskler', 'Mali kaynaklarla ilgili riskler', 'INTERNAL', 2),
    (org_id, internal_risks_id, 'IC-UYM', 'Uyum Riskleri', 'Mevzuata uyum ile ilgili riskler', 'INTERNAL', 3),
    (org_id, internal_risks_id, 'IC-IKY', 'İnsan Kaynakları Riskleri', 'Personel ile ilgili riskler', 'INTERNAL', 4),
    (org_id, internal_risks_id, 'IC-BIT', 'Bilgi Teknolojileri Riskleri', 'BT sistemleri ile ilgili riskler', 'INTERNAL', 5),
    (org_id, internal_risks_id, 'IC-ITB', 'İtibar Riskleri', 'Kurumsal itibar ile ilgili riskler', 'INTERNAL', 6);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
