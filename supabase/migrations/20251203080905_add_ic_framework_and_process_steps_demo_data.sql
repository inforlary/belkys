/*
  # Add Demo Data for IC Framework and Process Steps

  Adds:
  - Process steps for existing processes
  - RACI matrix entries
  - Segregation of Duties rules
  - Ethics commitments
*/

DO $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_admin_id uuid;
  v_process_id_1 uuid;
  v_process_id_2 uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND organization_id = v_org_id LIMIT 1;
  
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- Get process IDs
  SELECT id INTO v_process_id_1 FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-001';
  SELECT id INTO v_process_id_2 FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-002';

  -- ============================================================================
  -- 1. SÜREÇ ADIMLARI - Satın Alma Süreci
  -- ============================================================================
  
  IF v_process_id_1 IS NOT NULL THEN
    INSERT INTO ic_process_steps (organization_id, process_id, step_number, step_name, step_description, responsible_role, responsible_user_id, estimated_duration, inputs, outputs, tools_used)
    VALUES 
    (v_org_id, v_process_id_1, 1, 'İhtiyaç Tespiti', 'Satın alınacak mal veya hizmetin belirlenmesi ve talep formunun hazırlanması', 'Talep Eden Birim', v_admin_id, '1 gün', 'İhtiyaç listesi', 'Satın alma talep formu', 'Talep formu, E-posta'),
    (v_org_id, v_process_id_1, 2, 'Talep Onayı', 'Satın alma talebinin bütçe ve uygunluk açısından değerlendirilmesi', 'Birim Müdürü', v_admin_id, '2 gün', 'Satın alma talep formu', 'Onaylı talep', 'E-imza sistemi'),
    (v_org_id, v_process_id_1, 3, 'Tedarikçi Araştırması', 'Uygun tedarikçilerin araştırılması ve fiyat tekliflerinin alınması', 'Satın Alma Uzmanı', v_admin_id, '5 gün', 'Onaylı talep', 'Fiyat teklifleri', 'Tedarikçi veri tabanı'),
    (v_org_id, v_process_id_1, 4, 'Tedarikçi Değerlendirme', 'Fiyat, kalite ve teslimat süresi kriterlerine göre tedarikçi seçimi', 'Satın Alma Komisyonu', v_admin_id, '3 gün', 'Fiyat teklifleri', 'Tedarikçi seçim raporu', 'Değerlendirme matrisi'),
    (v_org_id, v_process_id_1, 5, 'Sipariş Oluşturma', 'Seçilen tedarikçiye resmi sipariş verilmesi', 'Satın Alma Uzmanı', v_admin_id, '1 gün', 'Tedarikçi seçim raporu', 'Satın alma siparişi', 'ERP Sistemi'),
    (v_org_id, v_process_id_1, 6, 'Teslimat Takibi', 'Sipariş edilen ürünlerin teslimat sürecinin takip edilmesi', 'Satın Alma Uzmanı', v_admin_id, 'Değişken', 'Satın alma siparişi', 'Teslimat bildirimi', 'Takip sistemi'),
    (v_org_id, v_process_id_1, 7, 'Kabul ve Muayene', 'Teslim alınan ürünlerin miktar ve kalite kontrolü', 'Muayene Komisyonu', v_admin_id, '2 gün', 'Teslimat', 'Kabul tutanağı', 'Muayene formu'),
    (v_org_id, v_process_id_1, 8, 'Fatura İşlemleri', 'Fatura kaydının oluşturulması ve ödeme emrinin verilmesi', 'Mali İşler', v_admin_id, '3 gün', 'Kabul tutanağı, Fatura', 'Ödeme emri', 'Muhasebe yazılımı');
  END IF;

  -- Bütçe Hazırlama Süreci Adımları
  IF v_process_id_2 IS NOT NULL THEN
    INSERT INTO ic_process_steps (organization_id, process_id, step_number, step_name, step_description, responsible_role, responsible_user_id, estimated_duration, inputs, outputs, tools_used)
    VALUES 
    (v_org_id, v_process_id_2, 1, 'Bütçe Çağrısı', 'Birimlerden bütçe tekliflerinin istenmesi', 'Strateji Geliştirme', v_admin_id, '1 hafta', 'Bütçe talimatı', 'Bütçe çağrı yazısı', 'E-posta, Portal'),
    (v_org_id, v_process_id_2, 2, 'Bütçe Tekliflerinin Hazırlanması', 'Her birimin kendi bütçe teklifini hazırlaması', 'Birim Yetkilileri', v_admin_id, '3 hafta', 'Bütçe çağrısı', 'Birim bütçe teklifleri', 'Excel, Bütçe şablonları'),
    (v_org_id, v_process_id_2, 3, 'Tekliflerin Konsolidasyonu', 'Tüm birim tekliflerinin birleştirilmesi', 'Mali İşler', v_admin_id, '1 hafta', 'Birim bütçe teklifleri', 'Konsolide bütçe taslağı', 'Bütçe yazılımı'),
    (v_org_id, v_process_id_2, 4, 'Üst Yönetim İncelemesi', 'Bütçe taslağının üst yönetim tarafından gözden geçirilmesi', 'Genel Müdür', v_admin_id, '1 hafta', 'Konsolide bütçe taslağı', 'Revize bütçe', 'Toplantılar'),
    (v_org_id, v_process_id_2, 5, 'Yönetim Kurulu Onayı', 'Bütçenin yönetim kurulu tarafından onaylanması', 'Yönetim Kurulu', v_admin_id, '1 hafta', 'Revize bütçe', 'Onaylı bütçe', 'YK Kararı'),
    (v_org_id, v_process_id_2, 6, 'Bütçe Dağıtımı', 'Onaylanan bütçenin birimlere bildirilmesi', 'Strateji Geliştirme', v_admin_id, '3 gün', 'Onaylı bütçe', 'Birim bütçe dağıtımları', 'Resmi yazı');
  END IF;

  -- ============================================================================
  -- 2. RACI MATRİSİ
  -- ============================================================================
  
  IF v_process_id_1 IS NOT NULL THEN
    INSERT INTO ic_raci_matrix (organization_id, process_id, activity_name, responsible_role, responsible_user_id, accountable_role, accountable_user_id, consulted_roles, informed_roles)
    VALUES 
    (v_org_id, v_process_id_1, 'İhtiyaç Tespiti ve Talep', 'Talep Eden Birim Personeli', v_admin_id, 'Birim Müdürü', v_admin_id, ARRAY['Satın Alma Uzmanı'], ARRAY['Mali İşler']),
    (v_org_id, v_process_id_1, 'Tedarikçi Seçimi', 'Satın Alma Uzmanı', v_admin_id, 'Satın Alma Müdürü', v_admin_id, ARRAY['Teknik Uzman', 'Mali İşler'], ARRAY['Talep Eden Birim']),
    (v_org_id, v_process_id_1, 'Sipariş Onayı', 'Satın Alma Müdürü', v_admin_id, 'Genel Müdür Yardımcısı', v_admin_id, ARRAY['Mali İşler', 'Hukuk'], ARRAY['Talep Eden Birim']),
    (v_org_id, v_process_id_1, 'Muayene ve Kabul', 'Muayene Komisyonu', v_admin_id, 'Talep Eden Birim Müdürü', v_admin_id, ARRAY['Teknik Uzman'], ARRAY['Satın Alma', 'Mali İşler']);
  END IF;

  IF v_process_id_2 IS NOT NULL THEN
    INSERT INTO ic_raci_matrix (organization_id, process_id, activity_name, responsible_role, responsible_user_id, accountable_role, accountable_user_id, consulted_roles, informed_roles)
    VALUES 
    (v_org_id, v_process_id_2, 'Bütçe Teklifi Hazırlama', 'Birim Bütçe Sorumlusu', v_admin_id, 'Birim Müdürü', v_admin_id, ARRAY['Strateji Geliştirme', 'Mali İşler'], ARRAY['Üst Yönetim']),
    (v_org_id, v_process_id_2, 'Bütçe Konsolidasyonu', 'Mali İşler Müdürü', v_admin_id, 'Genel Müdür Yardımcısı (Mali)', v_admin_id, ARRAY['Strateji Geliştirme', 'Tüm Birimler'], ARRAY['Genel Müdür']),
    (v_org_id, v_process_id_2, 'Bütçe Onayı', 'Genel Müdür', v_admin_id, 'Yönetim Kurulu Başkanı', v_admin_id, ARRAY['Mali İşler', 'Strateji Geliştirme'], ARRAY['Tüm Birimler']);
  END IF;

  -- ============================================================================
  -- 3. GÖREVLER AYRILLIĞI KURALLARI
  -- ============================================================================
  
  INSERT INTO ic_sod_rules (organization_id, rule_code, rule_name, rule_description, conflicting_function_1, conflicting_function_2, risk_if_combined, mitigation_control, status)
  VALUES 
  (v_org_id, 'SOD-001', 'Satın Alma ve Muhasebe Ayrılığı', 'Satın alma yapan kişi aynı işlem için muhasebe kaydı yapamaz', 'Satın alma siparişi oluşturma', 'Fatura kaydı ve ödeme onayı', 'Yetkisiz harcama ve zimmet riski', 'Muayene komisyonu kontrolü ve çift imza', 'active'),
  (v_org_id, 'SOD-002', 'Bütçe Hazırlama ve Onay Ayrılığı', 'Bütçe hazırlayan kişi kendi bütçesini onaylayamaz', 'Bütçe teklifi hazırlama', 'Bütçe onayı', 'Gerçekçi olmayan bütçe oluşturma riski', 'Hiyerarşik onay süreci', 'active'),
  (v_org_id, 'SOD-003', 'Sistem Yöneticisi ve Kullanıcı Rolü Ayrılığı', 'Sistem yöneticisi operasyonel işlem yapamaz', 'Sistem yönetimi ve kullanıcı yetkilendirme', 'Operasyonel veri girişi ve işlem onayı', 'Yetkisiz erişim ve veri manipülasyonu', 'Erişim logları ve periyodik gözden geçirme', 'active'),
  (v_org_id, 'SOD-004', 'Kasa ve Kayıt Ayrılığı', 'Kasa işlemi yapan kişi muhasebe kaydını yapamaz', 'Nakit para giriş-çıkış işlemleri', 'Muhasebe kaydı ve mutabakat', 'Para zimmeti ve kayıt tutarsızlığı riski', 'Günlük mutabakat ve çapraz kontrol', 'active'),
  (v_org_id, 'SOD-005', 'İşe Alım ve Bordro Hazırlama Ayrılığı', 'Personel işe alan kişi bordro hazırlayamaz', 'Personel işe alım onayı', 'Bordro hazırlama ve ödeme', 'Hayali personel kaydı riski', 'İK ve Mali İşler ayrımı, çapraz kontrol', 'active'),
  (v_org_id, 'SOD-006', 'Stok Sayımı ve Kayıt Ayrılığı', 'Stok sayımı yapan kişi stok kaydını tutamaz', 'Fiziki stok sayımı', 'Stok kartı kaydı ve güncelleme', 'Stok tutarsızlığı ve zimmet riski', 'Sayım komisyonu ve bağımsız kayıt', 'active');

  -- ============================================================================
  -- 4. ETİK TAAHHÜTLER
  -- ============================================================================
  
  INSERT INTO ic_ethics_commitments (organization_id, user_id, commitment_year, signed_date, has_conflicts, status)
  VALUES 
  (v_org_id, v_admin_id, EXTRACT(YEAR FROM CURRENT_DATE)::integer, CURRENT_DATE - INTERVAL '30 days', false, 'signed');

  RAISE NOTICE 'IC Framework and Process Steps demo data added successfully';
END $$;