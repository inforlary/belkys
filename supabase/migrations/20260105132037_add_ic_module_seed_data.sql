/*
  # İç Kontrol Modülü - Seed Data

  1. Veri Ekleme
    - 5 ana iç kontrol bileşeni
    - 18 iç kontrol standardı (KOS1-KOS18)

  2. Bileşenler
    - Kontrol Ortamı (KO) - Mavi
    - Risk Değerlendirme (RD) - Turuncu
    - Kontrol Faaliyetleri (KF) - Yeşil
    - Bilgi ve İletişim (BI) - Mor
    - İzleme (IZ) - Kırmızı
*/

-- 5 Ana Bileşen
INSERT INTO ic_components (code, name, description, order_index, color) VALUES
('KO', 'Kontrol Ortamı', 'Kontrol ortamı, iç kontrolün temelini oluşturur ve iç kontrolün diğer unsurlarının şekillenmesinde etkilidir. Kontrol ortamı, personelin kontrol bilincinin şekillenmesini sağlar.', 1, '#3B82F6'),
('RD', 'Risk Değerlendirme', 'Risk değerlendirme, idarelerin amaçlarına ulaşmalarını engelleyebilecek risklerin belirlenmesi ve analiz edilmesidir.', 2, '#F97316'),
('KF', 'Kontrol Faaliyetleri', 'Kontrol faaliyetleri, risklerin yönetilebilir düzeye indirilmesini sağlamak amacıyla oluşturulan politika ve prosedürlerdir.', 3, '#22C55E'),
('BI', 'Bilgi ve İletişim', 'İdarelerde, iç kontrolün işleyişi için gerekli bilginin üretilmesi, kaydedilmesi ve iletilmesidir.', 4, '#A855F7'),
('IZ', 'İzleme', 'İç kontrolün kalitesinin sürekli veya belirli dönemlerde değerlendirilmesidir.', 5, '#EF4444')
ON CONFLICT (code) DO NOTHING;

-- 18 Standart
DO $$
DECLARE
  v_ko_id uuid;
  v_rd_id uuid;
  v_kf_id uuid;
  v_bi_id uuid;
  v_iz_id uuid;
BEGIN
  -- Bileşen ID'lerini al
  SELECT id INTO v_ko_id FROM ic_components WHERE code = 'KO';
  SELECT id INTO v_rd_id FROM ic_components WHERE code = 'RD';
  SELECT id INTO v_kf_id FROM ic_components WHERE code = 'KF';
  SELECT id INTO v_bi_id FROM ic_components WHERE code = 'BI';
  SELECT id INTO v_iz_id FROM ic_components WHERE code = 'IZ';

  -- KONTROL ORTAMI STANDARTLARI
  INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
  (v_ko_id, 'KOS1', 'Etik Değerler ve Dürüstlük', 
   'Etik değerler ve dürüstlük, idarenin kontrol ortamının temelini oluşturur. Üst yönetici, idarede etik değerleri ve dürüstlüğü tesis etmek, geliştirmek ve sürdürmekle sorumludur.',
   'a) İdarede etik değerler ve dürüstlük belirlenerek yazılı hale getirilir ve ilan edilir.
b) İdarede etik değerlere ve dürüstlüğe uygun davranışlar teşvik edilir; etik değerlere aykırı davranışlar ve yolsuzluk önlenir ve tespit edildiğinde gereği yapılır.
c) Personelin görevlerini yerine getirirken uymaları gereken etik kurallar yazılı hale getirilir.', 1),

  (v_ko_id, 'KOS2', 'Misyon, Organizasyon Yapısı ve Görevler',
   'İdarelerin yönetim sorumluluklarının belirlenmesinde ve kontrolün gerçekleştirilmesinde, idare misyonunun, organizasyon yapısının ve görev tanımlarının oluşturulması gerekir.',
   'a) İdarenin misyonu belirlenir ve belgelendirilir.
b) İdarenin görev, yetki ve sorumlulukları mevzuatla uyumlu olarak belirlenir ve personele duyurulur.
c) Görev, yetki ve sorumluluklar hiyerarşik düzeyde açık bir şekilde belirlenir.
d) İdarenin organizasyon yapısı görev ve sorumlulukları ile uyumlu olarak oluşturulur.', 2),

  (v_ko_id, 'KOS3', 'Personelin Yeterliliği ve Performansı',
   'Personelin görevlerini gereği gibi yerine getirebilmeleri için yeterli bilgi, beceri ve deneyime sahip olmaları gerekir.',
   'a) İş ve işlemler, yeterli bilgi, beceri ve deneyime sahip personel tarafından yürütülür.
b) Üst yönetici tarafından personelin performans hedefleri belirlenir ve bu hedeflere ulaşma durumu izlenir ve değerlendirilir.
c) Personelin performansı, görevin önemi ve karmaşıklığı, gerekli nitelikler, kullanılabilir kaynaklar gibi faktörler dikkate alınarak ölçülür.', 3),

  (v_ko_id, 'KOS4', 'Yetki Devri',
   'İdarelerde etkin bir kontrol ortamının oluşturulması açısından yetki devri önem arz eder.',
   'a) Görev, yetki ve sorumluluklar belirlenirken yönetici ve personelin görev tanımları açıkça yapılır.
b) Yetki devri yazılı olarak yapılır.
c) Yetki devri yapılırken devrolunanın sahip olduğu bilgi, beceri ve deneyim göz önünde bulundurulur.
d) Devredilen yetkiler düzenli olarak gözden geçirilir.', 4);

  -- RİSK DEĞERLENDİRME STANDARTLARI
  INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
  (v_rd_id, 'KOS5', 'Planlama ve Programlama',
   'İdarelerin amaçlarına ulaşabilmeleri için stratejik plan ve performans programlarını hazırlamaları ve bu çerçevede faaliyetlerini yürütmeleri gerekir.',
   'a) İdareler, stratejik plan hazırlar.
b) İdareler, stratejik planları doğrultusunda performans programı hazırlar.
c) Stratejik plan ve performans programı hazırlanırken ilgili tarafların görüşlerine başvurulur.
d) Stratejik plan ve performans programı kamuoyuna duyurulur.', 5),

  (v_rd_id, 'KOS6', 'Risklerin Belirlenmesi ve Değerlendirilmesi',
   'İdarelerin amaçlarına ulaşmalarını tehdit eden unsurlar (riskler) belirlenmeli ve bu risklere karşı uygun kontroller oluşturulmalıdır.',
   'a) İdarenin amaçlarına ulaşmasını engelleyebilecek riskler belirlenir.
b) Belirlenen riskler analiz edilir ve önceliklendirilir.
c) Risklere karşı alınacak önlemler belirlenir.
d) Risk değerlendirmesi düzenli olarak tekrarlanır.
e) Risk yönetim sistemi oluşturulur ve sürdürülür.', 6);

  -- KONTROL FAALİYETLERİ STANDARTLARI
  INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
  (v_kf_id, 'KOS7', 'Kontrol Stratejileri ve Yöntemleri',
   'İdarelerin amaçlarına ulaşmalarını engelleyebilecek risklere karşı uygun kontrol strateji ve yöntemleri belirlenmelidir.',
   'a) Riskler değerlendirilerek kontrol stratejileri belirlenir.
b) Kontrol faaliyetleri, risklerin yönetilebilir seviyeye indirilmesini sağlayacak şekilde tasarlanır ve uygulanır.
c) Kontroller, maliyetler ile sağlayacağı faydalar gözetilerek belirlenir.', 7),

  (v_kf_id, 'KOS8', 'Prosedürlerin Belirlenmesi ve Belgelendirilmesi',
   'İdarelerin faaliyetlerinin prosedürlere bağlanarak belgelendirilmesi, idarelerin amaçlarına ulaşmasını kolaylaştırır.',
   'a) İş ve işlemlerin nasıl yürütüleceğini gösteren prosedürler yazılı hale getirilir.
b) Prosedürler, iş ve işlemlerin etkin ve verimli yürütülmesini sağlayacak şekilde hazırlanır.
c) Prosedürler periyodik olarak gözden geçirilir ve güncellenir.', 8),

  (v_kf_id, 'KOS9', 'Görevler Ayrılığı',
   'İdarelerde hata, usulsüzlük ve yolsuzluk riskini azaltmak amacıyla görevler ayrılığı sağlanmalıdır.',
   'a) İş ve işlemlerin yetkilendirme, onay, muhasebeleştirme ve kayıt gibi aşamalarının farklı kişilerce yapılması sağlanır.
b) Aynı işlem için hem girdi sağlama hem de kontrol yetkisine sahip olunmaz.
c) Görevler ayrılığının sağlanamadığı durumlarda telafi edici kontroller oluşturulur.', 9),

  (v_kf_id, 'KOS10', 'Hiyerarşik Kontroller',
   'Her kademedeki yöneticiler, görevleri kapsamında bulunan iş ve işlemleri kontrol etmekle sorumludur.',
   'a) Yöneticiler, sorumlu oldukları iş ve işlemleri düzenli olarak gözden geçirir.
b) İş ve işlemler, onaylanmadan önce kontrol edilir.
c) Personelin görevlerini yerine getirip getirmediği izlenir.', 10),

  (v_kf_id, 'KOS11', 'Faaliyetlerin Sürekliliği',
   'İdarelerin faaliyetlerinin kesintiye uğraması durumunda, önemli faaliyetlerin devam etmesini sağlayacak planlar oluşturulmalıdır.',
   'a) İdarenin önemli faaliyetleri belirlenir.
b) Faaliyetlerin aksama ihtimaline karşı önlemler alınır.
c) Felaket ve kriz durumlarında uygulanacak planlar hazırlanır.', 11),

  (v_kf_id, 'KOS12', 'Bilgi Sistemleri Kontrolleri',
   'Bilgi sistemleri, idare faaliyetlerinin yürütülmesinde ve izlenmesinde önemli bir araçtır. Bu sistemlerin güvenliği ve sürekliliği sağlanmalıdır.',
   'a) Bilgi sistemlerinin güvenliği sağlanır.
b) Bilgi sistemlerine erişim yetkileri belirlenir ve kontrol edilir.
c) Bilgi sistemlerinde yapılan değişiklikler kontrol edilir ve test edilir.
d) Bilgi sistemlerinin sürekliliği sağlanır.', 12);

  -- BİLGİ VE İLETİŞİM STANDARTLARI
  INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
  (v_bi_id, 'KOS13', 'Bilgi ve İletişim',
   'İç kontrolün işleyişi için gerekli olan bilginin üretilmesi, kaydedilmesi ve iletilmesi gerekir.',
   'a) İdarenin iş ve işlemlerinin yürütülmesi için gerekli bilgi belirlenir, üretilir ve kaydedilir.
b) Bilgi, ihtiyaç duyan kişilere zamanında ve uygun biçimde iletilir.
c) İletişim kanalları belirlenir ve etkin bir şekilde kullanılır.', 13),

  (v_bi_id, 'KOS14', 'Raporlama',
   'İdarelerin yönetim kararlarına temel oluşturacak ve hesap verme sorumluluğunu yerine getirmeye yönelik raporlama sistemleri oluşturulmalıdır.',
   'a) Mali raporlar mevzuata uygun olarak hazırlanır ve sunulur.
b) Performans raporları hazırlanır ve kamuoyuna duyurulur.
c) Raporlar, doğru, tutarlı, karşılaştırılabilir ve zamanında sunulur.', 14),

  (v_bi_id, 'KOS15', 'Kayıt ve Dosyalama Sistemi',
   'İdarelerin yürüttüğü iş ve işlemlere ilişkin bilgi ve belgeler kayıt altına alınmalı ve muhafaza edilmelidir.',
   'a) İş ve işlemlere ilişkin belgeler kayıt altına alınır.
b) Belgeler, kolay erişim ve güvenli muhafaza sağlayacak şekilde dosyalanır.
c) Belgelerin saklama süreleri mevzuata uygun olarak belirlenir.', 15),

  (v_bi_id, 'KOS16', 'Hata, Usulsüzlük ve Yolsuzlukların Bildirilmesi',
   'İdarelerde tespit edilen hata, usulsüzlük ve yolsuzluklar ile kontrol zayıflıklarının bildirilmesini sağlayacak sistemler oluşturulmalıdır.',
   'a) Personel, tespit ettikleri hata ve usulsüzlükleri üstlerine bildirmeye teşvik edilir.
b) Bildirimlerin değerlendirilmesi ve gerekli işlemlerin yapılması için prosedürler oluşturulur.
c) Bildirimlerin gizliliği ve bildirenlerin korunması sağlanır.', 16);

  -- İZLEME STANDARTLARI
  INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
  (v_iz_id, 'KOS17', 'İç Kontrolün Değerlendirilmesi',
   'İç kontrolün etkinliğinin değerlendirilmesi için, iç kontrolün tüm unsurları düzenli olarak gözden geçirilmelidir.',
   'a) İç kontrol sistemi düzenli olarak izlenir ve değerlendirilir.
b) İç kontroldeki aksaklıklar tespit edilerek gerekli düzeltici faaliyetler gerçekleştirilir.
c) İç kontrol sisteminin değerlendirilmesine ilişkin raporlar hazırlanır.
d) Birim yöneticileri tarafından iç kontrol güvence beyanı verilir.', 17),

  (v_iz_id, 'KOS18', 'İç Denetim',
   'İdarelerde iç denetim faaliyeti, uluslararası standartlara uygun olarak yürütülmelidir.',
   'a) İç denetim faaliyeti, idarelerin yönetim ve kontrol yapılarını değerlendirmek ve geliştirmek amacıyla yürütülür.
b) İç denetim faaliyeti, bağımsız ve objektif bir güvence ve danışmanlık faaliyetidir.
c) İç denetçiler, mesleki özen ve titizlik göstererek çalışmalarını yürütür.
d) İç denetim sonuçları raporlanır ve takip edilir.', 18)
  ON CONFLICT (code) DO NOTHING;

END $$;
