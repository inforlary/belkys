/*
  # İç Kontrol Standartları Demo Verileri
  
  1. Bileşenler
    - KONTROL ORTAMI (KOS)
    
  2. Standartlar
    - KOS.1: Etik Değerler ve Dürüstlük
    - KOS.2: Misyon, Organizasyon Yapısı ve Görevler  
    - KOS.3: Personelin Yeterliliği ve Performansı
    
  3. Genel Şartlar
    - Her standart altında genel şartlar görseldeki gibi
*/

-- KONTROL ORTAMI Bileşeni (global - organization_id NULL)
INSERT INTO ic_components (code, name, order_index, organization_id)
VALUES ('KOS', 'KONTROL ORTAMI', 1, NULL)
ON CONFLICT DO NOTHING;

-- Standartlar
WITH component AS (
  SELECT id FROM ic_components WHERE code = 'KOS' LIMIT 1
)
INSERT INTO ic_standards (component_id, code, name, description, order_index)
SELECT 
  component.id,
  'KOS.1',
  'Etik Değerler ve Dürüstlük',
  'Personel davranışlarını belirleyen kuralların personel tarafından bilinmesi sağlanmalıdır.',
  1
FROM component
UNION ALL
SELECT 
  component.id,
  'KOS.2',
  'Misyon, Organizasyon Yapısı ve Görevler',
  'İdarelerin misyonu ile birimlerin ve personelin görev tanımları belirlenmiş, personele duyurulmuş ve idarede uygun bir organizasyon yapısı oluşturulmalıdır.',
  2
FROM component
UNION ALL
SELECT 
  component.id,
  'KOS.3',
  'Personelin Yeterliliği ve Performansı',
  'İdarelerin görevlerini etkin ve verimli biçimde yerine getirebilmesi için, personelin yeterliliği ve performans değerlendirmesi ve geliştirilmesine yönelik önlemler alınmalıdır.',
  3
FROM component
ON CONFLICT DO NOTHING;

-- KOS.1 Genel Şartları
WITH standard AS (
  SELECT id FROM ic_standards WHERE code = 'KOS.1' LIMIT 1
)
INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
SELECT 
  standard.id,
  'KOS 1.1',
  'İç kontrol sistemi ve işleyişi yönetici ve personel tarafından sahiplenilmeli ve desteklenmelidir.',
  1
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 1.2',
  'İdarenin yöneticileri iç kontrol sisteminin uygulanmasında personele örnek olmalıdır.',
  2
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 1.3',
  'Etik kurallar bilinmeli ve tüm faaliyetlerde bu kurallara uyulmalıdır.',
  3
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 1.4',
  'Faaliyetlerde dürüstlük, saydamlık ve hesap verebilirlik sağlanmalıdır.',
  4
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 1.5',
  'İdarenin personeline ve hizmet verilenlere adil ve eşit davranılmalıdır.',
  5
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 1.6',
  'İdarenin faaliyetlerine ilişkin tüm bilgi ve belgeler doğru, tam ve güvenilir olmalıdır.',
  6
FROM standard
ON CONFLICT DO NOTHING;

-- KOS.2 Genel Şartları
WITH standard AS (
  SELECT id FROM ic_standards WHERE code = 'KOS.2' LIMIT 1
)
INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
SELECT 
  standard.id,
  'KOS 2.1',
  'İdarenin misyonu yazılı olarak belirlenmeli, duyurulmalı ve personel tarafından benimsenmesi sağlanmalıdır.',
  1
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 2.2',
  'Misyonun gerçekleştirilmesini sağlamak üzere idare birimleri ve alt birimlerce yürütülecek görevler yazılı olarak tanımlanmalı ve duyurulmalıdır.',
  2
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 2.3',
  'İdare birimlerinde personelin görevleri ve bu görevlere ilişkin yetki ve sorumlulukları kapsamı ve sınırları çizilerek, personele duyurulmalıdır.',
  3
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 2.4',
  'İdarenin ve birimlerin teşkilat şeması olmalı ve buna bağlı olarak fonksiyonel organizasyon yapısı belirlenmelidir.',
  4
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 2.5',
  'İdarenin ve birimlerin organizasyon yapısı, temel yetki ve sorumluluk dağılımı, hesap verebilirlik ve uygun raporlama ilişkisini gösterecek şekilde olmalıdır.',
  5
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 2.6',
  'İdarenin yöneticileri, faaliyetlerin yürütülmesinde hassas görevleri ile ilişkin prosedürleri belirlemeli ve personele duyurmalıdır.',
  6
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 2.7',
  'Her düzeydeki yöneticiler verilen görevlerin sonucunu izlemeye yönelik mekanizmalar oluşturmalıdır.',
  7
FROM standard
ON CONFLICT DO NOTHING;

-- KOS.3 Genel Şartları
WITH standard AS (
  SELECT id FROM ic_standards WHERE code = 'KOS.3' LIMIT 1
)
INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
SELECT 
  standard.id,
  'KOS 3.1',
  'İnsan kaynakları yönetimi, idarenin amaç ve hedeflerinin gerçekleşmesini sağlamaya yönelik olmalıdır.',
  1
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 3.2',
  'İdarenin yöneticisi ve personel görevleri etkin ve etkili bir şekilde yürütebilecek bilgi, deneyim ve yeteneğe sahip olmalıdır.',
  2
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 3.3',
  'Mesleki yeterliliğe önem verilmeli ve her görev için en uygun personel seçilmelidir.',
  3
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 3.4',
  'Personelin işe alınması ile görevinde ilerlemesi ve yükselmesinde liyakat ilkesine uyulmalı ve bireysel performans göz önünde bulundurulmalıdır.',
  4
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 3.5',
  'Her görev için gerekli eğitim belirlenmeli, bu ihtiyacı giderecek eğitim faaliyetleri her yıl planlanarak yürütülmeli ve gerektiğinde güncellenmelidir.',
  5
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 3.6',
  'Personelin yeterliliği ve performansı bağlı olduğu yöneticisi tarafından en az yılda bir kez değerlendirilmeli ve değerlendirme sonuçları personel ile paylaşılmalıdır.',
  6
FROM standard
UNION ALL
SELECT 
  standard.id,
  'KOS 3.7',
  'Performans değerlendirmesine göre performansı yetersiz bulunan personelin performansını geliştirmeye yönelik önlemler alınmalı, yüksek performans gösteren personelin motivasyonu artırıcı mekanizmalar geliştirilmelidir.',
  7
FROM standard
ON CONFLICT DO NOTHING;