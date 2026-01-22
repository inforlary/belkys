import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Zap, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';

interface ProjectRow {
  id: string;
  project_no: string;
  project_name: string;
  sector: string;
  responsible_unit: string;
  contract_amount: string;
  status: string;
  related_objective_id?: string;
  related_goal_id?: string;
  related_indicator_id?: string;
  sp_connected: boolean;
  errors: string[];
}

interface Objective {
  id: string;
  code: string;
  name: string;
}

interface Goal {
  id: string;
  code: string;
  name: string;
  objective_id: string;
}

interface Indicator {
  id: string;
  code: string;
  name: string;
  goal_id: string;
}

const SECTORS = ['DKH-SOSYAL', 'ULAŞIM', 'ALTYAPI', 'ÇEVRE'];
const STATUSES = [
  { value: 'planned', label: 'Planlandı' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'delayed', label: 'Gecikmiş' }
];

export default function QuickProjectEntry() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [source, setSource] = useState('İLYAS');
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState(4);

  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  const [showSPModal, setShowSPModal] = useState(false);
  const [currentRowId, setCurrentRowId] = useState('');
  const [selectedObjective, setSelectedObjective] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedIndicator, setSelectedIndicator] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDepartments();
      loadObjectives();
      initializeRows();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedObjective) {
      loadGoals(selectedObjective);
      setSelectedGoal('');
      setSelectedIndicator('');
    }
  }, [selectedObjective]);

  useEffect(() => {
    if (selectedGoal) {
      loadIndicators(selectedGoal);
      setSelectedIndicator('');
    }
  }, [selectedGoal]);

  const initializeRows = () => {
    const initialRows: ProjectRow[] = Array.from({ length: 5 }, (_, index) => ({
      id: `row-${Date.now()}-${index}`,
      project_no: '',
      project_name: '',
      sector: '',
      responsible_unit: '',
      contract_amount: '',
      status: 'planned',
      sp_connected: false,
      errors: []
    }));
    setRows(initialRows);
  };

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

  const loadObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('id, code, name')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setObjectives(data || []);
    } catch (error) {
      console.error('Amaçlar yüklenirken hata:', error);
    }
  };

  const loadGoals = async (objectiveId: string) => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, code, name, objective_id')
        .eq('objective_id', objectiveId)
        .order('code');

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Hedefler yüklenirken hata:', error);
    }
  };

  const loadIndicators = async (goalId: string) => {
    try {
      const { data, error } = await supabase
        .from('indicators')
        .select('id, code, name, goal_id')
        .eq('goal_id', goalId)
        .order('code');

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
    }
  };

  const updateRow = (id: string, field: keyof ProjectRow, value: any) => {
    setRows(rows.map(row =>
      row.id === id ? { ...row, [field]: value, errors: [] } : row
    ));
  };

  const addRow = () => {
    const newRow: ProjectRow = {
      id: `row-${Date.now()}`,
      project_no: '',
      project_name: '',
      sector: '',
      responsible_unit: '',
      contract_amount: '',
      status: 'planned',
      sp_connected: false,
      errors: []
    };
    setRows([...rows, newRow]);
  };

  const deleteRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const openSPModal = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      setCurrentRowId(rowId);
      setSelectedObjective(row.related_objective_id || '');
      setSelectedGoal(row.related_goal_id || '');
      setSelectedIndicator(row.related_indicator_id || '');
      setShowSPModal(true);
    }
  };

  const saveSPConnection = () => {
    if (!selectedObjective || !selectedGoal || !selectedIndicator) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    setRows(rows.map(row =>
      row.id === currentRowId
        ? {
            ...row,
            related_objective_id: selectedObjective,
            related_goal_id: selectedGoal,
            related_indicator_id: selectedIndicator,
            sp_connected: true
          }
        : row
    ));

    setShowSPModal(false);
    setCurrentRowId('');
  };

  const validateRow = (row: ProjectRow): string[] => {
    const errors: string[] = [];

    if (!row.project_no.trim()) {
      errors.push('Proje No gerekli');
    }

    if (!row.project_name.trim()) {
      errors.push('Proje Adı gerekli');
    } else if (row.project_name.trim().length < 10) {
      errors.push('Proje Adı en az 10 karakter olmalı');
    }

    if (!row.sector) {
      errors.push('Sektör gerekli');
    }

    if (!row.responsible_unit) {
      errors.push('Sorumlu Birim gerekli');
    }

    return errors;
  };

  const clearAll = () => {
    if (confirm('Tüm satırları temizlemek istediğinize emin misiniz?')) {
      initializeRows();
    }
  };

  const saveAll = async () => {
    const filledRows = rows.filter(row =>
      row.project_no.trim() || row.project_name.trim()
    );

    if (filledRows.length === 0) {
      alert('Lütfen en az bir proje girin');
      return;
    }

    const validatedRows = filledRows.map(row => ({
      ...row,
      errors: validateRow(row)
    }));

    const hasErrors = validatedRows.some(row => row.errors.length > 0);

    if (hasErrors) {
      setRows(rows.map(row => {
        const validated = validatedRows.find(vr => vr.id === row.id);
        return validated || row;
      }));
      alert('Bazı satırlarda hata var. Lütfen düzeltin.');
      return;
    }

    const hasMissingSP = validatedRows.some(row => !row.sp_connected);
    if (hasMissingSP) {
      if (!confirm('Bazı projeler SP bağlantısı olmadan kaydedilecek. Devam etmek istiyor musunuz?')) {
        return;
      }
    }

    try {
      setSaving(true);

      const projectsToInsert = validatedRows.map(row => ({
        organization_id: profile?.organization_id,
        project_no: row.project_no.trim(),
        project_name: row.project_name.trim(),
        source,
        year,
        period,
        sector: row.sector,
        responsible_unit: row.responsible_unit,
        contract_amount: row.contract_amount ? parseFloat(row.contract_amount) : null,
        status: row.status,
        related_objective_id: row.related_objective_id || null,
        related_goal_id: row.related_goal_id || null,
        related_indicator_id: row.related_indicator_id || null,
        physical_progress: 0,
        financial_progress: 0,
        total_expense: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('projects')
        .insert(projectsToInsert);

      if (error) {
        if (error.code === '23505') {
          alert('Hata: Bazı proje numaraları zaten mevcut. Lütfen benzersiz proje numaraları kullanın.');
        } else {
          throw error;
        }
        return;
      }

      alert(`${projectsToInsert.length} proje başarıyla eklendi`);
      navigate('project-management/projects');
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      alert('Projeler kaydedilirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const filledRowCount = rows.filter(row =>
    row.project_no.trim() || row.project_name.trim()
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="w-8 h-8 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hızlı Proje Girişi</h1>
          <p className="text-sm text-gray-600">Birden fazla projeyi hızlıca ekleyin</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Genel Ayarlar (Tüm Projeler İçin)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kaynak</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="İLYAS">İLYAS</option>
              <option value="Beyanname">Beyanname</option>
              <option value="Genel">Genel</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Yıl</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dönem</label>
            <select
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>I. Dönem</option>
              <option value={2}>II. Dönem</option>
              <option value={3}>III. Dönem</option>
              <option value={4}>IV. Dönem</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">#</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-32">Proje No</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Proje Adı</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">Sektör</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">Sorumlu Birim</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-32">Tutar (TL)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">Durum</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-16">SP</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-16">Sil</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={row.errors.length > 0 ? 'bg-red-50 border-2 border-red-300' : ''}
                >
                  <td className="px-3 py-2 text-sm text-gray-700">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.project_no}
                      onChange={(e) => updateRow(row.id, 'project_no', e.target.value)}
                      placeholder="S112"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.project_name}
                      onChange={(e) => updateRow(row.id, 'project_name', e.target.value)}
                      placeholder="Proje adını girin"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.sector}
                      onChange={(e) => updateRow(row.id, 'sector', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Seçin...</option>
                      {SECTORS.map(sector => (
                        <option key={sector} value={sector}>{sector}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.responsible_unit}
                      onChange={(e) => updateRow(row.id, 'responsible_unit', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Seçin...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.contract_amount}
                      onChange={(e) => updateRow(row.id, 'contract_amount', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(row.id, 'status', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openSPModal(row.id)}
                      className={`p-1 rounded transition ${
                        row.sp_connected
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={row.sp_connected ? 'SP bağlantısı var' : 'SP bağlantısı ekle'}
                    >
                      {row.sp_connected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => deleteRow(row.id)}
                      disabled={rows.length === 1}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Satırı sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.some(row => row.errors.length > 0) && (
          <div className="p-4 bg-red-50 border-t border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Bazı satırlarda hatalar var:</p>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {rows.filter(row => row.errors.length > 0).map((row, index) => (
                    <li key={row.id}>
                      Satır {rows.indexOf(row) + 1}: {row.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
          >
            <Plus className="w-4 h-4" />
            Satır Ekle
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">{filledRowCount}</span> proje girildi
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearAll}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            disabled={saving}
          >
            Temizle
          </button>
          <button
            onClick={saveAll}
            disabled={saving || filledRowCount === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
          </button>
        </div>
      </div>

      {showSPModal && (
        <Modal
          isOpen={showSPModal}
          onClose={() => setShowSPModal(false)}
          title="Stratejik Plan Bağlantısı"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adım 1 - Stratejik Amaç Seçin
              </label>
              <select
                value={selectedObjective}
                onChange={(e) => setSelectedObjective(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Amaç seçin...</option>
                {objectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.code} - {obj.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adım 2 - Hedef Seçin
              </label>
              <select
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value)}
                disabled={!selectedObjective}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Hedef seçin...</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.code} - {goal.name}
                  </option>
                ))}
              </select>
              {!selectedObjective && (
                <p className="mt-1 text-xs text-gray-500">Önce amaç seçmelisiniz</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adım 3 - Performans Göstergesi Seçin
              </label>
              <select
                value={selectedIndicator}
                onChange={(e) => setSelectedIndicator(e.target.value)}
                disabled={!selectedGoal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Gösterge seçin...</option>
                {indicators.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.code} - {ind.name}
                  </option>
                ))}
              </select>
              {!selectedGoal && (
                <p className="mt-1 text-xs text-gray-500">Önce hedef seçmelisiniz</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowSPModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                İptal
              </button>
              <button
                onClick={saveSPConnection}
                disabled={!selectedObjective || !selectedGoal || !selectedIndicator}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Bağlantıyı Kaydet
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
