import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  Plus, Filter, Download, Search, Eye, Edit2, Trash2
} from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
  description: string;
  category: any;
  owner_unit: any;
  goal: any;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  inherent_level: string;
  residual_level: string;
  risk_response: string;
  status: string;
  is_active: boolean;
}

export default function RiskRegister() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allGoals, setAllGoals] = useState<any[]>([]);
  const [filteredGoals, setFilteredGoals] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_id: '',
    owner_unit_id: '',
    goal_id: '',
    causes: '',
    consequences: '',
    inherent_likelihood: 3,
    inherent_impact: 3,
    residual_likelihood: 2,
    residual_impact: 2,
    risk_response: 'mitigate',
    status: 'identified'
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (formData.owner_unit_id) {
      const goalsForDepartment = allGoals.filter(
        goal => goal.department_id === formData.owner_unit_id
      );
      setFilteredGoals(goalsForDepartment);
      if (formData.goal_id && !goalsForDepartment.find(g => g.id === formData.goal_id)) {
        setFormData(prev => ({ ...prev, goal_id: '' }));
      }
    } else {
      setFilteredGoals([]);
      setFormData(prev => ({ ...prev, goal_id: '' }));
    }
  }, [formData.owner_unit_id, allGoals]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRisks(), loadCategories(), loadDepartments(), loadGoals()]);
    } finally {
      setLoading(false);
    }
  };

  const loadRisks = async () => {
    const { data, error } = await supabase
      .from('risks')
      .select(`
        *,
        category:risk_categories(name, color),
        owner_unit:departments(name),
        goal:goals(name)
      `)
      .eq('organization_id', profile?.organization_id)
      .eq('is_active', true)
      .order('code', { ascending: false });

    if (error) throw error;
    setRisks(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('risk_categories')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setCategories(data || []);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setDepartments(data || []);
  };

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('id, name, title, department_id')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setAllGoals(data || []);
    setFilteredGoals(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category_id || !formData.owner_unit_id) {
      alert('Lütfen kategori ve sorumlu birim seçiniz');
      return;
    }

    const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
    const residualScore = formData.residual_likelihood * formData.residual_impact;

    const getRiskLevel = (score: number) => {
      if (score >= 21) return 'critical';
      if (score >= 17) return 'very_high';
      if (score >= 10) return 'high';
      if (score >= 5) return 'medium';
      return 'low';
    };

    try {
      const { error } = await supabase
        .from('risks')
        .insert({
          organization_id: profile?.organization_id,
          code: formData.code,
          name: formData.name,
          description: formData.description,
          category_id: formData.category_id,
          owner_unit_id: formData.owner_unit_id,
          goal_id: formData.goal_id || null,
          causes: formData.causes || 'Belirtilmedi',
          consequences: formData.consequences || 'Belirtilmedi',
          affected_areas: [],
          inherent_likelihood: formData.inherent_likelihood,
          inherent_impact: formData.inherent_impact,
          inherent_score: inherentScore,
          inherent_level: getRiskLevel(inherentScore),
          residual_likelihood: formData.residual_likelihood,
          residual_impact: formData.residual_impact,
          residual_score: residualScore,
          residual_level: getRiskLevel(residualScore),
          risk_response: formData.risk_response,
          response_rationale: null,
          monitoring_level: 'medium',
          review_frequency: 'quarterly',
          status: formData.status,
          identified_by_id: profile?.id
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        code: '',
        name: '',
        description: '',
        category_id: '',
        owner_unit_id: '',
        goal_id: '',
        causes: '',
        consequences: '',
        inherent_likelihood: 3,
        inherent_impact: 3,
        residual_likelihood: 2,
        residual_impact: 2,
        risk_response: 'mitigate',
        status: 'identified'
      });
      loadRisks();
    } catch (error: any) {
      console.error('Risk eklenirken hata:', error);
      if (error.code === '23505') {
        alert('Bu kod zaten kullanılmaktadır');
      } else {
        alert('Risk eklenemedi: ' + (error.message || 'Bilinmeyen hata'));
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu riski silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risks')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      loadRisks();
    } catch (error) {
      console.error('Risk silinirken hata:', error);
      alert('Risk silinemedi');
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-900 text-white';
      case 'very_high': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getRiskLevelLabel = (level: string) => {
    switch (level) {
      case 'critical': return 'Kritik';
      case 'very_high': return 'Çok Yüksek';
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
      default: return level;
    }
  };

  const getResponseLabel = (response: string) => {
    switch (response) {
      case 'accept': return 'Kabul Et';
      case 'mitigate': return 'Azalt';
      case 'transfer': return 'Transfer Et';
      case 'avoid': return 'Kaçın';
      default: return response;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'identified': return 'Tanımlandı';
      case 'assessed': return 'Değerlendirildi';
      case 'treatment_planned': return 'Faaliyet Planlandı';
      case 'under_treatment': return 'İşlem Görüyor';
      case 'monitoring': return 'İzleniyor';
      case 'closed': return 'Kapatıldı';
      default: return status;
    }
  };

  const filteredRisks = risks.filter(risk => {
    const matchesSearch = risk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         risk.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || risk.category?.id === filterCategory;
    const matchesLevel = filterLevel === 'all' || risk.residual_level === filterLevel;
    const matchesStatus = filterStatus === 'all' || risk.status === filterStatus;

    return matchesSearch && matchesCategory && matchesLevel && matchesStatus;
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Kaydı</h1>
          <p className="text-gray-600">Tüm riskler ve detayları</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Yeni Risk Ekle
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Risk kodu veya adı ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Seviyeler</option>
              <option value="critical">Kritik</option>
              <option value="very_high">Çok Yüksek</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="identified">Tanımlandı</option>
              <option value="assessed">Değerlendirildi</option>
              <option value="treatment_planned">Faaliyet Planlandı</option>
              <option value="under_treatment">İşlem Görüyor</option>
              <option value="monitoring">İzleniyor</option>
              <option value="closed">Kapatıldı</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600">
            {filteredRisks.length} risk gösteriliyor
          </p>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Birim</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Doğal Skor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Artık Skor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Seviye</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yanıt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRisks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    Henüz risk bulunmuyor
                  </td>
                </tr>
              ) : (
                filteredRisks.map(risk => (
                  <tr key={risk.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{risk.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{risk.name}</div>
                      {risk.goal && (
                        <div className="text-xs text-gray-500 mt-1">Hedef: {risk.goal.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {risk.category && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: risk.category.color }}
                          />
                          <span className="text-sm text-gray-700">{risk.category.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {risk.owner_unit?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-gray-900">{risk.inherent_score}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({risk.inherent_likelihood}×{risk.inherent_impact})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-gray-900">{risk.residual_score}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({risk.residual_likelihood}×{risk.residual_impact})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRiskLevelColor(risk.residual_level)}`}>
                        {getRiskLevelLabel(risk.residual_level)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getResponseLabel(risk.risk_response)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                        {getStatusLabel(risk.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`risks/register/${risk.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Detay"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => navigate(`risks/register/${risk.id}/edit`)}
                              className="text-gray-600 hover:text-gray-800"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(risk.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Yeni Risk Ekle</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Kodu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="R-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Kategorisi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seçiniz...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risk Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Risk açıklaması..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detaylı Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Risk ile ilgili detaylı bilgi..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Nedenleri
                  </label>
                  <textarea
                    value={formData.causes}
                    onChange={(e) => setFormData({ ...formData, causes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Riskin oluşma nedenleri..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Sonuçları
                  </label>
                  <textarea
                    value={formData.consequences}
                    onChange={(e) => setFormData({ ...formData, consequences: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Riskin olası sonuçları..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sorumlu Birim <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.owner_unit_id}
                    onChange={(e) => setFormData({ ...formData, owner_unit_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seçiniz...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    İlişkili Amaç
                  </label>
                  <select
                    value={formData.goal_id}
                    onChange={(e) => setFormData({ ...formData, goal_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!formData.owner_unit_id}
                  >
                    <option value="">
                      {formData.owner_unit_id
                        ? 'Seçiniz...'
                        : 'Önce sorumlu birim seçiniz...'}
                    </option>
                    {filteredGoals.map(obj => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name || obj.title}
                      </option>
                    ))}
                  </select>
                  {formData.owner_unit_id && filteredGoals.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Bu birim için tanımlı amaç bulunmuyor
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Doğal Risk Değerlendirmesi</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Olasılık (1-5)
                    </label>
                    <select
                      value={formData.inherent_likelihood}
                      onChange={(e) => setFormData({ ...formData, inherent_likelihood: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="1">1 - Çok Düşük</option>
                      <option value="2">2 - Düşük</option>
                      <option value="3">3 - Orta</option>
                      <option value="4">4 - Yüksek</option>
                      <option value="5">5 - Çok Yüksek</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Etki (1-5)
                    </label>
                    <select
                      value={formData.inherent_impact}
                      onChange={(e) => setFormData({ ...formData, inherent_impact: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="1">1 - Çok Düşük</option>
                      <option value="2">2 - Düşük</option>
                      <option value="3">3 - Orta</option>
                      <option value="4">4 - Yüksek</option>
                      <option value="5">5 - Çok Yüksek</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Skor
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-center font-semibold text-lg">
                      {formData.inherent_likelihood * formData.inherent_impact}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Artık Risk Değerlendirmesi</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Olasılık (1-5)
                    </label>
                    <select
                      value={formData.residual_likelihood}
                      onChange={(e) => setFormData({ ...formData, residual_likelihood: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="1">1 - Çok Düşük</option>
                      <option value="2">2 - Düşük</option>
                      <option value="3">3 - Orta</option>
                      <option value="4">4 - Yüksek</option>
                      <option value="5">5 - Çok Yüksek</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Etki (1-5)
                    </label>
                    <select
                      value={formData.residual_impact}
                      onChange={(e) => setFormData({ ...formData, residual_impact: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="1">1 - Çok Düşük</option>
                      <option value="2">2 - Düşük</option>
                      <option value="3">3 - Orta</option>
                      <option value="4">4 - Yüksek</option>
                      <option value="5">5 - Çok Yüksek</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Skor
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-center font-semibold text-lg">
                      {formData.residual_likelihood * formData.residual_impact}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Yanıtı
                  </label>
                  <select
                    value={formData.risk_response}
                    onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="accept">Kabul Et</option>
                    <option value="mitigate">Azalt</option>
                    <option value="transfer">Transfer Et</option>
                    <option value="avoid">Kaçın</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="identified">Tanımlandı</option>
                    <option value="assessed">Değerlendirildi</option>
                    <option value="treatment_planned">Faaliyet Planlandı</option>
                    <option value="under_treatment">İşlem Görüyor</option>
                    <option value="monitoring">İzleniyor</option>
                    <option value="closed">Kapatıldı</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Risk Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
