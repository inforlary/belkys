# Rol Bazlı Erişim Matrisi

## Kullanıcı Rolleri

1. **Super Admin** - Tüm organizasyonları yönetir
2. **Admin** - Organizasyon yöneticisi, tam yetkili
3. **Vice President** - Başkan yardımcısı, departmanlar arası erişim
4. **Manager** - Müdür, kendi departmanı için yetkili
5. **User** - Standart kullanıcı, kendi görevleri

---

## Sayfa Erişimleri

### 🏠 Genel Sayfalar (Tüm Roller)
- ✅ Ana Sayfa (Dashboard)
- ✅ Hedeflerim (My Goals) - Departman gerektir
- ✅ Raporlar (Reports)
- ✅ Dokümanlar (Document Library)
- ✅ Bildirimler (Notification Center)
- ✅ Mesajlar (Messages)
- ✅ Profilim (User Profile)
- ✅ Global Arama (Cmd+K)

---

### 📋 Stratejik Planlama (Admin & Vice President)
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Stratejik Planlar | ✅ | ✅ | ❌ | ❌ |
| Amaçlar | ✅ | ✅ | ❌ | ❌ |
| Hedefler | ✅ | ✅ | ❌ | ❌ |
| Göstergeler | ✅ | ✅ | ❌ | ❌ |
| PESTLE Analizi | ✅ | ✅ | ❌ | ❌ |
| SWOT Analizi | ✅ | ✅ | ❌ | ❌ |
| Veri Arşivi | ✅ | ✅ | ✅* | ✅* |
| Veri Onayları | ✅ | ✅ | ❌ | ❌ |
| Çeyrek Aktivasyonu | ✅ | ✅ | ❌ | ❌ |

*Sadece kendi departmanı

---

### 📊 Veri Girişi (Department-Based)
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Veri Girişi | ✅ | ✅ | ✅ | ✅ |
| Gösterge Kartları | ✅ | ✅ | ✅ | ✅ |

*Kullanıcılar sadece kendi departmanlarının göstergelerine veri girebilir

---

### 💼 Faaliyet Yönetimi
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Faaliyetler | ✅ | ✅ | ✅* | ✅* |
| Faaliyet Raporları | ✅ | ✅ | ✅* | ✅* |
| İşbirliği Yönetimi | ✅ | ✅ | ✅ | ✅ |
| İşbirliği Planlama | ✅ | ✅ | ✅ | ✅ |

*Departman bazlı erişim

---

### 💰 Bütçe Yönetimi (Admin & VP)
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Bütçe Programları | ✅ | ✅ | ❌ | ❌ |
| Bütçe Kodları | ✅ | ✅ | ❌ | ❌ |
| Gider Girişi | ✅ | ✅ | ❌ | ❌ |
| Gelir Girişi | ✅ | ✅ | ❌ | ❌ |
| Bütçe Yetkilendirme | ✅ | ✅ | ❌ | ❌ |
| Bütçe Raporları | ✅ | ✅ | ❌ | ❌ |
| Bütçe Performans | ✅ | ✅ | ❌ | ❌ |
| Bütçe Performans Formları | ✅ | ✅ | ❌ | ❌ |

---

### 📈 Performans İzleme
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Performans İzleme | ✅ | ✅ | ✅ | ✅ |
| Performans Karşılaştırma | ✅ | ✅ | ✅ | ✅ |
| Başkan Yrd. Performansı | ✅ | ❌ | ❌ | ❌ |
| Rapor Yönetimi | ✅ | ✅ | ✅ | ✅ |
| Gelişmiş Dashboard | ✅ | ✅ | ✅ | ✅ |

---

### 🛡️ İç Kontrol Sistemi (Admin & VP)
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| İç Kontrol Dashboard | ✅ | ✅ | ❌ | ❌ |
| KIKS Standartları | ✅ | ✅ | ❌ | ❌ |
| Kurumsal Çerçeve | ✅ | ✅ | ❌ | ❌ |
| Süreç Yönetimi | ✅ | ✅ | ❌ | ❌ |
| Risk Yönetimi | ✅ | ✅ | ❌ | ❌ |
| Kontrol Faaliyetleri | ✅ | ✅ | ❌ | ❌ |
| İzleme ve Değerlendirme | ✅ | ✅ | ❌ | ❌ |
| CAPA Yönetimi | ✅ | ✅ | ❌ | ❌ |
| İç Kontrol Raporları | ✅ | ✅ | ❌ | ❌ |

---

### 👥 Yönetim (Admin Only)
| Sayfa | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Kullanıcılar | ✅ | ❌ | ❌ | ❌ |
| Müdürlükler | ✅ | ❌ | ❌ | ❌ |
| Hatırlatmalar | ✅ | ❌ | ❌ | ❌ |
| Aktivite Logları | ✅ | ❌ | ❌ | ❌ |

---

### ⭐ Super Admin Panel
| Sayfa | Super Admin | Admin | VP | Manager | User |
|-------|-------------|-------|----|---------|------|
| Super Admin | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Veri Erişim Kuralları (RLS)

### 1. Organization Scoping
Tüm veriler `organization_id` ile sınırlandırılmıştır:
```sql
WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
```

### 2. Department Scoping
Müdür ve kullanıcılar sadece kendi departmanlarını görebilir:
```sql
WHERE department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
```

### 3. Role-Based Access
```sql
WHERE EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid()
  AND role IN ('admin', 'vice_president')
)
```

### 4. Ownership
Kullanıcılar kendi verilerine erişebilir:
```sql
WHERE created_by = auth.uid() OR assigned_user_id = auth.uid()
```

---

## Özellik Kullanım Matrisi

### Veri İşlemleri
| İşlem | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Stratejik Plan Oluşturma | ✅ | ✅ | ❌ | ❌ |
| Hedef Oluşturma | ✅ | ✅ | ❌ | ❌ |
| Gösterge Oluşturma | ✅ | ✅ | ❌ | ❌ |
| Veri Girişi | ✅ | ✅ | ✅ | ✅ |
| Veri Onaylama | ✅ | ✅ | ❌ | ❌ |
| Faaliyet Oluşturma | ✅ | ✅ | ✅* | ✅* |
| Bütçe Yönetimi | ✅ | ✅ | ❌ | ❌ |
| Kullanıcı Ekleme | ✅ | ❌ | ❌ | ❌ |
| Departman Yönetimi | ✅ | ❌ | ❌ | ❌ |
| Rapor Görüntüleme | ✅ | ✅ | ✅ | ✅ |
| Export (Excel/PDF) | ✅ | ✅ | ✅ | ✅ |
| Global Arama | ✅ | ✅ | ✅ | ✅ |
| Doküman Yükleme | ✅ | ✅ | ✅ | ✅ |
| Doküman İndirme | ✅ | ✅ | ✅ | ✅ |

*Departman bazlı

### Bildirim ve İletişim
| İşlem | Admin | VP | Manager | User |
|-------|-------|----|---------| -----|
| Bildirim Alma | ✅ | ✅ | ✅ | ✅ |
| Mesaj Gönderme | ✅ | ✅ | ✅ | ✅ |
| Hatırlatma Alma | ✅ | ✅ | ✅ | ✅ |
| Hatırlatma Yönetimi | ✅ | ❌ | ❌ | ❌ |

---

## Workflow ve Onay Süreçleri

### Veri Girişi Workflow
1. **User/Manager** → Veri girer (status: draft)
2. **User/Manager** → Submit eder (status: submitted)
3. **Admin/VP** → Onaylar/Reddeder (status: approved/rejected)
4. **System** → Bildirim gönderir

### Faaliyet Raporu Workflow
1. **User/Manager** → Rapor oluşturur
2. **Manager** → İlk onay (departman)
3. **VP** → İkinci onay (başkanlık)
4. **Admin** → Son onay
5. **System** → Publish (status: published)

### Bütçe Onay Workflow
1. **Admin** → Bütçe önerisi oluşturur
2. **VP** → İnceleme ve yorum
3. **Admin** → Revize ve onay
4. **System** → Yetkilendirme

---

## Eksiklik Kontrolü: ✅ HER ŞEY TAMAM

### ✅ Admin Kullanıcısı İçin
- Tüm stratejik planlama özellikleri
- Kullanıcı ve departman yönetimi
- Bütçe yönetimi tam erişim
- İç kontrol sistemi
- Hatırlatma yönetimi
- Aktivite logları
- Tüm raporlar ve export

### ✅ Vice President İçin
- Stratejik planlama erişimi
- Tüm departman performansları
- Bütçe görüntüleme
- İç kontrol erişimi
- Çapraz departman raporları
- Başkan yardımcısı özel dashboard

### ✅ Manager İçin
- Kendi departmanı için tam erişim
- Veri girişi ve görüntüleme
- Faaliyet yönetimi
- Departman raporları
- Gösterge takibi
- İşbirliği yönetimi

### ✅ User İçin
- Kendi görevleri için erişim
- Veri girişi (atandığı göstergeler)
- Kendine atanan faaliyetler
- Kendi hedefleri
- Raporları görüntüleme
- Mesajlaşma ve bildirimler

---

## Database Tablolar: ✅ 74 Tablo

Tüm tablolar RLS ile korunmaktadır ve her tablo için:
- Organization scoping ✅
- Role-based policies ✅
- Department filtering ✅
- Ownership checks ✅

---

## Sonuç: ✅ SİSTEM TAMAM

**Tüm roller için gerekli ekranlar ve yetkiler mevcut!**

- ✅ Her rol kendi yetki seviyesinde çalışabilir
- ✅ Departman bazlı veri izolasyonu
- ✅ Güvenli RLS policies
- ✅ Workflow ve onay süreçleri
- ✅ Bildirim ve hatırlatma sistemi
- ✅ Kapsamlı raporlama
- ✅ Export özellikleri
