import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Trash2, Filter, Target, ExternalLink, MoreVertical, Search, FileDown, FileSpreadsheet, Upload, FileText } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../utils/exportHelpers';

interface Risk {
  id: string;
  code: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
  department_id: string;
}

interface Treatment {
  id: string;
  organization_id: string;
  code: string;
  risk_id: string;
  name: string;
  description: string;
  resources_required: string;
  actual_cost: number;
  responsible_department_id: string;
  responsible_person_id: string;
  start_date: string;
  target_date: string;
  status: string;
  progress_percentage: number;
  notes: string;
  evidence_file: string;
  risk?: Risk;
  department?: Department;
  responsible_person?: Profile;
}

const resourceOptions = ['Bütçe', 'Personel', 'Yazılım', 'Eğitim'];
const statusOptions = ['Planlandı', 'Devam Ediyor', 'Tamamlandı', 'İptal'];

const statusColors: Record<string, string> = {
  'Planlandı': 'bg-gray-100 text-gray-800',
  'Devam Ediyor': 'bg-blue-100 text-blue-800',
  'Tamamlandı': 'bg-green-100 text-green-800',
  'İptal': 'bg-red-100 text-red-800'
};

export default function RiskTreatments() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    risk_id: '',
    status: '',
    department_id: '',
    search: ''
  });

  const [formData, setFormData] = useState({
    code: '',
    risk_id: '',
    name: '',
    description: '',
    resources_required: 'Bütçe',
    actual_cost: 0,
    responsible_department_id: '',
    responsible_person_id: '',
    start_date: '',
    target_date: '',
    status: 'Planlandı',
    progress_percentage: 0,
    notes: '',
    evidence_file: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      const [treatmentsRes, risksRes, departmentsRes, usersRes] = await Promise.all([
        supabase
          .from('risk_treatments')
          .select(`
            *,
            risk:risks!risk_id(id, code, name),
            department:departments!responsible_department_id(id, name),
            responsible_person:profiles!responsible_person_id(id, full_name)
          `)
          .eq('organization_id', profile?.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('risks')
          .select('id, code, name')
          .eq('organization_id', profile?.organization_id)
          .order('code'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name'),

        supabase
          .from('profiles')
          .select('id, full_name, department_id')
          .eq('organization_id', profile?.organization_id)
          .order('full_name')
      ]);

      if (treatmentsRes.error) throw treatmentsRes.error;
      if (risksRes.error) throw risksRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (usersRes.error) throw usersRes.error;

      setTreatments(treatmentsRes.data || []);
      setRisks(risksRes.data || []);
      setDepartments(departmentsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error: any) {
      console.error('Veriler yüklenirken hata:', error);
      alert(`Veriler yüklenirken hata: ${error?.message}`);
    } finally {
      setLoading(false);
    }
  }

  function openModal(treatment?: Treatment) {
    if (risks.length === 0) {
      alert('Önce en az bir risk tanımlamalısınız.');
      return;
    }

    if (treatment) {
      setEditingTreatment(treatment);
      setFormData({
        code: treatment.code || '',
        risk_id: treatment.risk_id,
        name: treatment.name,
        description: treatment.description || '',
        resources_required: treatment.resources_required || 'Bütçe',
        actual_cost: treatment.actual_cost || 0,
        responsible_department_id: treatment.responsible_department_id || '',
        responsible_person_id: treatment.responsible_person_id || '',
        start_date: treatment.start_date || '',
        target_date: treatment.target_date || '',
        status: treatment.status || 'Planlandı',
        progress_percentage: treatment.progress_percentage || 0,
        notes: treatment.notes || '',
        evidence_file: treatment.evidence_file || ''
      });
      if (treatment.evidence_file) {
        setFilePreview(treatment.evidence_file);
      }
    } else {
      setEditingTreatment(null);
      setFormData({
        code: '',
        risk_id: '',
        name: '',
        description: '',
        resources_required: 'Bütçe',
        actual_cost: 0,
        responsible_department_id: '',
        responsible_person_id: '',
        start_date: '',
        target_date: '',
        status: 'Planlandı',
        progress_percentage: 0,
        notes: '',
        evidence_file: ''
      });
      setSelectedFile(null);
      setFilePreview('');
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTreatment(null);
    setSelectedFile(null);
    setFilePreview('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFilePreview(base64String);
        setFormData({ ...formData, evidence_file: base64String });
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.risk_id) {
      alert('Lütfen bir risk seçin');
      return;
    }

    if (!formData.name?.trim()) {
      alert('Lütfen eylem adını girin');
      return;
    }

    if (!formData.responsible_department_id) {
      alert('Lütfen sorumlu birim seçin');
      return;
    }

    if (formData.start_date && formData.target_date && formData.start_date > formData.target_date) {
      alert('Hedef bitiş tarihi başlangıç tarihinden önce olamaz');
      return;
    }

    try {
      const treatmentData = {
        organization_id: profile?.organization_id,
        risk_id: formData.risk_id,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        resources_required: formData.resources_required,
        actual_cost: formData.actual_cost || 0,
        responsible_department_id: formData.responsible_department_id,
        responsible_person_id: formData.responsible_person_id || null,
        start_date: formData.start_date || null,
        target_date: formData.target_date || null,
        status: formData.status,
        progress_percentage: formData.progress_percentage,
        notes: formData.notes?.trim() || null,
        evidence_file: formData.evidence_file || null
      };

      if (editingTreatment) {
        const { error } = await supabase
          .from('risk_treatments')
          .update(treatmentData)
          .eq('id', editingTreatment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_treatments')
          .insert(treatmentData);

        if (error) throw error;
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('Eylem kaydedilirken hata:', error);
      alert(`Eylem kaydedilemedi: ${error?.message}`);
    }
  }

  async function handleDelete(treatment: Treatment) {
    if (!confirm(`${treatment.name} eylemini silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('risk_treatments')
        .delete()
        .eq('id', treatment.id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      console.error('Eylem silinirken hata:', error);
      alert('Eylem silinemedi');
    }
  }

  function isDelayed(treatment: Treatment): boolean {
    if (!treatment.target_date || treatment.status === 'Tamamlandı' || treatment.status === 'İptal') return false;
    const targetDate = new Date(treatment.target_date);
    const today = new Date();
    return targetDate < today;
  }

  const filteredTreatments = treatments.filter(t => {
    if (!t) return false;
    if (filters.risk_id && t.risk_id !== filters.risk_id) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.department_id && t.responsible_department_id !== filters.department_id) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return t.name?.toLowerCase().includes(search) ||
             t.description?.toLowerCase().includes(search) ||
             t.code?.toLowerCase().includes(search);
    }
    return true;
  });

  const stats = {
    total: filteredTreatments.length,
    planned: filteredTreatments.filter(t => t && t.status === 'Planlandı').length,
    ongoing: filteredTreatments.filter(t => t && t.status === 'Devam Ediyor').length,
    completed: filteredTreatments.filter(t => t && t.status === 'Tamamlandı').length,
    delayed: filteredTreatments.filter(t => t && isDelayed(t)).length
  };

  function clearFilters() {
    setFilters({
      risk_id: '',
      status: '',
      department_id: '',
      search: ''
    });
  }

  const exportToExcelHandler = () => {
    const exportData = filteredTreatments.map(treatment => ({
      'Eylem Numarası': treatment.code || '-',
      'Risk Kodu': treatment.risk?.code || '-',
      'Risk Adı': treatment.risk?.name || '-',
      'Eylem Adı': treatment.name,
      'Açıklama': treatment.description || '-',
      'Gerekli Kaynak': treatment.resources_required,
      'Tahmini Maliyet': treatment.actual_cost,
      'Sorumlu Birim': treatment.department?.name || '-',
      'Sorumlu Kişi': treatment.responsible_person?.full_name || '-',
      'Başlangıç': treatment.start_date || '-',
      'Hedef Bitiş': treatment.target_date || '-',
      'Durum': treatment.status,
      'İlerleme': `${treatment.progress_percentage}%`
    }));
    exportToExcel(exportData, `eylem_planlari_${new Date().toISOString().split('T')[0]}`);
  };

  const exportToPDFHandler = () => {
    const headers = ['Eylem No', 'Risk', 'Eylem Adı', 'Kaynak', 'Durum', 'İlerleme', 'Hedef Tarih'];
    const rows = filteredTreatments.map(treatment => [
      treatment.code || '-',
      treatment.risk?.code || '-',
      treatment.name,
      treatment.resources_required,
      treatment.status,
      `${treatment.progress_percentage}%`,
      treatment.target_date || '-'
    ]);

    const content = `
      <h2>Eylem Planı İstatistikleri</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Toplam Eylem</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #6b7280;">
          <div class="stat-value" style="color: #6b7280;">${stats.planned}</div>
          <div class="stat-label">Planlandı</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #2563eb;">
          <div class="stat-value" style="color: #2563eb;">${stats.ongoing}</div>
          <div class="stat-label">Devam Ediyor</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #16a34a;">
          <div class="stat-value" style="color: #16a34a;">${stats.completed}</div>
          <div class="stat-label">Tamamlandı</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #dc2626;">
          <div class="stat-value" style="color: #dc2626;">${stats.delayed}</div>
          <div class="stat-label">Gecikmiş</div>
        </div>
      </div>
      <h2>Eylem Planları Listesi</h2>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF('Eylem Planları Raporu', content, `eylem_planlari_${new Date().toISOString().split('T')[0]}`);
  };

  const filteredUsers = users.filter(u => u.department_id === formData.responsible_department_id);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-7 h-7" />
            Eylem Planı
          </h1>
          <p className="text-gray-600 mt-1">Risk azaltma eylem planları yönetimi</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcelHandler}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={exportToPDFHandler}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Eylem
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => clearFilters()}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Toplam Eylem</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, status: 'Planlandı' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-600">{stats.planned}</div>
            <div className="text-sm text-gray-600 mt-1">Planlandı</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, status: 'Devam Ediyor' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.ongoing}</div>
            <div className="text-sm text-gray-600 mt-1">Devam Ediyor</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, status: 'Tamamlandı' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600 mt-1">Tamamlandı</div>
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.delayed}</div>
          <div className="text-sm text-gray-600 mt-1">Gecikmiş</div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Filtreler</h3>
            </div>
            {(filters.risk_id || filters.status || filters.department_id || filters.search) && (
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Temizle
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <select
                value={filters.risk_id}
                onChange={(e) => setFilters({ ...filters, risk_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Riskler</option>
                {risks.map((risk) => (
                  <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Durumlar</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.department_id}
                onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Birimler</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Ara..."
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eylem No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlişkili Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eylem Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gerekli Kaynak</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maliyet</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hedef Tarih</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlerleme</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTreatments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    Eylem bulunamadı
                  </td>
                </tr>
              ) : (
                filteredTreatments.map((treatment) => {
                  const delayed = isDelayed(treatment);

                  return (
                    <tr key={treatment.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-medium text-blue-600">{treatment.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        {treatment.risk ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{treatment.risk.code}</div>
                            <div className="text-xs text-gray-500 line-clamp-1">{treatment.risk.name}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{treatment.name}</div>
                        {treatment.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{treatment.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{treatment.resources_required}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {treatment.actual_cost ? `${treatment.actual_cost.toLocaleString('tr-TR')} TL` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{treatment.department?.name || '-'}</div>
                        {treatment.responsible_person && (
                          <div className="text-xs text-gray-500">{treatment.responsible_person.full_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${delayed ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                          {treatment.target_date ? new Date(treatment.target_date).toLocaleDateString('tr-TR') : '-'}
                        </div>
                        {delayed && (
                          <div className="text-xs text-red-600 font-medium">Gecikmiş</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[treatment.status] || 'bg-gray-100 text-gray-800'}`}>
                          {treatment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                treatment.progress_percentage === 100 ? 'bg-green-500' :
                                treatment.progress_percentage >= 75 ? 'bg-blue-500' :
                                treatment.progress_percentage >= 50 ? 'bg-yellow-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${treatment.progress_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-10 text-right">
                            {treatment.progress_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === treatment.id ? null : treatment.id);
                            }}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenu === treatment.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(null);
                                }}
                              />
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    openModal(treatment);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit className="w-4 h-4" />
                                  Düzenle
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    navigate(`risk-management/risks/${treatment.risk_id}`);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Riske Git
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    handleDelete(treatment);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Sil
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingTreatment ? 'Eylem Düzenle' : 'Yeni Eylem Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Numarası
            </label>
            <input
              type="text"
              value={formData.code || 'Otomatik oluşturulacak'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              disabled
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Eylem numarası otomatik olarak E-YYYY-XXX formatında oluşturulacaktır</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlişkili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.risk_id}
              onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seçiniz...</option>
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gerekli Kaynak <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.resources_required}
                onChange={(e) => setFormData({ ...formData, resources_required: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {resourceOptions.map((resource) => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Maliyet (TL)</label>
              <input
                type="number"
                value={formData.actual_cost}
                onChange={(e) => setFormData({ ...formData, actual_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.responsible_department_id}
              onChange={(e) => {
                setFormData({ ...formData, responsible_department_id: e.target.value, responsible_person_id: '' });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seçiniz...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
            <select
              value={formData.responsible_person_id}
              onChange={(e) => setFormData({ ...formData, responsible_person_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!formData.responsible_department_id}
            >
              <option value="">Seçiniz...</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </select>
            {!formData.responsible_department_id && (
              <p className="text-xs text-gray-500 mt-1">Önce sorumlu birim seçiniz</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Bitiş Tarihi</label>
              <input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gerçekleşme Yüzdesi ({formData.progress_percentage}%)
              </label>
              <input
                type="range"
                value={formData.progress_percentage}
                onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) })}
                className="w-full"
                min="0"
                max="100"
                step="5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kanıt Dosyası</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Dosya Seç</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
              </label>
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                </div>
              )}
              {!selectedFile && filePreview && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FileText className="w-4 h-4" />
                  <span>Dosya mevcut</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Maksimum dosya boyutu: 5MB</p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Kaydet
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
