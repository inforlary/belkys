import { useState, useEffect } from 'react';
import { Building2, X, Save, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface EditOrganizationModalProps {
  organization: {
    id: string;
    name: string;
    subdomain: string;
    contact_email: string;
    contact_phone?: string;
    max_users: number;
    is_active: boolean;
    module_strategic_planning?: boolean;
    module_activity_reports?: boolean;
    module_budget_performance?: boolean;
    module_internal_control?: boolean;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditOrganizationModal({ organization, onClose, onSuccess }: EditOrganizationModalProps) {
  const [name, setName] = useState(organization.name);
  const [subdomain, setSubdomain] = useState(organization.subdomain);
  const [contactEmail, setContactEmail] = useState(organization.contact_email);
  const [contactPhone, setContactPhone] = useState(organization.contact_phone || '');
  const [maxUsers, setMaxUsers] = useState(organization.max_users);
  const [moduleStrategicPlanning, setModuleStrategicPlanning] = useState(organization.module_strategic_planning ?? true);
  const [moduleActivityReports, setModuleActivityReports] = useState(organization.module_activity_reports ?? true);
  const [moduleBudgetPerformance, setModuleBudgetPerformance] = useState(organization.module_budget_performance ?? true);
  const [moduleInternalControl, setModuleInternalControl] = useState(organization.module_internal_control ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name,
          subdomain,
          contact_email: contactEmail,
          contact_phone: contactPhone || null,
          max_users: maxUsers,
          module_strategic_planning: moduleStrategicPlanning,
          module_activity_reports: moduleActivityReports,
          module_budget_performance: moduleBudgetPerformance,
          module_internal_control: moduleInternalControl,
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      await supabase.from('super_admin_activity_logs').insert({
        action: 'update_organization',
        entity_type: 'organization',
        entity_id: organization.id,
        details: {
          organizationName: name,
          changes: {
            name: name !== organization.name ? { from: organization.name, to: name } : undefined,
            subdomain: subdomain !== organization.subdomain ? { from: organization.subdomain, to: subdomain } : undefined,
            contact_email: contactEmail !== organization.contact_email ? { from: organization.contact_email, to: contactEmail } : undefined,
            max_users: maxUsers !== organization.max_users ? { from: organization.max_users, to: maxUsers } : undefined,
            modules: {
              strategic_planning: moduleStrategicPlanning !== organization.module_strategic_planning,
              activity_reports: moduleActivityReports !== organization.module_activity_reports,
              budget_performance: moduleBudgetPerformance !== organization.module_budget_performance,
              internal_control: moduleInternalControl !== organization.module_internal_control,
            },
          },
        },
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error updating organization:', err);
      setError(err.message || 'Belediye güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Belediye Düzenle">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Belediye Adı *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subdomain *
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <span className="text-gray-600 text-sm">.yourdomain.com</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            İletişim Email *
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            İletişim Telefonu
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maksimum Kullanıcı Sayısı *
          </label>
          <input
            type="number"
            min="1"
            max="10000"
            value={maxUsers}
            onChange={(e) => setMaxUsers(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-5 h-5 text-blue-600" />
            <label className="block text-sm font-medium text-gray-900">
              Modül Erişim Yetkileri
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Bu belediyenin erişebileceği modülleri seçin
          </p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={moduleStrategicPlanning}
                onChange={(e) => setModuleStrategicPlanning(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Stratejik Plan</span>
                <p className="text-xs text-gray-500">Stratejik planlar, amaçlar, hedefler ve göstergeler</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={moduleActivityReports}
                onChange={(e) => setModuleActivityReports(e.target.checked)}
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
                checked={moduleBudgetPerformance}
                onChange={(e) => setModuleBudgetPerformance(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Bütçe ve Performans</span>
                <p className="text-xs text-gray-500">Bütçe yönetimi, gelir-gider ve performans takibi</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={moduleInternalControl}
                onChange={(e) => setModuleInternalControl(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">İç Kontrol</span>
                <p className="text-xs text-gray-500">İç kontrol süreçleri, risk yönetimi ve uyum</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button type="submit" disabled={loading} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {loading ? 'Güncelleniyor...' : 'Güncelle'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
