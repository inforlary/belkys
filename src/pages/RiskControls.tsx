import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Trash2, Filter, Shield, Calendar, ExternalLink, MoreVertical, Search, X, FileDown, FileSpreadsheet } from 'lucide-react';
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

interface Control {
  id: string;
  risk_id: string;
  name: string;
  description: string;
  control_type: string;
  control_nature: string;
  responsible_department_id: string;
  design_effectiveness: number;
  operating_effectiveness: number;
  evidence: string;
  frequency: string;
  is_active: boolean;
  last_test_date?: string;
  next_test_date?: string;
  risk?: Risk;
  department?: Department;
}

const controlTypeLabels: Record<string, { label: string; color: string }> = {
  PREVENTIVE: { label: 'Önleyici', color: 'bg-green-100 text-green-800' },
  DETECTIVE: { label: 'Tespit Edici', color: 'bg-blue-100 text-blue-800' },
  CORRECTIVE: { label: 'Düzeltici', color: 'bg-orange-100 text-orange-800' }
};

const controlNatureLabels: Record<string, { label: string; color: string }> = {
  MANUAL: { label: 'Manuel', color: 'bg-gray-100 text-gray-800' },
  AUTOMATED: { label: 'Otomatik', color: 'bg-purple-100 text-purple-800' },
  SEMI_AUTOMATED: { label: 'Yarı Otomatik', color: 'bg-yellow-100 text-yellow-800' }
};

const effectivenessLevels = [
  { value: 1, label: 'Etkisiz', color: 'text-red-600' },
  { value: 2, label: 'Kısmen Etkili', color: 'text-orange-600' },
  { value: 3, label: 'Orta Düzeyde Etkili', color: 'text-yellow-600' },
  { value: 4, label: 'Büyük Ölçüde Etkili', color: 'text-blue-600' },
  { value: 5, label: 'Tam Etkili', color: 'text-green-600' }
];

export default function RiskControls() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [controls, setControls] = useState<Control[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingControl, setEditingControl] = useState<Control | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    risk_id: '',
    control_type: '',
    control_nature: '',
    department_id: '',
    min_effectiveness: 0,
    search: ''
  });

  const [formData, setFormData] = useState({
    risk_id: '',
    name: '',
    description: '',
    control_type: 'PREVENTIVE',
    control_nature: 'MANUAL',
    responsible_department_id: '',
    design_effectiveness: 3,
    operating_effectiveness: 3,
    evidence: '',
    frequency: '',
    last_test_date: '',
    next_test_date: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      console.log('[RiskControls] Veriler yükleniyor...', {
        organization_id: profile?.organization_id,
        timestamp: new Date().toISOString()
      });

      const [controlsRes, risksRes, departmentsRes] = await Promise.all([
        supabase
          .from('risk_controls')
          .select(`
            *,
            risk:risks!inner(id, code, name, organization_id),
            department:departments!responsible_department_id(id, name)
          `)
          .eq('risk.organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),

        supabase
          .from('risks')
          .select('id, code, name')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name')
      ]);

      if (controlsRes.error) {
        console.error('[RiskControls] Kontroller yüklenirken hata:', {
          error: controlsRes.error,
          message: controlsRes.error.message,
          code: controlsRes.error.code
        });
        throw controlsRes.error;
      }

      if (risksRes.error) {
        console.error('[RiskControls] Riskler yüklenirken hata:', {
          error: risksRes.error,
          message: risksRes.error.message,
          code: risksRes.error.code
        });
        throw risksRes.error;
      }

      if (departmentsRes.error) {
        console.error('[RiskControls] Birimler yüklenirken hata:', {
          error: departmentsRes.error,
          message: departmentsRes.error.message,
          code: departmentsRes.error.code
        });
        throw departmentsRes.error;
      }

      console.log('[RiskControls] Veriler başarıyla yüklendi:', {
        controls: controlsRes.data?.length || 0,
        risks: risksRes.data?.length || 0,
        departments: departmentsRes.data?.length || 0
      });

      setControls(controlsRes.data || []);
      setRisks(risksRes.data || []);
      setDepartments(departmentsRes.data || []);

      if (!risksRes.data || risksRes.data.length === 0) {
        console.warn('[RiskControls] Hiç risk bulunamadı. Kullanıcıya bildirim göster.');
      }

      if (!departmentsRes.data || departmentsRes.data.length === 0) {
        console.warn('[RiskControls] Hiç birim bulunamadı. Kullanıcıya bildirim göster.');
      }
    } catch (error: any) {
      console.error('[RiskControls] Veriler yüklenirken kritik hata:', {
        error,
        message: error?.message,
        stack: error?.stack
      });
      alert(`Veriler yüklenirken hata oluştu: ${error?.message || 'Bilinmeyen hata'}. Lütfen sayfayı yenileyin veya sistem yöneticisine başvurun.`);
    } finally {
      setLoading(false);
    }
  }

  function openModal(control?: Control) {
    console.log('[RiskControls] Modal açılıyor:', {
      editMode: !!control,
      controlId: control?.id,
      availableRisks: risks.length,
      availableDepartments: departments.length
    });

    if (risks.length === 0) {
      alert('Önce en az bir risk tanımlamalısınız. Risk Kaydı sayfasına yönlendiriliyorsunuz.');
      console.warn('[RiskControls] Hiç risk yok, modal açılamıyor');
      navigate('risk-management/risks');
      return;
    }

    if (departments.length === 0) {
      alert('Sistem ayarlarında hiç birim tanımlanmamış. Lütfen sistem yöneticisi ile iletişime geçin.');
      console.error('[RiskControls] Hiç birim yok, modal açılamıyor');
      return;
    }

    if (control) {
      console.log('[RiskControls] Düzenleme modu:', {
        controlId: control.id,
        controlName: control.name,
        riskId: control.risk_id,
        departmentId: control.responsible_department_id
      });

      const riskExists = risks.some(r => r.id === control.risk_id);
      const departmentExists = departments.some(d => d.id === control.responsible_department_id);

      if (!riskExists) {
        console.warn('[RiskControls] Kontrolün riski bulunamadı:', control.risk_id);
      }

      if (!departmentExists && control.responsible_department_id) {
        console.warn('[RiskControls] Kontrolün sorumlu birimi bulunamadı:', control.responsible_department_id);
      }

      setEditingControl(control);
      setFormData({
        risk_id: control.risk_id,
        name: control.name,
        description: control.description || '',
        control_type: control.control_type,
        control_nature: control.control_nature,
        responsible_department_id: control.responsible_department_id || '',
        design_effectiveness: control.design_effectiveness,
        operating_effectiveness: control.operating_effectiveness,
        evidence: control.evidence || '',
        frequency: control.frequency || '',
        last_test_date: control.last_test_date || '',
        next_test_date: control.next_test_date || ''
      });
    } else {
      console.log('[RiskControls] Yeni kayıt modu');
      setEditingControl(null);
      setFormData({
        risk_id: '',
        name: '',
        description: '',
        control_type: 'PREVENTIVE',
        control_nature: 'MANUAL',
        responsible_department_id: '',
        design_effectiveness: 3,
        operating_effectiveness: 3,
        evidence: '',
        frequency: '',
        last_test_date: '',
        next_test_date: ''
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingControl(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    console.log('[RiskControls] Form gönderiliyor:', {
      editMode: !!editingControl,
      formData: {
        risk_id: formData.risk_id,
        name: formData.name,
        responsible_department_id: formData.responsible_department_id
      }
    });

    if (!formData.risk_id) {
      alert('Lütfen bir risk seçin');
      console.warn('[RiskControls] Risk seçilmedi');
      return;
    }

    if (!formData.name?.trim()) {
      alert('Lütfen kontrol adını girin');
      console.warn('[RiskControls] Kontrol adı boş');
      return;
    }

    if (!formData.responsible_department_id) {
      alert('Lütfen sorumlu birim seçin');
      console.warn('[RiskControls] Sorumlu birim seçilmedi');
      return;
    }

    if (formData.design_effectiveness < 1 || formData.design_effectiveness > 5) {
      alert('Tasarım etkinliği 1-5 arasında olmalıdır');
      console.warn('[RiskControls] Geçersiz tasarım etkinliği:', formData.design_effectiveness);
      return;
    }

    try {
      const controlData = {
        risk_id: formData.risk_id,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        control_type: formData.control_type,
        control_nature: formData.control_nature,
        responsible_department_id: formData.responsible_department_id,
        design_effectiveness: formData.design_effectiveness,
        evidence: formData.evidence?.trim() || null,
        frequency: formData.frequency?.trim() || null,
        last_test_date: formData.last_test_date || null,
        next_test_date: formData.next_test_date || null,
        is_active: true
      };

      console.log('[RiskControls] Kontrol kaydediliyor:', controlData);

      if (editingControl) {
        console.log('[RiskControls] Güncelleme modu, ID:', editingControl.id);
        const { error } = await supabase
          .from('risk_controls')
          .update(controlData)
          .eq('id', editingControl.id);

        if (error) {
          console.error('[RiskControls] Güncelleme hatası:', {
            error,
            message: error.message,
            code: error.code,
            details: error.details
          });
          throw error;
        }
        console.log('[RiskControls] Kontrol başarıyla güncellendi');
      } else {
        console.log('[RiskControls] Yeni kayıt modu');
        const { error } = await supabase
          .from('risk_controls')
          .insert(controlData);

        if (error) {
          console.error('[RiskControls] Ekleme hatası:', {
            error,
            message: error.message,
            code: error.code,
            details: error.details
          });
          throw error;
        }
        console.log('[RiskControls] Kontrol başarıyla eklendi');
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('[RiskControls] Kontrol kaydedilirken kritik hata:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      let errorMessage = 'Kontrol kaydedilemedi';
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      if (error?.hint) {
        errorMessage += `\n\nİpucu: ${error.hint}`;
      }

      alert(errorMessage);
    }
  }

  async function handleDelete(control: Control) {
    if (!confirm(`${control.name} kontrolünü silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('risk_controls')
        .update({ is_active: false })
        .eq('id', control.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Kontrol silinirken hata:', error);
      alert('Kontrol silinemedi');
    }
  }

  function getEffectivenessLabel(value: number) {
    const level = effectivenessLevels.find(l => l.value === value);
    return level || effectivenessLevels[2];
  }

  function getEffectivenessStars(value: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < value ? 'text-yellow-500' : 'text-gray-300'}>★</span>
    ));
  }

  function isTestDue(control: Control): boolean {
    if (!control.next_test_date) return false;
    const nextDate = new Date(control.next_test_date);
    const today = new Date();
    const diffDays = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }

  function isTestOverdue(control: Control): boolean {
    if (!control.next_test_date) return false;
    const nextDate = new Date(control.next_test_date);
    const today = new Date();
    return nextDate < today;
  }

  const filteredControls = controls.filter(c => {
    if (!c) return false;
    if (filters.risk_id && c.risk_id !== filters.risk_id) return false;
    if (filters.control_type && c.control_type !== filters.control_type) return false;
    if (filters.control_nature && c.control_nature !== filters.control_nature) return false;
    if (filters.department_id && c.responsible_department_id !== filters.department_id) return false;
    if (filters.min_effectiveness && c.operating_effectiveness < filters.min_effectiveness) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return c.name?.toLowerCase().includes(search) || c.description?.toLowerCase().includes(search);
    }
    return true;
  });

  const stats = {
    total: filteredControls.length,
    preventive: filteredControls.filter(c => c && c.control_type === 'PREVENTIVE').length,
    detective: filteredControls.filter(c => c && c.control_type === 'DETECTIVE').length,
    testDue: filteredControls.filter(c => c && isTestDue(c)).length,
    overdue: filteredControls.filter(c => c && isTestOverdue(c)).length
  };

  function clearFilters() {
    setFilters({
      risk_id: '',
      control_type: '',
      control_nature: '',
      department_id: '',
      min_effectiveness: 0,
      search: ''
    });
  }

  const exportToExcelHandler = () => {
    const exportData = filteredControls.map(control => ({
      'Risk Kodu': control.risk?.code || '-',
      'Risk Adı': control.risk?.name || '-',
      'Kontrol Adı': control.name,
      'Açıklama': control.description,
      'Kontrol Tipi': controlTypeLabels[control.control_type]?.label || '-',
      'Kontrol Doğası': controlNatureLabels[control.control_nature]?.label || '-',
      'Sorumlu Birim': control.department?.name || '-',
      'Tasarım Etkinliği': `${control.design_effectiveness} - ${getEffectivenessLabel(control.design_effectiveness).label}`,
      'Operasyonel Etkinlik': `${control.operating_effectiveness} - ${getEffectivenessLabel(control.operating_effectiveness).label}`,
      'Sıklık': control.frequency,
      'Son Test': control.last_test_date || '-',
      'Sonraki Test': control.next_test_date || '-',
      'Kanıt': control.evidence
    }));
    exportToExcel(exportData, `risk_kontrolleri_${new Date().toISOString().split('T')[0]}`);
  };

  const exportToPDFHandler = () => {
    const headers = ['Risk', 'Kontrol Adı', 'Tip', 'Tasarım Etkinliği', 'Op. Etkinlik', 'Sıklık', 'Sonraki Test'];
    const rows = filteredControls.map(control => [
      control.risk?.code || '-',
      control.name,
      controlTypeLabels[control.control_type]?.label || '-',
      `${control.design_effectiveness}★`,
      `${control.operating_effectiveness}★`,
      control.frequency,
      control.next_test_date || '-'
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
        <div class="stat-box" style="border-left: 4px solid #f59e0b;">
          <div class="stat-value" style="color: #f59e0b;">${stats.testDue}</div>
          <div class="stat-label">Test Yaklaşan</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #dc2626;">
          <div class="stat-value" style="color: #dc2626;">${stats.overdue}</div>
          <div class="stat-label">Gecikmiş Test</div>
        </div>
      </div>
      <h2>Risk Kontrolleri Listesi</h2>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF('Risk Kontrolleri Raporu', content, `risk_kontrolleri_${new Date().toISOString().split('T')[0]}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7" />
            Risk Kontrolleri
          </h1>
          <p className="text-gray-600 mt-1">Risk kontrol faaliyetleri takibi</p>
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
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, control_type: '' })}>
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

        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.testDue}</div>
          <div className="text-sm text-gray-600 mt-1">Test Yaklaşıyor</div>
          <div className="text-xs text-gray-500 mt-1">30 gün içinde</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-gray-600 mt-1">Test Gecikmiş</div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Filtreler</h3>
            </div>
            {(filters.risk_id || filters.control_type || filters.control_nature || filters.department_id || filters.min_effectiveness || filters.search) && (
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Temizle
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <select
                value={filters.risk_id}
                onChange={(e) => setFilters({ ...filters, risk_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Risk</option>
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
                <option value="">Kontrol Tipi</option>
                {Object.entries(controlTypeLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.control_nature}
                onChange={(e) => setFilters({ ...filters, control_nature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kontrol Yapısı</option>
                {Object.entries(controlNatureLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.department_id}
                onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Birim</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.min_effectiveness}
                onChange={(e) => setFilters({ ...filters, min_effectiveness: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Min Etkinlik</option>
                {effectivenessLevels.map((level) => (
                  <option key={level.value} value={level.value}>{level.label}</option>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontrol Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlişkili Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yapı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tasarım</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uygulama</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sonraki Test</th>
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
                filteredControls.map((control) => {
                  const testDue = isTestDue(control);
                  const testOverdue = isTestOverdue(control);
                  const operatingLevel = getEffectivenessLabel(control.operating_effectiveness);

                  return (
                    <tr key={control.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{control.name}</div>
                        {control.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{control.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {control.risk ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{control.risk.code}</div>
                            <div className="text-xs text-gray-500 line-clamp-1">{control.risk.name}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-red-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${controlTypeLabels[control.control_type]?.color}`}>
                          {controlTypeLabels[control.control_type]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${controlNatureLabels[control.control_nature]?.color}`}>
                          {controlNatureLabels[control.control_nature]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {getEffectivenessStars(control.design_effectiveness)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {getEffectivenessStars(control.operating_effectiveness)}
                        </div>
                        <div className={`text-xs mt-1 ${operatingLevel.color}`}>
                          {operatingLevel.label}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {control.department?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className={testOverdue ? 'text-red-600 font-medium' : testDue ? 'text-yellow-600 font-medium' : 'text-gray-700'}>
                            {control.next_test_date ? new Date(control.next_test_date).toLocaleDateString('tr-TR') : '-'}
                          </div>
                          {testOverdue && (
                            <div className="text-xs text-red-600 font-medium">Gecikmiş</div>
                          )}
                          {testDue && !testOverdue && (
                            <div className="text-xs text-yellow-600">Yaklaşıyor</div>
                          )}
                        </div>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingControl ? 'Kontrol Düzenle' : 'Yeni Kontrol Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlişkili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.risk_id}
              onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!editingControl}
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
                Kontrol Tipi <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.control_type}
                onChange={(e) => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="PREVENTIVE">Önleyici</option>
                <option value="DETECTIVE">Tespit Edici</option>
                <option value="CORRECTIVE">Düzeltici</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontrol Yapısı <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.control_nature}
                onChange={(e) => setFormData({ ...formData, control_nature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="MANUAL">Manuel</option>
                <option value="AUTOMATED">Otomatik</option>
                <option value="SEMI_AUTOMATED">Yarı Otomatik</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.responsible_department_id}
              onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Uygulama Sıklığı</label>
            <input
              type="text"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              placeholder="Örn: Günlük, Haftalık, Her işlemde"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tasarım Etkinliği <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {effectivenessLevels.map((level) => (
                <label key={level.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="design_effectiveness"
                    value={level.value}
                    checked={formData.design_effectiveness === level.value}
                    onChange={(e) => setFormData({ ...formData, design_effectiveness: parseInt(e.target.value) })}
                    className="text-blue-600"
                  />
                  <span className="flex items-center gap-2">
                    <span className="text-yellow-500">
                      {Array.from({ length: level.value }, (_, i) => '★').join('')}
                    </span>
                    <span className="text-sm text-gray-700">{level.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Uygulama Etkinliği
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  {getEffectivenessStars(formData.operating_effectiveness)}
                </div>
                <span className="text-sm font-medium text-blue-900">
                  {effectivenessLevels.find(l => l.value === formData.operating_effectiveness)?.label || 'Hesaplanacak'}
                </span>
              </div>
              <p className="text-xs text-blue-700">
                ℹ️ Bu alan otomatik olarak hesaplanır. Kontrol uygulama kayıtlarınıza göre ortalama etkinlik değeri sistemce belirlenir.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kanıtlar/Belgeler</label>
            <textarea
              value={formData.evidence}
              onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Kontrol kanıtlarını açıklayın"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Son Test Tarihi</label>
              <input
                type="date"
                value={formData.last_test_date}
                onChange={(e) => setFormData({ ...formData, last_test_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sonraki Test Tarihi</label>
              <input
                type="date"
                value={formData.next_test_date}
                onChange={(e) => setFormData({ ...formData, next_test_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
