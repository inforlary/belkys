import React, { useState } from 'react';
import { Building2, Mail, Phone, Globe, User, Lock, Loader, Layers } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface CreateOrganizationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateOrganizationModal({ onClose, onSuccess }: CreateOrganizationModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    organizationName: '',
    code: '',
    city: '',
    district: '',
    subdomain: '',
    contactEmail: '',
    contactPhone: '',
    logoUrl: '',
    adminEmail: '',
    adminPassword: '',
    adminFullName: '',
    maxUsers: 50,
    moduleStrategicPlanning: true,
    moduleActivityReports: true,
    moduleBudgetPerformance: true,
    moduleInternalControl: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.organizationName || !formData.code || !formData.city || !formData.subdomain || !formData.contactEmail ||
        !formData.adminEmail || !formData.adminPassword || !formData.adminFullName) {
      alert('Lütfen tüm gerekli alanları doldurun');
      return;
    }

    if (formData.adminPassword.length < 6) {
      alert('Admin şifresi en az 6 karakter olmalıdır');
      return;
    }

    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(formData.subdomain)) {
      alert('Subdomain sadece küçük harf, rakam ve tire içerebilir');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Oturum bulunamadı');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization-with-demo`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Belediye oluşturma başarısız');
      }

      alert(`Başarılı! ${formData.organizationName} oluşturuldu.\n\nGiriş Bilgileri:\nEmail: ${formData.adminEmail}\nŞifre: ${formData.adminPassword}\nURL: ${formData.subdomain}.yourdomain.com`);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating organization:', error);
      alert(`Hata: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxUsers' ? parseInt(value) || 0 : value
    }));
  };

  const generateSubdomain = () => {
    const name = formData.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
    setFormData(prev => ({ ...prev, subdomain: name }));
  };

  const generateCode = () => {
    const code = formData.organizationName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 10);
    setFormData(prev => ({ ...prev, code: code }));
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Yeni Belediye Oluştur"
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Belediye Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Belediye Adı *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  onBlur={() => {
                    generateSubdomain();
                    generateCode();
                  }}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örnek: Ankara Büyükşehir Belediyesi"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Belediye Kodu *
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                required
                maxLength={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ABB"
              />
              <p className="mt-1 text-xs text-gray-500">
                Benzersiz belediye kodu (max 10 karakter)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İl *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ankara"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İlçe *
              </label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Çankaya"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subdomain *
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="subdomain"
                  value={formData.subdomain}
                  onChange={handleChange}
                  required
                  pattern="[a-z0-9-]+"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ankara"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formData.subdomain ? `${formData.subdomain}.yourdomain.com` : 'Küçük harf, rakam ve tire kullanın'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İletişim Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="iletisim@ornek.gov.tr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İletişim Telefon
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+90 (312) 123 45 67"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo URL
              </label>
              <input
                type="url"
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maksimum Kullanıcı Sayısı *
              </label>
              <input
                type="number"
                name="maxUsers"
                value={formData.maxUsers}
                onChange={handleChange}
                min="1"
                max="1000"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Kullanıcı Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Adı Soyadı *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="adminFullName"
                  value={formData.adminFullName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ahmet Yılmaz"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin@ornek.gov.tr"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Şifresi * (min. 6 karakter)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Modül Erişim Yetkileri</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Bu belediyenin erişebileceği modülleri seçin
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.moduleStrategicPlanning}
                onChange={(e) => setFormData(prev => ({ ...prev, moduleStrategicPlanning: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Stratejik Plan</span>
                <p className="text-xs text-gray-500">Stratejik planlar, amaçlar, hedefler</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.moduleActivityReports}
                onChange={(e) => setFormData(prev => ({ ...prev, moduleActivityReports: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Faaliyet Raporu</span>
                <p className="text-xs text-gray-500">Faaliyet raporları ve veri girişleri</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.moduleBudgetPerformance}
                onChange={(e) => setFormData(prev => ({ ...prev, moduleBudgetPerformance: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Bütçe ve Performans</span>
                <p className="text-xs text-gray-500">Bütçe yönetimi ve performans takibi</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.moduleInternalControl}
                onChange={(e) => setFormData(prev => ({ ...prev, moduleInternalControl: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">İç Kontrol</span>
                <p className="text-xs text-gray-500">İç kontrol süreçleri, risk yönetimi</p>
              </div>
            </label>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Demo Veriler Hakkında</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 1 Stratejik Plan (2024-2028)</li>
            <li>• 3 Amaç, 5 Hedef</li>
            <li>• 6 Performans Göstergesi (hedefli)</li>
            <li>• 3 Birim/Departman</li>
            <li>• Örnek veri girişleri</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button type="submit" disabled={loading} className="flex items-center gap-2">
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Building2 className="w-5 h-5" />
                Belediye Oluştur
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
