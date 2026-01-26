import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Trash2, Filter, Shield, ExternalLink, MoreVertical, Search, FileDown, FileSpreadsheet, Upload, FileText } from 'lucide-react';
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

interface Control {
  id: string;
  organization_id: string;
  code: string;
  risk_id: string;
  name: string;
  description: string;
  control_type: string;
  frequency: string;
  responsible_department_id: string;
  responsible_person_id: string;
  effectiveness_status: string;
  evidence_file: string;
  risk?: Risk;
  department?: Department;
  responsible_person?: Profile;
}

const controlTypeLabels: Record<string, { label: string; color: string }> = {
  'PREVENTIVE': { label: 'Önleyici', color: 'bg-green-100 text-green-800' },
  'DETECTIVE': { label: 'Tespit Edici', color: 'bg-blue-100 text-blue-800' },
  'CORRECTIVE': { label: 'Düzeltici', color: 'bg-orange-100 text-orange-800' }
};

const controlTypeOptions = [
  { value: 'PREVENTIVE', label: 'Önleyici' },
  { value: 'DETECTIVE', label: 'Tespit Edici' },
  { value: 'CORRECTIVE', label: 'Düzeltici' }
];

const frequencyOptions = ['Her işlem', 'Günlük', 'Haftalık', 'Aylık'];
const effectivenessOptions = ['Etkili', 'Kısmen Etkili', 'Etkisiz'];

export default function RiskControls() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [controls, setControls] = useState<Control[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingControl, setEditingControl] = useState<Control | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    risk_id: '',
    control_type: '',
    department_id: '',
    effectiveness_status: '',
    search: ''
  });

  const [formData, setFormData] = useState({
    code: '',
    risk_id: '',
    name: '',
    description: '',
    control_type: 'PREVENTIVE',
    frequency: 'Aylık',
    responsible_department_id: '',
    responsible_person_id: '',
    effectiveness_status: 'Etkili',
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

      const [controlsRes, risksRes, departmentsRes, usersRes] = await Promise.all([
        supabase
          .from('risk_controls')
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

      if (controlsRes.error) throw controlsRes.error;
      if (risksRes.error) throw risksRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (usersRes.error) throw usersRes.error;

      setControls(controlsRes.data || []);
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

  function openModal(control?: Control) {
    if (risks.length === 0) {
      alert('Önce en az bir risk tanımlamalısınız.');
      return;
    }

    if (control) {
      setEditingControl(control);
      setFormData({
        code: control.code || '',
        risk_id: control.risk_id,
        name: control.name,
        description: control.description || '',
        control_type: control.control_type || 'PREVENTIVE',
        frequency: control.frequency || 'Aylık',
        responsible_department_id: control.responsible_department_id || '',
        responsible_person_id: control.responsible_person_id || '',
        effectiveness_status: control.effectiveness_status || 'Etkili',
        evidence_file: control.evidence_file || ''
      });
      if (control.evidence_file) {
        setFilePreview(control.evidence_file);
      }
    } else {
      setEditingControl(null);
      setFormData({
        code: '',
        risk_id: '',
        name: '',
        description: '',
        control_type: 'PREVENTIVE',
        frequency: 'Aylık',
        responsible_department_id: '',
        responsible_person_id: '',
        effectiveness_status: 'Etkili',
        evidence_file: ''
      });
      setSelectedFile(null);
      setFilePreview('');
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingControl(null);
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
      alert('Lütfen kontrol adını girin');
      return;
    }

    if (!formData.responsible_department_id) {
      alert('Lütfen sorumlu birim seçin');
      return;
    }

    try {
      const controlData = {
        organization_id: profile?.organization_id,
        risk_id: formData.risk_id,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        control_type: formData.control_type,
        frequency: formData.frequency,
        responsible_department_id: formData.responsible_department_id,
        responsible_person_id: formData.responsible_person_id || null,
        effectiveness_status: formData.effectiveness_status,
        evidence_file: formData.evidence_file || null
      };

      if (editingControl) {
        const { error } = await supabase
          .from('risk_controls')
          .update(controlData)
          .eq('id', editingControl.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_controls')
          .insert(controlData);

        if (error) throw error;
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('Kontrol kaydedilirken hata:', error);
      alert(`Kontrol kaydedilemedi: ${error?.message}`);
    }
  }

  async function handleDelete(control: Control) {
    if (!confirm(`${control.name} kontrolünü silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('risk_controls')
        .delete()
        .eq('id', control.id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      console.error('Kontrol silinirken hata:', error);
      alert('Kontrol silinemedi');
    }
  }

  const filteredControls = controls.filter(c => {
    if (!c) return false;
    if (filters.risk_id && c.risk_id !== filters.risk_id) return false;
    if (filters.control_type && c.control_type !== filters.control_type) return false;
    if (filters.department_id && c.responsible_department_id !== filters.department_id) return false;
    if (filters.effectiveness_status && c.effectiveness_status !== filters.effectiveness_status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return c.name?.toLowerCase().includes(search) ||
             c.description?.toLowerCase().includes(search) ||
             c.code?.toLowerCase().includes(search);
    }
    return true;
  });

  const stats = {
    total: filteredControls.length,
    preventive: filteredControls.filter(c => c && c.control_type === 'PREVENTIVE').length,
    detective: filteredControls.filter(c => c && c.control_type === 'DETECTIVE').length,
    corrective: filteredControls.filter(c => c && c.control_type === 'CORRECTIVE').length,
    effective: filteredControls.filter(c => c && c.effectiveness_status === 'Etkili').length
  };

  function clearFilters() {
    setFilters({
      risk_id: '',
      control_type: '',
      department_id: '',
      effectiveness_status: '',
      search: ''
    });
  }

  const exportToExcelHandler = () => {
    const exportData = filteredControls.map(control => ({
      'Kontrol Numarası': control.code || '-',
      'Risk Kodu': control.risk?.code || '-',
      'Risk Adı': control.risk?.name || '-',
      'Kontrol Adı': control.name,
      'Açıklama': control.description || '-',
      'Kontrol Tipi': controlTypeLabels[control.control_type]?.label || control.control_type,
      'Uygulama Sıklığı': control.frequency,
      'Sorumlu Birim': control.department?.name || '-',
      'Sorumlu Kişi': control.responsible_person?.full_name || '-',
      'Etkinlik Durumu': control.effectiveness_status
    }));
    exportToExcel(exportData, `risk_kontrolleri_${new Date().toISOString().split('T')[0]}`);
  };

  const exportToPDFHandler = () => {
    const headers = ['Kontrol No', 'Risk', 'Kontrol Adı', 'Tip', 'Sıklık', 'Sorumlu Birim', 'Etkinlik'];
    const rows = filteredControls.map(control => [
      control.code || '-',
      control.risk?.code || '-',
      control.name,
      controlTypeLabels[control.control_type]?.label || control.control_type,
      control.frequency,
      control.department?.name || '-',
      control.effectiveness_status
    ]);

    const content = `
      <h2>Kontrol İstatistikleri</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Toplam Kontrol</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #16a34a;">
          <div class="stat-value" style="color: #16a34a;">${stats.preventive}</div>
          <div class="stat-label">Önleyici</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #2563eb;">
          <div class="stat-value" style="color: #2563eb;">${stats.detective}</div>
          <div class="stat-label">Tespit Edici</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #ea580c;">
          <div class="stat-value" style="color: #ea580c;">${stats.corrective}</div>
          <div class="stat-label">Düzeltici</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #16a34a;">
          <div class="stat-value" style="color: #16a34a;">${stats.effective}</div>
          <div class="stat-label">Etkili</div>
        </div>
      </div>
      <h2>Risk Kontrolleri Listesi</h2>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF('Risk Kontrolleri Raporu', content, `risk_kontrolleri_${new Date().toISOString().split('T')[0]}`);
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
            <Shield className="w-7 h-7" />
            Kontrol Tanımı
          </h1>
          <p className="text-gray-600 mt-1">Risk kontrol faaliyetleri yönetimi</p>
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
            Yeni Kontrol
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => clearFilters()}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Toplam Kontrol</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, control_type: 'PREVENTIVE' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.preventive}</div>
            <div className="text-sm text-gray-600 mt-1">Önleyici</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, control_type: 'DETECTIVE' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.detective}</div>
            <div className="text-sm text-gray-600 mt-1">Tespit Edici</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, control_type: 'CORRECTIVE' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-orange-600">{stats.corrective}</div>
            <div className="text-sm text-gray-600 mt-1">Düzeltici</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, effectiveness_status: 'Etkili' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.effective}</div>
            <div className="text-sm text-gray-600 mt-1">Etkili Kontrol</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Filtreler</h3>
            </div>
            {(filters.risk_id || filters.control_type || filters.department_id || filters.effectiveness_status || filters.search) && (
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Temizle
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                value={filters.control_type}
                onChange={(e) => setFilters({ ...filters, control_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Tipler</option>
                {Object.keys(controlTypeLabels).map((key) => (
                  <option key={key} value={key}>{controlTypeLabels[key].label}</option>
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

            <div>
              <select
                value={filters.effectiveness_status}
                onChange={(e) => setFilters({ ...filters, effectiveness_status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Etkinlikler</option>
                {effectivenessOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontrol No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlişkili Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontrol Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sıklık</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Birim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Kişi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etkinlik</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredControls.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Kontrol bulunamadı
                  </td>
                </tr>
              ) : (
                filteredControls.map((control) => (
                  <tr key={control.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-medium text-blue-600">{control.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      {control.risk ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{control.risk.code}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{control.risk.name}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{control.name}</div>
                      {control.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{control.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${controlTypeLabels[control.control_type]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {controlTypeLabels[control.control_type]?.label || control.control_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{control.frequency}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {control.department?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {control.responsible_person?.full_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        control.effectiveness_status === 'Etkili' ? 'bg-green-100 text-green-800' :
                        control.effectiveness_status === 'Kısmen Etkili' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {control.effectiveness_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === control.id ? null : control.id);
                          }}
                          className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenu === control.id && (
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
                                  openModal(control);
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
                                  navigate(`risk-management/risks/${control.risk_id}`);
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
                                  handleDelete(control);
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingControl ? 'Kontrol Düzenle' : 'Yeni Kontrol Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kontrol Numarası
            </label>
            <input
              type="text"
              value={formData.code || 'Otomatik oluşturulacak'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              disabled
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Kontrol numarası otomatik olarak K-YYYY-XXX formatında oluşturulacaktır</p>
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
              Kontrol Adı <span className="text-red-500">*</span>
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
                Kontrol Türü <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.control_type}
                onChange={(e) => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {controlTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Uygulama Sıklığı <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {frequencyOptions.map((freq) => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etkinlik Durumu <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.effectiveness_status}
              onChange={(e) => setFormData({ ...formData, effectiveness_status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {effectivenessOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
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
