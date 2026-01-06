/*
  # İç Kontrol Bileşen ve Standart Verileri

  1. İçerik
    - 5 İç Kontrol Bileşeni (KO, RD, KF, BI, IZ)
    - 18 İç Kontrol Standardı (KOS1-KOS18)
    - Her standart için genel şartlar ve açıklamalar
  
  2. Güvenlik
    - ON CONFLICT DO NOTHING ile tekrar eklemeyi önler
*/

-- 5 Bileşen
INSERT INTO ic_components (code, name, description, order_index) VALUES
('KO', 'Kontrol Ortamı', 'İç kontrolün temelini oluşturan, kurumun kontrol bilincini etkileyen standartlar', 1),
('RD', 'Risk Değerlendirme', 'Kurumun hedeflerine ulaşmasını engelleyebilecek risklerin belirlenmesi ve analizi', 2),
('KF', 'Kontrol Faaliyetleri', 'Risklerin kabul edilebilir düzeyde tutulması için alınan önlemler', 3),
('BI', 'Bilgi ve İletişim', 'Kurumun faaliyetlerini yürütmesi için gerekli bilginin üretilmesi ve paylaşılması', 4),
('IZ', 'İzleme', 'İç kontrol sisteminin kalitesinin değerlendirilmesi', 5)
ON CONFLICT (code) DO NOTHING;

-- 18 Standart (Genel Şartlarla birlikte)
INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
((SELECT id FROM ic_components WHERE code='KO'), 'KOS1', 'Etik Değerler ve Dürüstlük', 
'Personel davranışlarını belirleyen kuralların personel tarafından bilinmesi sağlanmalıdır.',
'• Etik kurallar belirlenmeli ve duyurulmalıdır.
• Etik kurallarla ilgili eğitimler düzenlenmelidir.
• Etik davranış ilkeleri iç düzenlemelerde yer almalıdır.
• Etik komisyonu oluşturulmalıdır.
• Etik ihlallerin raporlanma mekanizması kurulmalıdır.', 1),

((SELECT id FROM ic_components WHERE code='KO'), 'KOS2', 'Misyon, Organizasyon Yapısı ve Görevler',
'Kurumun misyonu ile birim ve personelin görev tanımları açık şekilde yazılmalı ve duyurulmalıdır.',
'• Kurum misyonu yazılı olarak belirlenmeli ve duyurulmalıdır.
• Organizasyon yapısı, görev, yetki ve sorumluluklar açıkça tanımlanmalıdır.
• Personel görev tanımları yazılı olarak belirlenmeli ve personele tebliğ edilmelidir.
• İş akış süreçleri tanımlanmalıdır.
• Hassas görevler belirlenmeli ve bu görevlere ilişkin prosedürler oluşturulmalıdır.', 2),

((SELECT id FROM ic_components WHERE code='KO'), 'KOS3', 'Personelin Yeterliliği ve Performansı',
'Kurumun amaçlarının gerçekleştirilmesi için gerekli bilgi ve beceriye sahip personel istihdam edilmelidir.',
'• Her görev için gerekli eğitim ve deneyim gibi nitelikler belirlenmelidir.
• Personel seçimi belirlenen niteliklere uygun yapılmalıdır.
• Personelin mesleki yeterliliğini geliştirmek için eğitim planı hazırlanmalı ve uygulanmalıdır.
• Personel performansı değerlendirilmeli ve geliştirilmelidir.
• Performans değerlendirme sonuçları personele bildirilmelidir.', 3),

((SELECT id FROM ic_components WHERE code='KO'), 'KOS4', 'Yetki Devri',
'Yetki ve sorumluluklar açık ve belirgin bir şekilde devredilmelidir.',
'• Yetki devrine ilişkin düzenlemeler yapılmalıdır.
• Yetki devirlerinde sınırlar açıkça belirlenmelidir.
• Devredilen yetkinin önemi ve riski dikkate alınarak kontrol prosedürleri belirlenmelidir.
• Yetki devredilen personelin bu yetkiyi kullanmaya uygunluğu gözetilmelidir.', 4),

((SELECT id FROM ic_components WHERE code='RD'), 'KOS5', 'Planlama ve Programlama',
'Kurumlar faaliyetlerini amaç, hedef ve göstergelerini içeren plan ve programlara dayandırmalıdır.',
'• Kurumun stratejik planı hazırlanmalı ve güncel tutulmalıdır.
• Stratejik plan performans programı ile bütçeye yansıtılmalıdır.
• Birim ve bireysel hedefler kurumsal hedeflerle uyumlu olmalıdır.
• Planlama çalışmalarında risk değerlendirmesi yapılmalıdır.', 5),

((SELECT id FROM ic_components WHERE code='RD'), 'KOS6', 'Risklerin Belirlenmesi ve Değerlendirilmesi',
'Risklerin gerçekleşme olasılığı ve etkisi analiz edilmeli ve risklere verilecek cevaplar belirlenmelidir.',
'• Kurumsal risk yönetimi politikası belirlenmelidir.
• Riskleri belirlemek için yöntem belirlenmeli ve uygulanmalıdır.
• Belirlenen riskler analiz edilmelidir.
• Risk analizi sonucunda risklere verilecek cevaplar belirlenmelidir.
• Risk kayıt sistemi oluşturulmalıdır.', 6),

((SELECT id FROM ic_components WHERE code='KF'), 'KOS7', 'Kontrol Stratejileri ve Yöntemleri',
'Her faaliyet ve riskleri için uygun kontrol strateji ve yöntemleri belirlenmelidir.',
'• Kontrol faaliyetleri, risk değerlendirme sonuçları dikkate alınarak belirlenmelidir.
• Kontrol faaliyetleri risk düzeyiyle orantılı olmalıdır.
• Kontrol faaliyetleri kurumun tüm birimlerinde ve süreçlerinde uygulanmalıdır.', 7),

((SELECT id FROM ic_components WHERE code='KF'), 'KOS8', 'Prosedürlerin Belirlenmesi ve Belgelendirilmesi',
'Faaliyetler ve bunlara ilişkin kontroller, yazılı prosedürler şeklinde belgelenmelidir.',
'• Faaliyetler ve kontrol noktalarını içeren prosedürler hazırlanmalıdır.
• Prosedürler ilgili personele duyurulmalı ve personelin erişimine açık tutulmalıdır.
• Prosedürler düzenli olarak güncellenmelidir.', 8),

((SELECT id FROM ic_components WHERE code='KF'), 'KOS9', 'Görevler Ayrılığı',
'Hata, eksiklik, yanlışlık, usulsüzlük ve yolsuzluk risklerini azaltmak için faaliyetler yetkili birden fazla kişi arasında paylaştırılmalıdır.',
'• Her faaliyet veya mali işlemin onaylanması, uygulanması ve kaydı farklı kişilere verilmelidir.
• Görevler ayrılığının mümkün olmadığı durumlarda telafi edici kontroller uygulanmalıdır.
• Personele, göreviyle ilgili olmayan konularda sorumluluk verilmemelidir.', 9),

((SELECT id FROM ic_components WHERE code='KF'), 'KOS10', 'Hiyerarşik Kontroller',
'Yöneticiler, prosedürlerin etkili ve sürekli şekilde uygulanmasını sağlamalıdır.',
'• Yöneticiler personelin faaliyetlerini kontrol etmelidir.
• Yöneticiler usulsüzlük ve hataları tespit etmeli ve düzeltici işlemleri başlatmalıdır.
• Hiyerarşik kontroller belgelendirilmelidir.', 10),

((SELECT id FROM ic_components WHERE code='KF'), 'KOS11', 'Faaliyetlerin Sürekliliği',
'Kurumun faaliyetlerinin sürekliliğini sağlamaya yönelik önlemler alınmalıdır.',
'• Personel yetersizliği, devamsızlık veya görevden ayrılma halinde işlerin aksamaması için önlemler alınmalıdır.
• Gerekli hallerde görevlerin yerine getirilmesi için vekil personel belirlenmelidir.
• Bilgi sistemlerinin sürekliliği sağlanmalıdır.
• Olağanüstü durumlarda faaliyetlerin sürdürülmesi için plan hazırlanmalıdır.', 11),

((SELECT id FROM ic_components WHERE code='KF'), 'KOS12', 'Bilgi Sistemleri Kontrolleri',
'Bilgi sistemlerinin sürekliliği ve güvenilirliği için gerekli kontroller uygulanmalıdır.',
'• Bilgi sistemlerine erişim kontrolleri yapılmalıdır.
• Bilgi güvenliği politikası oluşturulmalı ve uygulanmalıdır.
• Yazılım geliştirme ve değişiklikleri kontrol altına alınmalıdır.
• Yedekleme ve kurtarma prosedürleri oluşturulmalı ve uygulanmalıdır.', 12),

((SELECT id FROM ic_components WHERE code='BI'), 'KOS13', 'Bilgi ve İletişim',
'Kurumlar yatay ve dikey iç iletişim ile dış iletişimi etkili bir şekilde sağlamalıdır.',
'• Kurum içi ve kurum dışı iletişim yöntemleri belirlenmelidir.
• Yöneticiler ve personel arasında etkin iletişim sağlanmalıdır.
• Bilgilerin zamanında ve doğru biçimde raporlanması sağlanmalıdır.', 13),

((SELECT id FROM ic_components WHERE code='BI'), 'KOS14', 'Raporlama',
'Kurum içi ve dışı düzenli raporlama sağlanmalıdır.',
'• Faaliyet sonuçları ve raporları üst yöneticiye ve yetkili mercilere sunulmalıdır.
• İç kontrol sistemi ve işleyişi hakkında yılda en az bir kez üst yöneticiye rapor sunulmalıdır.
• Raporlar doğru, güvenilir ve zamanında hazırlanmalıdır.', 14),

((SELECT id FROM ic_components WHERE code='BI'), 'KOS15', 'Kayıt ve Dosyalama Sistemi',
'Kurumların kayıt ve dosyalama sistemi, belgelerin kolay erişilebilir ve güvenilir olmasını sağlamalıdır.',
'• Kayıt ve dosyalama sistemi mevzuata uygun olmalıdır.
• Belgelerin saklama süreleri belirlenmelidir.
• Gizliliği gerektiren bilgi ve belgelerin güvenliği sağlanmalıdır.
• Belgelerin elektronik ortamda güvenli şekilde saklanması için önlemler alınmalıdır.', 15),

((SELECT id FROM ic_components WHERE code='BI'), 'KOS16', 'Hata, Usulsüzlük ve Yolsuzlukların Bildirilmesi',
'Hata, usulsüzlük ve yolsuzlukların bildirim yöntemleri belirlenmeli ve duyurulmalıdır.',
'• Hata, usulsüzlük ve yolsuzlukların bildirimi için mekanizmalar oluşturulmalıdır.
• Bildirim yapanların kimliği gizli tutulmalıdır.
• Bildirimlerin değerlendirilmesi için süreç oluşturulmalıdır.', 16),

((SELECT id FROM ic_components WHERE code='IZ'), 'KOS17', 'İç Kontrolün Değerlendirilmesi',
'Kurumlar iç kontrol sistemini düzenli aralıklarla değerlendirmelidir.',
'• İç kontrol sistemi yılda en az bir kez değerlendirilmelidir.
• Değerlendirme sonuçları üst yöneticiye raporlanmalıdır.
• İç kontrol eksikliklerini gidermek için eylem planı hazırlanmalıdır.
• Eylem planının uygulanması izlenmelidir.', 17),

((SELECT id FROM ic_components WHERE code='IZ'), 'KOS18', 'İç Denetim',
'Kurumların iç denetim faaliyeti mevzuata uygun bir şekilde yürütülmelidir.',
'• İç denetim birimi kurulmalı veya dışarıdan hizmet alınmalıdır.
• İç denetim faaliyetleri risk değerlendirmesine dayanmalıdır.
• İç denetim sonuçları üst yöneticiye raporlanmalıdır.
• İç denetim önerilerinin uygulanması izlenmelidir.', 18)
ON CONFLICT (code) DO NOTHING;
