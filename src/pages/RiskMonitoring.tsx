import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Trash2, Filter, Activity, Search, FileDown, FileSpreadsheet, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../utils/exportHelpers';

interface Risk {
  id: string;
  code: string;
  name: string;
  current_likelihood: number;
  current_impact: number;
  current_score: number;
}

interface Profile {
  id: string;
  full_name: string;
}

interface MonitoringRecord {
  id: string;
  organization_id: string;
  monitoring_number: string;
  quarter: string;
  monitoring_date: string;
  risk_id: string;
  current_likelihood: number;
  current_impact: number;
  current_score: number;
  previous_score: number;
  score_change: string;
  controls_applied: string;
  controls_effectiveness: string;
  actions_on_time: number;
  delayed_actions: number;
  assessment_notes: string;
  action_recommendations: string;
  monitored_by: string;
  approved_by: string;
  risk?: Risk;
  monitor?: Profile;
  approver?: Profile;
}

const currentYear = new Date().getFullYear();
const quarters = [
  `${currentYear} Q1`,
  `${currentYear} Q2`,
  `${currentYear} Q3`,
  `${currentYear} Q4`
];

const effectivenessOptions = ['Tümü Etkili', 'Kısmen Etkili', 'Etkisiz'];

export default function RiskMonitoring() {
  const { profile } = useAuth();

  const [monitoringRecords, setMonitoringRecords] = useState<MonitoringRecord[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MonitoringRecord | null>(null);

  const [filters, setFilters] = useState({
    quarter: '',
    risk_id: '',
    score_change: '',
    search: ''
  });

  const [formData, setFormData] = useState({
    monitoring_number: '',
    quarter: quarters[Math.floor((new Date().getMonth()) / 3)],
    monitoring_date: new Date().toISOString().split('T')[0],
    risk_id: '',
    current_likelihood: 3,
    current_impact: 3,
    current_score: 9,
    previous_score: 0,
    score_change: 'Aynı',
    controls_applied: '',
    controls_effectiveness: 'Tümü Etkili',
    actions_on_time: 0,
    delayed_actions: 0,
    assessment_notes: '',
    action_recommendations: '',
    monitored_by: '',
    approved_by: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    const score = formData.current_likelihood * formData.current_impact;
    setFormData(prev => ({ ...prev, current_score: score }));
  }, [formData.current_likelihood, formData.current_impact]);

  useEffect(() => {
    if (formData.previous_score && formData.current_score) {
      let change = 'Aynı';
      if (formData.current_score > formData.previous_score) change = 'Arttı';
      else if (formData.current_score < formData.previous_score) change = 'Azaldı';
      setFormData(prev => ({ ...prev, score_change: change }));
    }
  }, [formData.current_score, formData.previous_score]);

  async function loadData() {
    try {
      setLoading(true);

      const [recordsRes, risksRes, usersRes] = await Promise.all([
        supabase
          .from('risk_monitoring_records')
          .select(`
            *,
            risk:risks!risk_id(id, code, name, current_likelihood, current_impact, current_score),
            monitor:profiles!monitored_by(id, full_name),
            approver:profiles!approved_by(id, full_name)
          `)
          .eq('organization_id', profile?.organization_id)
          .order('monitoring_date', { ascending: false }),

        supabase
          .from('risks')
          .select('id, code, name, current_likelihood, current_impact, current_score')
          .eq('organization_id', profile?.organization_id)
          .order('code'),

        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile?.organization_id)
          .order('full_name')
      ]);

      if (recordsRes.error) throw recordsRes.error;
      if (risksRes.error) throw risksRes.error;
      if (usersRes.error) throw usersRes.error;

      setMonitoringRecords(recordsRes.data || []);
      setRisks(risksRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error: any) {
      console.error('Veriler yüklenirken hata:', error);
      alert(`Veriler yüklenirken hata: ${error?.message}`);
    } finally {
      setLoading(false);
    }
  }

  function openModal(record?: MonitoringRecord) {
    if (risks.length === 0) {
      alert('Önce en az bir risk tanımlamalısınız.');
      return;
    }

    if (record) {
      setEditingRecord(record);
      setFormData({
        monitoring_number: record.monitoring_number,
        quarter: record.quarter,
        monitoring_date: record.monitoring_date,
        risk_id: record.risk_id,
        current_likelihood: record.current_likelihood,
        current_impact: record.current_impact,
        current_score: record.current_score,
        previous_score: record.previous_score || 0,
        score_change: record.score_change || 'Aynı',
        controls_applied: record.controls_applied || '',
        controls_effectiveness: record.controls_effectiveness || 'Tümü Etkili',
        actions_on_time: record.actions_on_time || 0,
        delayed_actions: record.delayed_actions || 0,
        assessment_notes: record.assessment_notes || '',
        action_recommendations: record.action_recommendations || '',
        monitored_by: record.monitored_by || '',
        approved_by: record.approved_by || ''
      });
    } else {
      setEditingRecord(null);
      setFormData({
        monitoring_number: '',
        quarter: quarters[Math.floor((new Date().getMonth()) / 3)],
        monitoring_date: new Date().toISOString().split('T')[0],
        risk_id: '',
        current_likelihood: 3,
        current_impact: 3,
        current_score: 9,
        previous_score: 0,
        score_change: 'Aynı',
        controls_applied: '',
        controls_effectiveness: 'Tümü Etkili',
        actions_on_time: 0,
        delayed_actions: 0,
        assessment_notes: '',
        action_recommendations: '',
        monitored_by: '',
        approved_by: ''
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingRecord(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.risk_id) {
      alert('Lütfen bir risk seçin');
      return;
    }

    if (!formData.quarter) {
      alert('Lütfen izleme dönemi seçin');
      return;
    }

    try {
      const recordData = {
        organization_id: profile?.organization_id,
        quarter: formData.quarter,
        monitoring_date: formData.monitoring_date,
        risk_id: formData.risk_id,
        current_likelihood: formData.current_likelihood,
        current_impact: formData.current_impact,
        current_score: formData.current_score,
        previous_score: formData.previous_score || null,
        score_change: formData.score_change,
        controls_applied: formData.controls_applied || null,
        controls_effectiveness: formData.controls_effectiveness,
        actions_on_time: formData.actions_on_time || 0,
        delayed_actions: formData.delayed_actions || 0,
        assessment_notes: formData.assessment_notes || null,
        action_recommendations: formData.action_recommendations || null,
        monitored_by: formData.monitored_by || null,
        approved_by: formData.approved_by || null
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('risk_monitoring_records')
          .update(recordData)
          .eq('id', editingRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_monitoring_records')
          .insert(recordData);

        if (error) throw error;
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('İzleme kaydı kaydedilirken hata:', error);
      alert(`İzleme kaydı kaydedilemedi: ${error?.message}`);
    }
  }

  async function handleDelete(record: MonitoringRecord) {
    if (!confirm(`${record.quarter} izleme kaydını silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('risk_monitoring_records')
        .delete()
        .eq('id', record.id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      console.error('İzleme kaydı silinirken hata:', error);
      alert('İzleme kaydı silinemedi');
    }
  }

  const filteredRecords = monitoringRecords.filter(r => {
    if (!r) return false;
    if (filters.quarter && r.quarter !== filters.quarter) return false;
    if (filters.risk_id && r.risk_id !== filters.risk_id) return false;
    if (filters.score_change && r.score_change !== filters.score_change) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return r.risk?.name?.toLowerCase().includes(search) ||
             r.monitoring_number?.toLowerCase().includes(search);
    }
    return true;
  });

  const stats = {
    total: filteredRecords.length,
    increased: filteredRecords.filter(r => r && r.score_change === 'Arttı').length,
    decreased: filteredRecords.filter(r => r && r.score_change === 'Azaldı').length,
    same: filteredRecords.filter(r => r && r.score_change === 'Aynı').length,
    effective: filteredRecords.filter(r => r && r.controls_effectiveness === 'Tümü Etkili').length
  };

  function clearFilters() {
    setFilters({
      quarter: '',
      risk_id: '',
      score_change: '',
      search: ''
    });
  }

  const exportToExcelHandler = () => {
    const exportData = filteredRecords.map(record => ({
      'İzleme No': record.monitoring_number || '-',
      'Dönem': record.quarter,
      'Tarih': new Date(record.monitoring_date).toLocaleDateString('tr-TR'),
      'Risk': `${record.risk?.code} - ${record.risk?.name}`,
      'Mevcut Skor': record.current_score,
      'Önceki Skor': record.previous_score || '-',
      'Değişim': record.score_change,
      'Kontrol Etkinliği': record.controls_effectiveness,
      'Zamanında Eylem': record.actions_on_time,
      'Geciken Eylem': record.delayed_actions,
      'İzleyen': record.monitor?.full_name || '-',
      'Onaylayan': record.approver?.full_name || '-'
    }));
    exportToExcel(exportData, `risk_izleme_${new Date().toISOString().split('T')[0]}`);
  };

  const exportToPDFHandler = () => {
    const headers = ['İzleme No', 'Dönem', 'Risk', 'Mevcut Skor', 'Değişim', 'Kontrol Etkinliği'];
    const rows = filteredRecords.map(record => [
      record.monitoring_number || '-',
      record.quarter,
      record.risk?.code || '-',
      record.current_score.toString(),
      record.score_change,
      record.controls_effectiveness
    ]);

    const content = `
      <h2>İzleme İstatistikleri</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Toplam İzleme</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #dc2626;">
          <div class="stat-value" style="color: #dc2626;">${stats.increased}</div>
          <div class="stat-label">Risk Arttı</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #16a34a;">
          <div class="stat-value" style="color: #16a34a;">${stats.decreased}</div>
          <div class="stat-label">Risk Azaldı</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #6b7280;">
          <div class="stat-value" style="color: #6b7280;">${stats.same}</div>
          <div class="stat-label">Değişmedi</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #16a34a;">
          <div class="stat-value" style="color: #16a34a;">${stats.effective}</div>
          <div class="stat-label">Etkili Kontrol</div>
        </div>
      </div>
      <h2>Risk İzleme Kayıtları</h2>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF('Risk İzleme Kayıtları', content, `risk_izleme_${new Date().toISOString().split('T')[0]}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7" />
            İzleme Kayıtları
          </h1>
          <p className="text-gray-600 mt-1">Çeyreklik risk izleme ve değerlendirme kayıtları</p>
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
            Yeni İzleme
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => clearFilters()}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Toplam İzleme</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, score_change: 'Arttı' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.increased}</div>
            <div className="text-sm text-gray-600 mt-1">Risk Arttı</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, score_change: 'Azaldı' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.decreased}</div>
            <div className="text-sm text-gray-600 mt-1">Risk Azaldı</div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setFilters({ ...filters, score_change: 'Aynı' })}>
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-600">{stats.same}</div>
            <div className="text-sm text-gray-600 mt-1">Değişmedi</div>
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.effective}</div>
          <div className="text-sm text-gray-600 mt-1">Etkili Kontrol</div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Filtreler</h3>
            </div>
            {(filters.quarter || filters.risk_id || filters.score_change || filters.search) && (
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Temizle
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <select
                value={filters.quarter}
                onChange={(e) => setFilters({ ...filters, quarter: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Dönemler</option>
                {quarters.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

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
                value={filters.score_change}
                onChange={(e) => setFilters({ ...filters, score_change: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Değişimler</option>
                <option value="Arttı">Arttı</option>
                <option value="Azaldı">Azaldı</option>
                <option value="Aynı">Aynı</option>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İzleme No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mevcut Skor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Önceki Skor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Değişim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontrol Etkinliği</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eylem Durumu</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    İzleme kaydı bulunamadı
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-medium text-blue-600">{record.monitoring_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{record.quarter}</div>
                      <div className="text-xs text-gray-500">{new Date(record.monitoring_date).toLocaleDateString('tr-TR')}</div>
                    </td>
                    <td className="px-4 py-3">
                      {record.risk && (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{record.risk.code}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{record.risk.name}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-gray-900">{record.current_score}</div>
                      <div className="text-xs text-gray-500">O:{record.current_likelihood} x E:{record.current_impact}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.previous_score || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {record.score_change === 'Arttı' && <TrendingUp className="w-4 h-4 text-red-600" />}
                        {record.score_change === 'Azaldı' && <TrendingDown className="w-4 h-4 text-green-600" />}
                        {record.score_change === 'Aynı' && <Minus className="w-4 h-4 text-gray-600" />}
                        <span className={`text-sm font-medium ${
                          record.score_change === 'Arttı' ? 'text-red-600' :
                          record.score_change === 'Azaldı' ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          {record.score_change}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        record.controls_effectiveness === 'Tümü Etkili' ? 'bg-green-100 text-green-800' :
                        record.controls_effectiveness === 'Kısmen Etkili' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.controls_effectiveness}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <div className="text-green-600">Zamanında: {record.actions_on_time}</div>
                        <div className="text-red-600">Geciken: {record.delayed_actions}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openModal(record)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingRecord ? 'İzleme Kaydı Düzenle' : 'Yeni İzleme Kaydı'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İzleme Numarası</label>
            <input
              type="text"
              value={formData.monitoring_number || 'Otomatik oluşturulacak'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              disabled
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">İzleme numarası otomatik olarak IZ-YYYY-XXX formatında oluşturulacaktır</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İzleme Dönemi <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.quarter}
                onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                {quarters.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İzleme Tarihi <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={formData.monitoring_date}
                onChange={(e) => setFormData({ ...formData, monitoring_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İzlenecek Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.risk_id}
              onChange={(e) => {
                const selectedRisk = risks.find(r => r.id === e.target.value);
                setFormData({
                  ...formData,
                  risk_id: e.target.value,
                  previous_score: selectedRisk?.current_score || 0
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seçiniz...</option>
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>
                  {risk.code} - {risk.name} (Mevcut Skor: {risk.current_score})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mevcut Olasılık (1-5) <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.current_likelihood}
                onChange={(e) => setFormData({ ...formData, current_likelihood: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5].map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mevcut Etki (1-5) <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.current_impact}
                onChange={(e) => setFormData({ ...formData, current_impact: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5].map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mevcut Skor</label>
              <input
                type="number"
                value={formData.current_score}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-bold"
                disabled
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Önceki Skor</label>
              <input
                type="number"
                value={formData.previous_score}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                disabled
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skor Değişimi</label>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                {formData.score_change === 'Arttı' && <TrendingUp className="w-5 h-5 text-red-600" />}
                {formData.score_change === 'Azaldı' && <TrendingDown className="w-5 h-5 text-green-600" />}
                {formData.score_change === 'Aynı' && <Minus className="w-5 h-5 text-gray-600" />}
                <span className={`font-medium ${
                  formData.score_change === 'Arttı' ? 'text-red-600' :
                  formData.score_change === 'Azaldı' ? 'text-green-600' :
                  'text-gray-600'
                }`}>
                  {formData.score_change}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uygulanan Kontroller</label>
            <textarea
              value={formData.controls_applied}
              onChange={(e) => setFormData({ ...formData, controls_applied: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Hangi kontroller uygulandı?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Etkinliği</label>
            <select
              value={formData.controls_effectiveness}
              onChange={(e) => setFormData({ ...formData, controls_effectiveness: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {effectivenessOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zamanında Tamamlanan Eylemler</label>
              <input
                type="number"
                value={formData.actions_on_time}
                onChange={(e) => setFormData({ ...formData, actions_on_time: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geciken Eylemler</label>
              <input
                type="number"
                value={formData.delayed_actions}
                onChange={(e) => setFormData({ ...formData, delayed_actions: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Genel Değerlendirme</label>
            <textarea
              value={formData.assessment_notes}
              onChange={(e) => setFormData({ ...formData, assessment_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Risk durumu hakkında genel değerlendirme"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alınması Gereken Önlemler</label>
            <textarea
              value={formData.action_recommendations}
              onChange={(e) => setFormData({ ...formData, action_recommendations: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Önerilen aksiyonlar ve önlemler"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İzleyen Kişi</label>
              <select
                value={formData.monitored_by}
                onChange={(e) => setFormData({ ...formData, monitored_by: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Onaylayan Kişi</label>
              <select
                value={formData.approved_by}
                onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
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
