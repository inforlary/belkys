/*
  # İç Kontrol Bileşenleri ve Standartları - Tam Seed Data

  1. Güncelleme
    - 5 İç Kontrol Bileşeninin tam bilgileri (renk ve ikon dahil)
    - 18 İç Kontrol Standardının detaylı genel şartları
    - Kamu İç Kontrol Standartları Tebliği'ne uygun içerik
  
  2. Özellikler
    - Her bileşen için özel renk kodu ve ikon
    - Her standart için madde madre açıklanmış genel şartlar
    - Doğru sıralama
*/

-- 5 Bileşeni Güncelle
INSERT INTO ic_components (code, name, description, color, icon, order_index) VALUES
('KO', 'Kontrol Ortamı', 'İç kontrolün temelini oluşturan, kurumun kontrol bilincini etkileyen standartlar. Yönetimin iç kontrole olan yaklaşımını ve personelin kontrol bilincini şekillendirir.', '#3B82F6', 'Users', 1),
('RD', 'Risk Değerlendirme', 'Kurumun hedeflerine ulaşmasını engelleyebilecek risklerin belirlenmesi ve analiz edilmesi. Stratejik planlama ve risk yönetimi ile doğrudan bağlantılıdır.', '#F59E0B', 'AlertTriangle', 2),
('KF', 'Kontrol Faaliyetleri', 'Risklerin kabul edilebilir düzeyde tutulması için belirlenen her türlü önlem, politika ve prosedürler. Risklere karşı alınan tedbirleri kapsar.', '#22C55E', 'Shield', 3),
('BI', 'Bilgi ve İletişim', 'Kurumun faaliyetlerini yürütmesi için gerekli bilginin üretilmesi, kullanılması ve paylaşılması. İç ve dış iletişim kanallarını içerir.', '#8B5CF6', 'MessageSquare', 4),
('IZ', 'İzleme', 'İç kontrol sisteminin tasarım ve işleyişinin sürekli ve belirli aralıklarla değerlendirilmesi. Sistemin etkinliğini ölçer ve iyileştirme sağlar.', '#EF4444', 'Eye', 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  order_index = EXCLUDED.order_index;

-- 18 Standardı Detaylı Genel Şartlarla Güncelle
INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES

-- BİLEŞEN 1: KONTROL ORTAMI (KOS1-KOS4)
((SELECT id FROM ic_components WHERE code = 'KO'), 'KOS1', 'Etik Değerler ve Dürüstlük',
'Personel davranışlarını belirleyen kuralların personel tarafından bilinmesi sağlanmalıdır. Etik davranış ilkeleri kurum kültürünün temel unsuru olmalıdır.',
'1.1. İdareler, personelinin davranışlarına yön veren kuralları belirlemeli, yazılı hale getirmeli ve duyurmalıdır.
1.2. Etik kurallar iç düzenlemelerde yer almalı ve tüm personele duyurulmalıdır.
1.3. İdarenin etik değerlere bağlılığı, en üst düzey yöneticiden başlayarak tüm çalışanların davranışlarıyla gösterilmelidir.
1.4. Etik konusunda eğitim programları düzenlenmeli ve personelin katılımı sağlanmalıdır.
1.5. Etik dışı davranışları bildirmek için uygun yöntemler oluşturulmalıdır.
1.6. Etik komisyonu veya benzeri birimler oluşturularak etik konusunun kurumsallaşması sağlanmalıdır.',
1),

((SELECT id FROM ic_components WHERE code = 'KO'), 'KOS2', 'Misyon, Organizasyon Yapısı ve Görevler',
'Kurumun misyonu ile birim ve personelin görev tanımları yazılı olarak belirlenmeli ve duyurulmalıdır. Organizasyon yapısı kurumun amaçlarına ulaşmasını desteklemelidir.',
'2.1. Kurumun misyonu yazılı olarak belirlenmeli, kamuoyuna ve tüm çalışanlara duyurulmalıdır.
2.2. Misyonun gerçekleştirilmesine yönelik kurumsal amaç ve hedefler oluşturulmalıdır.
2.3. Kurumun organizasyon yapısı, temel yetki ve sorumluluk dağılımını gösterecek şekilde belirlenmeli ve duyurulmalıdır.
2.4. Tüm personelin görev, yetki ve sorumlulukları açık ve anlaşılır bir şekilde yazılı olarak belirlenmeli ve personele bildirilmelidir.
2.5. İş akış süreçleri tanımlanmalı ve dökümante edilmelidir.
2.6. Hassas görevler belirlenmeli ve bu görevlere ilişkin prosedürler oluşturulmalıdır.',
2),

((SELECT id FROM ic_components WHERE code = 'KO'), 'KOS3', 'Personelin Yeterliliği ve Performansı',
'Kurumun amaçlarının gerçekleştirilmesi için gerekli bilgi ve beceriye sahip personel istihdam edilmeli ve performansları değerlendirilmelidir.',
'3.1. Her görev için eğitim, bilgi, deneyim gibi yeterlilik gerekleri belirlenmelidir.
3.2. Personel istihdamı ve görevlendirmelerinde belirlenen yeterlilik gerekleri esas alınmalıdır.
3.3. Personelin mesleki yeterliliğini geliştirmek için eğitim ihtiyaç analizi yapılmalı ve eğitim planı hazırlanmalıdır.
3.4. Eğitim faaliyetleri planlandığı şekilde uygulanmalı ve değerlendirilmelidir.
3.5. Personelin performansı belirlenmiş ölçütlere göre değerlendirilmelidir.
3.6. Performans değerlendirme sonuçları personele geri bildirilmeli ve gelişim için kullanılmalıdır.',
3),

((SELECT id FROM ic_components WHERE code = 'KO'), 'KOS4', 'Yetki Devri',
'Yetki ve sorumlulukların açık ve belirgin bir şekilde devredilmesi gerekmektedir. Yetki devri yazılı olarak yapılmalı ve sınırları belirlenmelidir.',
'4.1. İş akışının kesintisiz sürdürülebilmesi için yetki devirlerine ilişkin düzenlemeler yapılmalıdır.
4.2. Yetki devirlerinde sınırlar açıkça belirlenmeli ve yazılı hale getirilmelidir.
4.3. Devredilen yetkinin önemi ve riski dikkate alınarak kontrol prosedürleri oluşturulmalıdır.
4.4. Yetki devredilen personelin yeterliliği ve uygunluğu değerlendirilmelidir.
4.5. Yetki devirleri belirli dönemlerde gözden geçirilmeli ve güncellenmelidir.',
4),

-- BİLEŞEN 2: RİSK DEĞERLENDİRME (KOS5-KOS6)
((SELECT id FROM ic_components WHERE code = 'RD'), 'KOS5', 'Planlama ve Programlama',
'Kurumlar faaliyetlerini amaç, hedef ve göstergelerini içeren plan ve programlara dayandırmalıdır. Stratejik planlama süreçleri etkin bir şekilde yürütülmelidir.',
'5.1. Kurum stratejik planı, mevzuata uygun olarak hazırlanmalı ve güncel tutulmalıdır.
5.2. Stratejik planda kurumun misyon, vizyon, amaç, hedef ve stratejileri yer almalıdır.
5.3. Stratejik plan hedefleri ölçülebilir performans göstergeleri ile desteklenmelidir.
5.4. Stratejik plan performans programı ve bütçe ile ilişkilendirilmelidir.
5.5. Birim ve bireysel hedefler kurumsal hedeflerle uyumlu olmalıdır.
5.6. Planlama çalışmalarında iç ve dış çevre analizi yapılmalı, riskler değerlendirilmelidir.',
5),

((SELECT id FROM ic_components WHERE code = 'RD'), 'KOS6', 'Risklerin Belirlenmesi ve Değerlendirilmesi',
'Risklerin gerçekleşme olasılığı ve muhtemel etkileri analiz edilmeli, risklere verilecek cevaplar belirlenmeli ve risk yönetimi sürekli bir faaliyet olarak yürütülmelidir.',
'6.1. Kurumsal risk yönetimi anlayışı oluşturulmalı ve risk yönetimi politikası belirlenmelidir.
6.2. Kurumun karşı karşıya olduğu iç ve dış riskler belirlenmeli ve kayıt altına alınmalıdır.
6.3. Risklerin gerçekleşme olasılıkları ve etkileri analiz edilmelidir.
6.4. Risk analizi sonucunda risklere verilecek cevaplar (kabul, azaltma, paylaşma, kaçınma) belirlenmelidir.
6.5. Risk kayıt sistemi oluşturulmalı ve güncel tutulmalıdır.
6.6. Risk yönetimi faaliyetleri düzenli olarak izlenmeli ve gözden geçirilmelidir.',
6),

-- BİLEŞEN 3: KONTROL FAALİYETLERİ (KOS7-KOS12)
((SELECT id FROM ic_components WHERE code = 'KF'), 'KOS7', 'Kontrol Stratejileri ve Yöntemleri',
'Her faaliyet ve riskleri için uygun kontrol strateji ve yöntemleri belirlenmeli ve uygulanmalıdır.',
'7.1. Kontrol faaliyetleri, risk değerlendirme sonuçları dikkate alınarak belirlenmelidir.
7.2. Kontrol faaliyetleri risk düzeyiyle orantılı olmalıdır.
7.3. Önleyici, tespit edici ve düzeltici kontroller dengeli bir şekilde uygulanmalıdır.
7.4. Kontrol faaliyetleri kurumun tüm birimlerinde ve süreçlerinde uygulanmalıdır.
7.5. Kontrol maliyetleri ile beklenen faydalar arasında denge gözetilmelidir.',
7),

((SELECT id FROM ic_components WHERE code = 'KF'), 'KOS8', 'Prosedürlerin Belirlenmesi ve Belgelendirilmesi',
'Faaliyetler ve bunlara ilişkin kontroller, yazılı prosedürler şeklinde belgelenmeli ve ilgililerin erişimine açık tutulmalıdır.',
'8.1. Her faaliyet için kontrol noktalarını içeren prosedürler hazırlanmalıdır.
8.2. Prosedürler açık, anlaşılır ve uygulanabilir olmalıdır.
8.3. Prosedürler ilgili personelin erişimine açık tutulmalıdır.
8.4. Prosedürler düzenli olarak gözden geçirilmeli ve güncellenmelidir.
8.5. Prosedürlerin uygulanması izlenmeli ve sapmalara müdahale edilmelidir.',
8),

((SELECT id FROM ic_components WHERE code = 'KF'), 'KOS9', 'Görevler Ayrılığı',
'Hata, eksiklik, yanlışlık, usulsüzlük ve yolsuzluk risklerini azaltmak için faaliyetler yetkili birden fazla kişi arasında paylaştırılmalıdır.',
'9.1. Her faaliyet veya mali işlemin onaylanması, uygulanması, kaydedilmesi ve kontrolü farklı kişilere verilmelidir.
9.2. Bir personele birbirini kontrol eden işler verilmemelidir.
9.3. Görevler ayrılığı ilkesinin uygulanamadığı durumlarda telafi edici kontroller oluşturulmalıdır.
9.4. Personele göreviyle bağdaşmayan işler verilmemelidir.
9.5. Hassas görevlerde görev ayrılığına özellikle dikkat edilmelidir.',
9),

((SELECT id FROM ic_components WHERE code = 'KF'), 'KOS10', 'Hiyerarşik Kontroller',
'Yöneticiler, prosedürlerin etkili ve sürekli şekilde uygulanmasını sağlamalı, personelin faaliyetlerini izlemeli ve kontrol etmelidir.',
'10.1. Yöneticiler personelin faaliyetlerini düzenli olarak izlemelidir.
10.2. Hata, eksiklik ve usulsüzlükler tespit edilmeli ve düzeltici işlemler başlatılmalıdır.
10.3. Yöneticiler işlemleri onaylamadan önce gerekli kontrolleri yapmalıdır.
10.4. Hiyerarşik kontroller belgelenmeli ve kayıt altına alınmalıdır.
10.5. Kontrol sonuçları değerlendirilmeli ve gerekli önlemler alınmalıdır.',
10),

((SELECT id FROM ic_components WHERE code = 'KF'), 'KOS11', 'Faaliyetlerin Sürekliliği',
'Personelin yetersizliği, yokluğu, ayrılması veya görev değişikliği halinde faaliyetlerin kesintisiz sürdürülebilmesi için gerekli önlemler alınmalıdır.',
'11.1. Kritik görevler için vekil personel belirlenmelidir.
11.2. Personel değişikliklerinde iş devamlılığı sağlanmalıdır.
11.3. Bilgi sistemlerinin sürekliliği için yedekleme ve kurtarma prosedürleri oluşturulmalıdır.
11.4. Olağanüstü durum ve afetler için iş sürekliliği planları hazırlanmalıdır.
11.5. İş sürekliliği planları düzenli olarak test edilmeli ve güncellenmelidir.',
11),

((SELECT id FROM ic_components WHERE code = 'KF'), 'KOS12', 'Bilgi Sistemleri Kontrolleri',
'Bilgi sistemlerinin sürekliliği ve güvenilirliği için gerekli kontroller yapılmalı, bilgi güvenliği sağlanmalıdır.',
'12.1. Bilgi sistemlerine erişim yetkilendirilmiş kullanıcılarla sınırlandırılmalıdır.
12.2. Kullanıcı erişim hakları düzenli olarak gözden geçirilmelidir.
12.3. Bilgi güvenliği politikası oluşturulmalı ve uygulanmalıdır.
12.4. Yazılım geliştirme, değişiklik ve bakım kontrol altına alınmalıdır.
12.5. Yedekleme prosedürleri oluşturulmalı ve düzenli yedekleme yapılmalıdır.
12.6. Siber güvenlik önlemleri alınmalı ve güncel tutulmalıdır.',
12),

-- BİLEŞEN 4: BİLGİ VE İLETİŞİM (KOS13-KOS16)
((SELECT id FROM ic_components WHERE code = 'BI'), 'KOS13', 'Bilgi ve İletişim',
'Kurumlar yatay ve dikey iç iletişim ile dış iletişimi etkili bir şekilde sağlamalıdır.',
'13.1. Kurum içi ve kurum dışı iletişim için uygun yöntemler belirlenmelidir.
13.2. Yöneticiler ile personel arasında etkili ve sürekli bir iletişim sağlanmalıdır.
13.3. Bilgi akışını sağlamak için uygun bir raporlama sistemi kurulmalıdır.
13.4. Yöneticiler ve personel, ihtiyaç duydukları bilgiye zamanında erişebilmelidir.
13.5. Kurum dışı paydaşlarla etkin iletişim sağlanmalıdır.',
13),

((SELECT id FROM ic_components WHERE code = 'BI'), 'KOS14', 'Raporlama',
'Kurum içi ve dışı düzenli, zamanında ve güvenilir raporlama sağlanmalıdır.',
'14.1. Kurum faaliyetleri ve sonuçları hakkında düzenli raporlar hazırlanmalıdır.
14.2. Faaliyet sonuçları ve performans bilgileri üst yöneticiye raporlanmalıdır.
14.3. İç kontrol sistemi ve işleyişi hakkında yılda en az bir kez üst yöneticiye rapor sunulmalıdır.
14.4. Raporlar doğru, güvenilir ve zamanında hazırlanmalıdır.
14.5. Raporlama standartları ve formatları belirlenmelidir.',
14),

((SELECT id FROM ic_components WHERE code = 'BI'), 'KOS15', 'Kayıt ve Dosyalama Sistemi',
'Kurum kayıt ve dosyalama sistemi, mevzuata uygun olarak oluşturulmalı, belgelerin kolay erişilebilir ve güvenilir olması sağlanmalıdır.',
'15.1. Kayıt ve dosyalama sistemi, kurumun ihtiyaçlarını karşılayacak şekilde tasarlanmalıdır.
15.2. Belgelerin kayıt, sınıflandırma, saklama ve imha işlemleri için prosedürler oluşturulmalıdır.
15.3. Belgelerin saklama süreleri belirlenmelidir.
15.4. Gizlilik gerektiren bilgi ve belgeler için özel güvenlik önlemleri alınmalıdır.
15.5. Elektronik belge yönetim sistemi kullanılmalı ve güvenliği sağlanmalıdır.',
15),

((SELECT id FROM ic_components WHERE code = 'BI'), 'KOS16', 'Hata, Usulsüzlük ve Yolsuzlukların Bildirilmesi',
'Hata, usulsüzlük ve yolsuzlukların bildirimi için uygun yöntemler belirlenmeli ve bildirimde bulunanlar korunmalıdır.',
'16.1. Hata, usulsüzlük ve yolsuzlukları bildirmek için uygun yöntemler oluşturulmalıdır.
16.2. Personel, hata ve usulsüzlükleri bildirme konusunda teşvik edilmelidir.
16.3. Bildirimde bulunanların kimliği gizli tutulmalı ve korunmalıdır.
16.4. Bildirimlerin değerlendirilmesi için uygun bir süreç oluşturulmalıdır.
16.5. Bildirimlerin sonuçları takip edilmeli ve gerekli önlemler alınmalıdır.',
16),

-- BİLEŞEN 5: İZLEME (KOS17-KOS18)
((SELECT id FROM ic_components WHERE code = 'IZ'), 'KOS17', 'İç Kontrolün Değerlendirilmesi',
'İç kontrol sistemi yılda en az bir kez değerlendirilmeli, eksiklikler belirlenmeli ve iyileştirme önlemleri alınmalıdır.',
'17.1. İç kontrol sisteminin yeterliliği ve etkinliği düzenli aralıklarla değerlendirilmelidir.
17.2. Değerlendirme, tüm iç kontrol standartlarını kapsamalıdır.
17.3. Değerlendirme sonuçları üst yöneticiye raporlanmalıdır.
17.4. Tespit edilen eksiklikler için iyileştirme eylem planı hazırlanmalıdır.
17.5. Eylem planının uygulanması izlenmeli ve sonuçları değerlendirilmelidir.
17.6. İç Kontrol İzleme ve Yönlendirme Kurulu oluşturulmalı ve düzenli toplanmalıdır.',
17),

((SELECT id FROM ic_components WHERE code = 'IZ'), 'KOS18', 'İç Denetim',
'İç denetim faaliyeti idarenin yönetim ve kontrol yapılarının değerlendirilmesi, geliştirilmesi ve kurumsal hedeflerin gerçekleştirilmesine yönelik güvence ve danışmanlık hizmeti sunulması amacıyla yürütülmelidir.',
'18.1. İç denetim birimi kurulmalı veya iç denetim hizmeti temin edilmelidir.
18.2. İç denetim faaliyetleri risk değerlendirmesine dayalı olarak planlanmalıdır.
18.3. İç denetim sonuçları üst yöneticiye raporlanmalıdır.
18.4. İç denetim önerileri değerlendirilmeli ve gerekli düzeltici işlemler yapılmalıdır.
18.5. İç denetim önerilerinin uygulanması izlenmelidir.
18.6. İç denetim birimi, mesleki standartlara uygun şekilde faaliyetlerini yürütmelidir.',
18)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  general_conditions = EXCLUDED.general_conditions,
  order_index = EXCLUDED.order_index;