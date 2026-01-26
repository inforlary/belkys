import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Save } from 'lucide-react';

interface FormData {
  project_no: string;
  project_name: string;
  source: string;
  responsible_unit: string;
  physical_progress: number;
  financial_progress: number;
  contract_amount: number;
  total_expense: number;
  start_date: string;
  end_date: string;
  status: string;
  year: number;
  period: number;
  sector: string;
  sub_sector: string;
  location: string;
  tender_date: string;
  tender_type: string;
  contractor: string;
  description: string;
  strategic_plan_id?: string;
  objective_id?: string;
  goal_id?: string;
}

const SOURCE_OPTIONS = [
  { value: 'ilyas', label: 'İLYAS' },
  { value: 'beyanname', label: 'Beyanname' },
  { value: 'genel', label: 'Genel' }
];

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planlandı' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'delayed', label: 'Gecikmiş' }
];

const SECTOR_OPTIONS = ['DKH-SOSYAL', 'ULAŞIM', 'ALTYAPI', 'ÇEVRE', 'EĞİTİM', 'SAĞLIK'];

const TENDER_TYPES = ['Açık İhale', 'Belli İstekliler Arası', 'Pazarlık', 'Doğrudan Temin'];

export default function ProjectForm() {
  const { profile } = useAuth();
  const { navigate, getPathParam, currentPath } = useLocation();

  const isEditMode = currentPath.includes('/edit');
  const projectId = isEditMode ? currentPath.split('/').filter(p => p)[2] : null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [strategicPlans, setStrategicPlans] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  const [formData, setFormData] = useState<FormData>({
    project_no: 'AUTO',
    project_name: '',
    source: 'genel',
    responsible_unit: '',
    physical_progress: 0,
    financial_progress: 0,
    contract_amount: 0,
    total_expense: 0,
    start_date: '',
    end_date: '',
    status: 'planned',
    year: new Date().getFullYear(),
    period: 4,
    sector: '',
    sub_sector: '',
    location: '',
    tender_date: '',
    tender_type: '',
    contractor: '',
    description: '',
    strategic_plan_id: undefined,
    objective_id: undefined,
    goal_id: undefined
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadDepartments();
      loadStrategicPlans();
      if (isEditMode && projectId) {
        loadProject();
      }
    }
  }, [profile?.organization_id, projectId]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Birimler yüklenirken hata:', error);
    }
  };

  const loadStrategicPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('strategic_plans')
        .select('id, name, start_year, end_year')
        .eq('organization_id', profile?.organization_id)
        .order('start_year', { ascending: false });

      if (error) throw error;
      setStrategicPlans(data || []);
    } catch (error) {
      console.error('Stratejik planlar yüklenirken hata:', error);
    }
  };

  const loadObjectives = async (strategicPlanId: string) => {
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('id, title')
        .eq('strategic_plan_id', strategicPlanId)
        .order('title');

      if (error) throw error;
      setObjectives(data || []);
    } catch (error) {
      console.error('Amaçlar yüklenirken hata:', error);
      setObjectives([]);
    }
  };

  const loadGoals = async (objectiveId: string) => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, title')
        .eq('objective_id', objectiveId)
        .order('title');

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Hedefler yüklenirken hata:', error);
      setGoals([]);
    }
  };

  const loadProject = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('organization_id', profile?.organization_id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);

        if (data.strategic_plan_id) {
          await loadObjectives(data.strategic_plan_id);
        }
        if (data.objective_id) {
          await loadGoals(data.objective_id);
        }
      }
    } catch (error) {
      console.error('Proje yüklenirken hata:', error);
      alert('Proje bulunamadı');
      navigate('project-management/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.project_name) {
      alert('Proje Adı zorunludur');
      return;
    }

    try {
      setSaving(true);

      const projectData = {
        ...formData,
        project_no: isEditMode ? formData.project_no : 'AUTO',
        organization_id: profile?.organization_id,
        last_update_date: new Date().toISOString()
      };

      if (isEditMode && projectId) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', projectId)
          .eq('organization_id', profile?.organization_id);

        if (error) throw error;
        alert('Proje başarıyla güncellendi');
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([projectData]);

        if (error) throw error;
        alert('Proje başarıyla eklendi');
      }

      navigate('project-management/projects');
    } catch (error: any) {
      console.error('Proje kaydedilirken hata:', error);
      alert(`Hata: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'strategic_plan_id') {
      setFormData(prev => ({ ...prev, objective_id: undefined, goal_id: undefined }));
      setObjectives([]);
      setGoals([]);
      if (value) {
        loadObjectives(value);
      }
    } else if (field === 'objective_id') {
      setFormData(prev => ({ ...prev, goal_id: undefined }));
      setGoals([]);
      if (value) {
        loadGoals(value);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('project-management/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Proje Düzenle' : 'Yeni Proje'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isEditMode ? 'Proje bilgilerini güncelleyin' : 'Yeni proje bilgilerini girin'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proje No
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={isEditMode ? formData.project_no : 'Otomatik Oluşturulacak'}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  placeholder="Otomatik oluşturulacak"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Otomatik
                  </span>
                </div>
              </div>
              {!isEditMode && (
                <p className="mt-1 text-xs text-gray-500">
                  Proje numarası otomatik olarak oluşturulacaktır (Format: PRJ-{formData.year}-####)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kaynak
              </label>
              <select
                value={formData.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proje Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.project_name}
                onChange={(e) => handleChange('project_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sorumlu Birim
              </label>
              <select
                value={formData.responsible_unit}
                onChange={(e) => handleChange('responsible_unit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
              {departments.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Henüz birim tanımlanmamış
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durum
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sektör
              </label>
              <select
                value={formData.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {SECTOR_OPTIONS.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alt Sektör
              </label>
              <input
                type="text"
                value={formData.sub_sector}
                onChange={(e) => handleChange('sub_sector', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Konum
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yüklenici
              </label>
              <input
                type="text"
                value={formData.contractor}
                onChange={(e) => handleChange('contractor', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sözleşme Tutarı (₺)
              </label>
              <input
                type="number"
                value={formData.contract_amount}
                onChange={(e) => handleChange('contract_amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Toplam Harcama (₺)
              </label>
              <input
                type="number"
                value={formData.total_expense}
                onChange={(e) => handleChange('total_expense', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fiziki İlerleme (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.physical_progress}
                onChange={(e) => handleChange('physical_progress', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nakdi İlerleme (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.financial_progress}
                onChange={(e) => handleChange('financial_progress', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                İhale Tarihi
              </label>
              <input
                type="date"
                value={formData.tender_date}
                onChange={(e) => handleChange('tender_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                İhale Türü
              </label>
              <select
                value={formData.tender_type}
                onChange={(e) => handleChange('tender_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {TENDER_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yıl
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dönem
              </label>
              <select
                value={formData.period}
                onChange={(e) => handleChange('period', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1">1. Dönem</option>
                <option value="2">2. Dönem</option>
                <option value="3">3. Dönem</option>
                <option value="4">4. Dönem</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stratejik Plan
              </label>
              <select
                value={formData.strategic_plan_id || ''}
                onChange={(e) => handleChange('strategic_plan_id', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {strategicPlans.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.start_year}-{sp.end_year})
                  </option>
                ))}
              </select>
              {strategicPlans.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Henüz stratejik plan tanımlanmamış
                </p>
              )}
            </div>

            {formData.strategic_plan_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amaç
                </label>
                <select
                  value={formData.objective_id || ''}
                  onChange={(e) => handleChange('objective_id', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {objectives.map(obj => (
                    <option key={obj.id} value={obj.id}>
                      {obj.title}
                    </option>
                  ))}
                </select>
                {objectives.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Bu planda amaç tanımlanmamış
                  </p>
                )}
              </div>
            )}

            {formData.objective_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hedef
                </label>
                <select
                  value={formData.goal_id || ''}
                  onChange={(e) => handleChange('goal_id', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {goals.map(goal => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
                {goals.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Bu amaçta hedef tanımlanmamış
                  </p>
                )}
              </div>
            )}

            <div className={formData.strategic_plan_id ? "md:col-span-2" : "md:col-span-2"}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('project-management/projects')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Kaydediliyor...' : isEditMode ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
