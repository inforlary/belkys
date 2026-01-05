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
  objective: any;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  risk_level: string;
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

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRisks(), loadCategories()]);
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
        objective:objectives(title)
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
    const matchesLevel = filterLevel === 'all' || risk.risk_level === filterLevel;
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
            onClick={() => navigate('risks/register/new')}
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
                      {risk.objective && (
                        <div className="text-xs text-gray-500 mt-1">Hedef: {risk.objective.title}</div>
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
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRiskLevelColor(risk.risk_level)}`}>
                        {getRiskLevelLabel(risk.risk_level)}
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
    </div>
  );
}
