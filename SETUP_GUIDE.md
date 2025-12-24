# Belediye Kurumsal Yönetim Sistemi - Stratejik Planlama Modülü

## Kurulum Rehberi

### 1. Veritabanı Yapılandırması

Supabase veritabanı migration'ı otomatik olarak uygulanmıştır. Veritabanında aşağıdaki tablolar oluşturulmuştur:

- **organizations** - Belediye bilgileri
- **profiles** - Kullanıcı profilleri
- **strategic_plans** - Stratejik planlar
- **objectives** - Amaçlar
- **goals** - Hedefler
- **indicators** - Performans göstergeleri
- **activities** - Faaliyetler/Projeler

### 2. İlk Kullanıcı ve Belediye Oluşturma

Sistemi kullanmaya başlamak için Supabase Dashboard üzerinden aşağıdaki SQL sorgularını çalıştırın:

```sql
-- 1. Belediye oluştur
INSERT INTO organizations (name, code, city, district)
VALUES ('Örnek Belediyesi', 'BLD-001', 'İstanbul', 'Kadıköy');

-- 2. Kullanıcı kaydı (Supabase Auth ile)
-- Önce Supabase Dashboard > Authentication > Users bölümünden bir kullanıcı oluşturun
-- Ardından aşağıdaki sorgu ile profil oluşturun (user_id'yi kendi kullanıcı ID'niz ile değiştirin)

INSERT INTO profiles (id, organization_id, email, full_name, role)
VALUES (
  'KULLANICI_ID_BURAYA', -- Supabase'den aldığınız user ID
  (SELECT id FROM organizations WHERE code = 'BLD-001'),
  'admin@belediye.gov.tr',
  'Admin Kullanıcı',
  'admin'
);
```

### 3. Örnek Veri Oluşturma (Opsiyonel)

Sistemi test etmek için örnek veri oluşturmak isterseniz:

```sql
-- Organization ID'nizi alın
DO $$
DECLARE
  org_id uuid;
  user_id uuid;
  plan_id uuid;
  obj_id uuid;
  goal_id uuid;
BEGIN
  -- Mevcut organization ve user ID'lerini alın
  SELECT id INTO org_id FROM organizations LIMIT 1;
  SELECT id INTO user_id FROM profiles LIMIT 1;

  -- Stratejik Plan
  INSERT INTO strategic_plans (organization_id, name, start_year, end_year, description, status, created_by)
  VALUES (org_id, '2025-2029 Stratejik Planı', 2025, 2029, 'Belediyemizin 5 yıllık stratejik hedefleri', 'active', user_id)
  RETURNING id INTO plan_id;

  -- Amaç
  INSERT INTO objectives (strategic_plan_id, organization_id, code, title, description, order_number)
  VALUES (plan_id, org_id, 'A1', 'Çevre ve Yeşil Alanların Geliştirilmesi', 'Sürdürülebilir çevre politikaları ile yeşil alanları artırmak', 1)
  RETURNING id INTO obj_id;

  -- Hedef
  INSERT INTO goals (objective_id, organization_id, code, title, description, order_number)
  VALUES (obj_id, org_id, 'H1.1', 'Park ve Bahçe Sayısını Artırmak', 'İlçe genelinde yeni park ve rekreasyon alanları oluşturmak', 1)
  RETURNING id INTO goal_id;

  -- Gösterge
  INSERT INTO indicators (goal_id, organization_id, name, unit, baseline_value, target_value, target_year, current_value)
  VALUES (goal_id, org_id, 'Toplam Park Sayısı', 'adet', 15, 30, 2029, 18);

  -- Faaliyet
  INSERT INTO activities (
    goal_id, organization_id, code, title, description,
    start_date, end_date, responsible_department, status, budget, progress_percentage
  )
  VALUES (
    goal_id, org_id, 'F1.1.1', 'Mahalle Parkları Projesi',
    '5 mahalleye yeni park alanları kazandırılması',
    '2025-01-01', '2026-12-31', 'Park ve Bahçeler Müdürlüğü', 'ongoing', 5000000, 35
  );
END $$;
```

### 4. Giriş Yapma

1. Tarayıcınızda uygulamayı açın
2. Supabase'de oluşturduğunuz kullanıcının e-posta ve şifresini kullanarak giriş yapın
3. Dashboard'a yönlendirileceksiniz

## Sistem Özellikleri

### Stratejik Planlama Hiyerarşisi

```
Stratejik Plan (2025-2029)
    └── Amaç (A1, A2, ...)
        └── Hedef (H1.1, H1.2, ...)
            ├── Performans Göstergesi
            └── Faaliyet/Proje
```

### Güvenlik (Row Level Security)

Tüm veriler organization_id ile izole edilmiştir. Kullanıcılar yalnızca kendi belediyelerine ait verileri görebilir ve düzenleyebilir.

### Menü Yapısı

- **Ana Sayfa** - İstatistikler ve özet bilgiler
- **Stratejik Planlar** - 5 yıllık plan dönemlerini yönetme
- **Amaçlar** - Stratejik amaçları tanımlama
- **Hedefler** - Amaçlara bağlı hedefleri belirleme
- **Göstergeler** - Hedeflerin ölçülebilir performans göstergeleri
- **Faaliyetler** - Hedeflere ulaşmak için gerçekleştirilecek faaliyetler ve projeler

## Teknik Detaylar

### Teknoloji Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Authentication
- **Icons**: Lucide React

### Proje Yapısı

```
src/
├── components/
│   ├── ui/           # Yeniden kullanılabilir UI componentleri
│   └── Layout.tsx    # Ana layout
├── contexts/
│   └── AuthContext.tsx  # Kimlik doğrulama context
├── hooks/
│   └── useLocation.ts   # Basit routing hook
├── lib/
│   └── supabase.ts      # Supabase client
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx
    ├── StrategicPlans.tsx
    ├── Objectives.tsx
    ├── Goals.tsx
    ├── Indicators.tsx
    └── Activities.tsx
```

### Gelecek Geliştirmeler İçin Öneriler

1. **PDF Export** - Stratejik planları PDF formatında dışa aktarma
2. **Excel Import/Export** - Toplu veri girişi ve raporlama
3. **Grafik ve Analiz** - Gelişmiş istatistik ve görselleştirmeler
4. **Bildirimler** - Faaliyet tarihleri için hatırlatıcılar
5. **Yorum Sistemi** - Faaliyetler için iç not ve yorum ekleme
6. **Dosya Yükleme** - Faaliyetlere doküman ekleme
7. **Onay Akışı** - Plan ve faaliyetler için onay süreçleri
8. **Çoklu Rol Yönetimi** - Admin, yönetici, kullanıcı rolleri

## Destek

Sorularınız için: destek@example.com
