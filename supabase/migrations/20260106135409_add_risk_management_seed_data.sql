/*
  # Risk Yönetimi Seed Data

  1. Risk Kategorileri
    - Ana kategoriler: Dış ve İç Riskler
    - Alt kategoriler: 7 risk tipi

  2. Olasılık Kriterleri
    - 5 seviyeli olasılık skalası

  3. Etki Kriterleri
    - Mali, Operasyonel, İtibar, Yasal, Stratejik
    - Her biri için 5 seviye
*/

-- Risk Kategorileri: Ana Kategoriler
INSERT INTO risk_categories (organization_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1) as organization_id,
  'EXTERNAL' as code,
  'Dış Riskler' as name,
  'EXTERNAL' as type,
  'Kurum dışı kaynaklı riskler' as description,
  '#3B82F6' as color,
  'Globe' as icon,
  1 as order_index
WHERE NOT EXISTS (
  SELECT 1 FROM risk_categories 
  WHERE code = 'EXTERNAL' 
  AND organization_id = (SELECT id FROM organizations LIMIT 1)
);

INSERT INTO risk_categories (organization_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'INTERNAL',
  'İç Riskler',
  'INTERNAL',
  'Kurum içi kaynaklı riskler',
  '#22C55E',
  'Building',
  2
WHERE NOT EXISTS (
  SELECT 1 FROM risk_categories 
  WHERE code = 'INTERNAL' 
  AND organization_id = (SELECT id FROM organizations LIMIT 1)
);

-- Alt Kategoriler: Dış Riskler
INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'EXTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'EXT-STR',
  'Stratejik Riskler',
  'EXTERNAL',
  'Politik, ekonomik, sosyal ve teknolojik değişimlerden kaynaklanan riskler',
  '#3B82F6',
  'Target',
  1
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'EXT-STR');

INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'EXTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'EXT-CMP',
  'Uyum Riskleri',
  'EXTERNAL',
  'Mevzuat değişiklikleri ve düzenleyici gerekliliklerden kaynaklanan riskler',
  '#8B5CF6',
  'Scale',
  2
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'EXT-CMP');

INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'EXTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'EXT-REP',
  'İtibar Riskleri',
  'EXTERNAL',
  'Kamuoyu algısı ve paydaş beklentilerinden kaynaklanan riskler',
  '#EC4899',
  'Users',
  3
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'EXT-REP');

-- Alt Kategoriler: İç Riskler
INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'INTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'INT-OPR',
  'Operasyonel Riskler',
  'INTERNAL',
  'Süreç, insan ve altyapı kaynaklı riskler',
  '#22C55E',
  'Cog',
  1
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'INT-OPR');

INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'INTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'INT-FIN',
  'Finansal Riskler',
  'INTERNAL',
  'Bütçe, nakit akışı ve mali yönetim riskleri',
  '#F59E0B',
  'DollarSign',
  2
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'INT-FIN');

INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'INTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'INT-TEC',
  'Teknolojik Riskler',
  'INTERNAL',
  'Bilgi sistemleri, siber güvenlik ve teknoloji riskleri',
  '#06B6D4',
  'Server',
  3
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'INT-TEC');

INSERT INTO risk_categories (organization_id, parent_id, code, name, type, description, color, icon, order_index)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM risk_categories WHERE code = 'INTERNAL' AND organization_id = (SELECT id FROM organizations LIMIT 1)),
  'INT-HR',
  'İnsan Kaynakları Riskleri',
  'INTERNAL',
  'Personel yetkinliği, motivasyon ve devir riskleri',
  '#F97316',
  'UserX',
  4
WHERE NOT EXISTS (SELECT 1 FROM risk_categories WHERE code = 'INT-HR');

-- Olasılık Kriterleri
INSERT INTO risk_likelihood_criteria (organization_id, level, level_name, description, frequency_range, probability_range)
SELECT (SELECT id FROM organizations LIMIT 1), 1, 'Çok Düşük', 'Gerçekleşmesi çok nadir beklenir', '10 yılda bir veya daha az', '%0-10'
WHERE NOT EXISTS (SELECT 1 FROM risk_likelihood_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND level = 1);

INSERT INTO risk_likelihood_criteria (organization_id, level, level_name, description, frequency_range, probability_range)
SELECT (SELECT id FROM organizations LIMIT 1), 2, 'Düşük', 'Gerçekleşmesi nadir beklenir', '5-10 yılda bir', '%10-30'
WHERE NOT EXISTS (SELECT 1 FROM risk_likelihood_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND level = 2);

INSERT INTO risk_likelihood_criteria (organization_id, level, level_name, description, frequency_range, probability_range)
SELECT (SELECT id FROM organizations LIMIT 1), 3, 'Orta', 'Gerçekleşmesi muhtemeldir', '1-5 yılda bir', '%30-50'
WHERE NOT EXISTS (SELECT 1 FROM risk_likelihood_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND level = 3);

INSERT INTO risk_likelihood_criteria (organization_id, level, level_name, description, frequency_range, probability_range)
SELECT (SELECT id FROM organizations LIMIT 1), 4, 'Yüksek', 'Gerçekleşmesi kuvvetle muhtemeldir', 'Yılda 1-2 kez', '%50-70'
WHERE NOT EXISTS (SELECT 1 FROM risk_likelihood_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND level = 4);

INSERT INTO risk_likelihood_criteria (organization_id, level, level_name, description, frequency_range, probability_range)
SELECT (SELECT id FROM organizations LIMIT 1), 5, 'Çok Yüksek', 'Gerçekleşmesi neredeyse kesindir', 'Yılda birden fazla', '%70-100'
WHERE NOT EXISTS (SELECT 1 FROM risk_likelihood_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND level = 5);

-- Etki Kriterleri: Mali
INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'FINANCIAL', 1, 'Çok Düşük', 'Önemsiz mali kayıp', '0 - 50.000 TL'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'FINANCIAL' AND level = 1);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'FINANCIAL', 2, 'Düşük', 'Küçük mali kayıp, bütçe içinde karşılanabilir', '50.000 - 250.000 TL'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'FINANCIAL' AND level = 2);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'FINANCIAL', 3, 'Orta', 'Orta düzeyde mali kayıp, bütçe revizyonu gerektirebilir', '250.000 - 1.000.000 TL'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'FINANCIAL' AND level = 3);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'FINANCIAL', 4, 'Yüksek', 'Önemli mali kayıp, ek kaynak gerektirir', '1.000.000 - 5.000.000 TL'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'FINANCIAL' AND level = 4);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'FINANCIAL', 5, 'Çok Yüksek', 'Kritik mali kayıp, kurumu ciddi şekilde etkiler', '5.000.000 TL üzeri'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'FINANCIAL' AND level = 5);

-- Etki Kriterleri: Operasyonel
INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'OPERATIONAL', 1, 'Çok Düşük', 'Hizmet aksaması yok veya çok kısa süreli', '1 saatten az kesinti'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'OPERATIONAL' AND level = 1);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'OPERATIONAL', 2, 'Düşük', 'Küçük hizmet aksaması, hızla telafi edilebilir', '1-8 saat kesinti'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'OPERATIONAL' AND level = 2);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'OPERATIONAL', 3, 'Orta', 'Belirli hizmetlerde aksama, alternatif çözüm gerektirir', '1-3 gün kesinti'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'OPERATIONAL' AND level = 3);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'OPERATIONAL', 4, 'Yüksek', 'Önemli hizmet kesintisi, geniş kesimi etkiler', '3-7 gün kesinti'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'OPERATIONAL' AND level = 4);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'OPERATIONAL', 5, 'Çok Yüksek', 'Kritik hizmetler durur, uzun süreli etki', '7 günden fazla kesinti'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'OPERATIONAL' AND level = 5);

-- Etki Kriterleri: İtibar
INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'REPUTATIONAL', 1, 'Çok Düşük', 'İtibar etkisi yok veya fark edilmez', 'Kurum içi bilgi'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'REPUTATIONAL' AND level = 1);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'REPUTATIONAL', 2, 'Düşük', 'Sınırlı olumsuz algı, kısa sürede unutulur', 'Yerel medyada kısa haber'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'REPUTATIONAL' AND level = 2);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'REPUTATIONAL', 3, 'Orta', 'Orta düzeyde olumsuz algı, düzeltme gerektirir', 'Yerel/bölgesel medyada haber'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'REPUTATIONAL' AND level = 3);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'REPUTATIONAL', 4, 'Yüksek', 'Ciddi itibar kaybı, güven sarsılır', 'Ulusal medyada haber'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'REPUTATIONAL' AND level = 4);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'REPUTATIONAL', 5, 'Çok Yüksek', 'Kurumsal itibar ciddi zarar görür', 'Ulusal gündem, sosyal medya krizi'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'REPUTATIONAL' AND level = 5);

-- Etki Kriterleri: Yasal
INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'LEGAL', 1, 'Çok Düşük', 'Yasal risk yok veya önemsiz', 'İhtar almama'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'LEGAL' AND level = 1);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'LEGAL', 2, 'Düşük', 'Küçük yasal uyarı veya ihtar', 'İdari ihtar'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'LEGAL' AND level = 2);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'LEGAL', 3, 'Orta', 'İdari para cezası olasılığı', 'İdari para cezası'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'LEGAL' AND level = 3);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'LEGAL', 4, 'Yüksek', 'Dava ve önemli ceza riski', 'Dava, yüksek ceza'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'LEGAL' AND level = 4);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'LEGAL', 5, 'Çok Yüksek', 'Ciddi yasal yaptırım, faaliyet durdurma', 'Faaliyet durdurma, lisans iptali'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'LEGAL' AND level = 5);

-- Etki Kriterleri: Stratejik
INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'STRATEGIC', 1, 'Çok Düşük', 'Stratejik hedeflere etkisi yok', 'Hedeflere etki yok'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'STRATEGIC' AND level = 1);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'STRATEGIC', 2, 'Düşük', 'Bazı küçük hedeflerde gecikme', 'Küçük gecikme (%0-5)'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'STRATEGIC' AND level = 2);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'STRATEGIC', 3, 'Orta', 'Önemli hedeflerde gecikme', 'Orta gecikme (%5-15)'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'STRATEGIC' AND level = 3);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'STRATEGIC', 4, 'Yüksek', 'Ana stratejik hedeflere ciddi etki', 'Ciddi gecikme (%15-30)'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'STRATEGIC' AND level = 4);

INSERT INTO risk_impact_criteria (organization_id, impact_area, level, level_name, description, quantitative_range)
SELECT (SELECT id FROM organizations LIMIT 1), 'STRATEGIC', 5, 'Çok Yüksek', 'Stratejik planın başarısızlığı', 'Hedeflere ulaşılamama (%30+)'
WHERE NOT EXISTS (SELECT 1 FROM risk_impact_criteria WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND impact_area = 'STRATEGIC' AND level = 5);
