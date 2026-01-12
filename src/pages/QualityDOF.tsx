import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/ui/Modal';
import {
  FileText,
  Plus,
  Search,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  Trash2
} from 'lucide-react';

interface Nonconformity {
  id: string;
  code: string;
  title: string;
  description: string;
  source: string;
  source_reference: string;
  status: string;
  detected_date: string;
  target_date: string;
  closed_date: string;
  department_id: string;
  responsible_id: string;
  created_at: string;
  department?: { name: string };
  responsible?: { full_name: string };
  process?: { code: string; name: string };
}

interface Stats {
  total: number;
  open: number;
  in_progress: number;
  verification: number;
  closed: number;
}

const SOURCE_OPTIONS = [
  { value: 'INTERNAL_AUDIT', label: 'İç Tetkik' },
  { value: 'EXTERNAL_AUDIT', label: 'Dış Tetkik' },
  { value: 'CUSTOMER_COMPLAINT', label: 'Müşteri Şikayeti' },
  { value: 'PROCESS_ERROR', label: 'Süreç Hatası' },
  { value: 'PROCESS_KPI', label: 'Süreç KPI' },
  { value: 'EMPLOYEE_REPORT', label: 'Personel Bildirimi' },
  { value: 'MANAGEMENT_REVIEW', label: 'YGG' },
  { value: 'INSPECTION', label: 'Muayene/Kontrol' },
  { value: 'OTHER', label: 'Diğer' }
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Açık', color: 'bg-red-500' },
  { value: 'ANALYSIS', label: 'Analiz', color: 'bg-orange-500' },
  { value: 'ACTION_PLANNED', label: 'Faaliyet Planlandı', color: 'bg-yellow-500' },
  { value: 'IN_PROGRESS', label: 'Uygulanıyor', color: 'bg-yellow-500' },
  { value: 'VERIFICATION', label: 'Doğrulama', color: 'bg-blue-500' },
  { value: 'EFFECTIVENESS', label: 'Etkinlik Değ.', color: 'bg-purple-500' },
  { value: 'CLOSED', label: 'Kapatıldı', color: 'bg-green-500' },
  { value: 'CANCELLED', label: 'İptal', color: 'bg-gray-500' }
];

export default function QualityDOF() {
  const { profile } = useAuth();
  const [nonconformities, setNonconformities] = useState<Nonconformity[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, in_progress: 0, verification: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNC, setSelectedNC] = useState<Nonconformity | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const [ncData, deptData, processData, userData] = await Promise.all([
        supabase
          .from('qm_nonconformities')
          .select(`
            *,
            department:departments!qm_nonconformities_department_id_fkey(name),
            responsible:profiles!qm_nonconformities_responsible_id_fkey(full_name),
            process:qm_processes!qm_nonconformities_process_id_fkey(code, name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name'),

        supabase
          .from('qm_processes')
          .select('id, code, name')
          .eq('organization_id', profile.organization_id)
          .order('code'),

        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile.organization_id)
          .order('full_name')
      ]);

      if (ncData.error) {
        console.error('Error loading nonconformities:', ncData.error);
        alert('DÖF yükleme hatası: ' + ncData.error.message);
      }

      if (ncData.data) {
        setNonconformities(ncData.data);
        calculateStats(ncData.data);
      }
      if (deptData.data) setDepartments(deptData.data);
      if (processData.data) setProcesses(processData.data);
      if (userData.data) setUsers(userData.data);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Veri yükleme hatası: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Nonconformity[]) => {
    const stats = {
      total: data.length,
      open: data.filter(nc => nc.status === 'OPEN' || nc.status === 'ANALYSIS').length,
      in_progress: data.filter(nc => nc.status === 'IN_PROGRESS' || nc.status === 'ACTION_PLANNED').length,
      verification: data.filter(nc => nc.status === 'VERIFICATION' || nc.status === 'EFFECTIVENESS').length,
      closed: data.filter(nc => nc.status === 'CLOSED').length
    };
    setStats(stats);
  };

  const getStatusBadge = (status: string) => {
    const statusObj = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusObj?.color || 'bg-gray-500'}`}>
        {statusObj?.label || status}
      </span>
    );
  };

  const getSourceLabel = (source: string) => {
    return SOURCE_OPTIONS.find(s => s.value === source)?.label || source;
  };

  const filteredNonconformities = nonconformities.filter(nc => {
    const matchesSearch = nc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         nc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = !filterSource || nc.source === filterSource;
    const matchesStatus = !filterStatus || nc.status === filterStatus;
    const matchesDepartment = !filterDepartment || nc.department_id === filterDepartment;

    return matchesSearch && matchesSource && matchesStatus && matchesDepartment;
  });

  const handleView = (nc: Nonconformity) => {
    setSelectedNC(nc);
    setShowDetailModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu DÖF kaydını silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('qm_nonconformities')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Silme hatası: ' + error.message);
    } else {
      alert('DÖF kaydı silindi');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-red-600" />
            DÖF Yönetimi
          </h1>
          <p className="text-gray-600 mt-1">Düzeltici ve Önleyici Faaliyetler</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Yeni DÖF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <FileText className="h-10 w-10 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Açık</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.open}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Devam Eden</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.in_progress}</p>
            </div>
            <Clock className="h-10 w-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Doğrulama</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.verification}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-blue-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Kapatılan</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.closed}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="DÖF kodu veya başlık ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">Tüm Kaynaklar</option>
            {SOURCE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">Tüm Birimler</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">Tüm Durumlar</option>
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KOD
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  BAŞLIK
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KAYNAK
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  BİRİM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SORUMLU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DURUM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TARİH
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İŞLEM
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNonconformities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Kayıt bulunamadı
                  </td>
                </tr>
              ) : (
                filteredNonconformities.map((nc) => (
                  <tr key={nc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleView(nc)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{nc.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{nc.title}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{getSourceLabel(nc.source)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{nc.department?.name || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{nc.responsible?.full_name || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(nc.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {new Date(nc.detected_date).toLocaleDateString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleView(nc)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Görüntüle"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                          <button
                            onClick={() => handleDelete(nc.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Sil"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddNCModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
          departments={departments}
          processes={processes}
          users={users}
          profile={profile}
        />
      )}

      {showDetailModal && selectedNC && (
        <NCDetailModal
          nonconformity={selectedNC}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedNC(null);
          }}
          onUpdate={() => {
            loadData();
          }}
          departments={departments}
          processes={processes}
          users={users}
          profile={profile}
        />
      )}
    </div>
  );
}

function AddNCModal({ onClose, onSuccess, departments, processes, users, profile }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    source: '',
    source_reference: '',
    process_id: '',
    department_id: '',
    detected_date: new Date().toISOString().split('T')[0],
    detected_by: profile?.id || '',
    immediate_action: '',
    responsible_id: '',
    responsible_department_id: '',
    target_date: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.source) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('qm_nonconformities')
        .insert([{
          ...formData,
          organization_id: profile.organization_id,
          created_by: profile.id,
          status: 'OPEN'
        }])
        .select();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      console.log('DÖF kaydı oluşturuldu:', data);
      alert('DÖF kaydı başarıyla oluşturuldu');
      onSuccess();
    } catch (error: any) {
      console.error('Kaydetme hatası:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Yeni DÖF Kaydı"
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Başlık *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uygunsuzluk Tanımı *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Uygunsuzluğu detaylı açıklayın..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kaynak *
            </label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {SOURCE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referans No
            </label>
            <input
              type="text"
              value={formData.source_reference}
              onChange={(e) => setFormData({ ...formData, source_reference: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="TET-2025-003"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlişkili Süreç
            </label>
            <select
              value={formData.process_id}
              onChange={(e) => setFormData({ ...formData, process_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Seçiniz...</option>
              {processes.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlişkili Birim
            </label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Seçiniz...</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tespit Tarihi *
            </label>
            <input
              type="date"
              value={formData.detected_date}
              onChange={(e) => setFormData({ ...formData, detected_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tespit Eden
            </label>
            <select
              value={formData.detected_by}
              onChange={(e) => setFormData({ ...formData, detected_by: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Seçiniz...</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yapılan Acil Düzeltme (Correction)
            </label>
            <textarea
              value={formData.immediate_action}
              onChange={(e) => setFormData({ ...formData, immediate_action: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Uygunsuzluğu gidermek için yapılan acil müdahale..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DÖF Sorumlusu *
            </label>
            <select
              value={formData.responsible_id}
              onChange={(e) => setFormData({ ...formData, responsible_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim
            </label>
            <select
              value={formData.responsible_department_id}
              onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Seçiniz...</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hedef Kapanış Tarihi *
            </label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NCDetailModal({ nonconformity, onClose, onUpdate, departments, processes, users, profile }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: nonconformity.title || '',
    description: nonconformity.description || '',
    source: nonconformity.source || '',
    source_reference: nonconformity.source_reference || '',
    process_id: nonconformity.process_id || '',
    department_id: nonconformity.department_id || '',
    detected_date: nonconformity.detected_date || '',
    immediate_action: nonconformity.immediate_action || '',
    responsible_id: nonconformity.responsible_id || '',
    responsible_department_id: nonconformity.responsible_department_id || '',
    target_date: nonconformity.target_date || '',
    status: nonconformity.status || 'OPEN',
    root_cause: nonconformity.root_cause || '',
    corrective_action: nonconformity.corrective_action || '',
    preventive_action: nonconformity.preventive_action || '',
    verification_result: nonconformity.verification_result || '',
    effectiveness_result: nonconformity.effectiveness_result || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('qm_nonconformities')
        .update(formData)
        .eq('id', nonconformity.id);

      if (error) throw error;

      alert('DÖF başarıyla güncellendi');
      setIsEditing(false);
      onUpdate();
      onClose();
    } catch (error: any) {
      alert('Güncelleme hatası: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusObj = STATUS_OPTIONS.find(s => s.value === status);
    return statusObj?.color || 'bg-gray-500';
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${nonconformity.code} - ${nonconformity.title}`}
      size="xlarge"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(formData.status)}`}>
              {STATUS_OPTIONS.find(s => s.value === formData.status)?.label}
            </span>
            <span className="text-sm text-gray-600">
              Tespit: {formData.detected_date ? new Date(formData.detected_date).toLocaleDateString('tr-TR') : '-'}
            </span>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Düzenle
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu</label>
                <select
                  value={formData.responsible_id}
                  onChange={(e) => setFormData({ ...formData, responsible_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Seçiniz...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Birim</label>
                <select
                  value={formData.responsible_department_id}
                  onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Seçiniz...</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Tarih</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uygunsuzluk Tanımı</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acil Düzeltme</label>
              <textarea
                value={formData.immediate_action}
                onChange={(e) => setFormData({ ...formData, immediate_action: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kök Neden Analizi</label>
              <textarea
                value={formData.root_cause}
                onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Uygunsuzluğun kök nedeni..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Düzeltici Faaliyet</label>
              <textarea
                value={formData.corrective_action}
                onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Kök nedeni ortadan kaldıracak düzeltici faaliyet..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Önleyici Faaliyet</label>
              <textarea
                value={formData.preventive_action}
                onChange={(e) => setFormData({ ...formData, preventive_action: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Benzer uygunsuzlukların önlenmesi için alınacak önlemler..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doğrulama Sonucu</label>
              <textarea
                value={formData.verification_result}
                onChange={(e) => setFormData({ ...formData, verification_result: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Faaliyetlerin uygulandığının doğrulanması..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etkinlik Değerlendirme</label>
              <textarea
                value={formData.effectiveness_result}
                onChange={(e) => setFormData({ ...formData, effectiveness_result: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Alınan aksiyonların etkinliği..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">UYGUNSUZLUK TANIMI</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900">{nonconformity.description}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">KAYNAK BİLGİLERİ</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Kaynak</p>
                  <p className="text-sm font-medium text-gray-900">
                    {SOURCE_OPTIONS.find(s => s.value === nonconformity.source)?.label}
                  </p>
                </div>
                {nonconformity.source_reference && (
                  <div>
                    <p className="text-sm text-gray-600">Referans</p>
                    <p className="text-sm font-medium text-gray-900">{nonconformity.source_reference}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Birim</p>
                  <p className="text-sm font-medium text-gray-900">{nonconformity.department?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sorumlu</p>
                  <p className="text-sm font-medium text-gray-900">{nonconformity.responsible?.full_name || '-'}</p>
                </div>
              </div>
            </div>

            {nonconformity.immediate_action && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">ACİL DÜZELTME</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-900">{nonconformity.immediate_action}</p>
                </div>
              </div>
            )}

            {nonconformity.root_cause && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">KÖK NEDEN ANALİZİ</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-900">{nonconformity.root_cause}</p>
                </div>
              </div>
            )}

            {nonconformity.corrective_action && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">DÜZELTİCİ FAALİYET</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-900">{nonconformity.corrective_action}</p>
                </div>
              </div>
            )}

            {nonconformity.preventive_action && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">ÖNLEYİCİ FAALİYET</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-900">{nonconformity.preventive_action}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
