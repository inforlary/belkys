import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  InstitutionalCode,
  ExpenseEconomicCode,
  RevenueEconomicCode,
  FinancingType,
} from '../types/database';
import { Settings, Plus, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

type CodeType = 'institutional' | 'expense' | 'revenue' | 'financing';

interface CodeFormData {
  level?: number;
  code: string;
  name: string;
  parent_id?: string;
  description?: string;
}

export default function BudgetCodes() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<CodeType>('institutional');
  const [institutionalCodes, setInstitutionalCodes] = useState<InstitutionalCode[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseEconomicCode[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<RevenueEconomicCode[]>([]);
  const [financingTypes, setFinancingTypes] = useState<FinancingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CodeFormData>({
    level: 1,
    code: '',
    name: '',
    parent_id: '',
    description: '',
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadAllCodes();
    }
  }, [profile]);

  const loadAllCodes = async () => {
    setLoading(true);
    await Promise.all([
      loadInstitutionalCodes(),
      loadExpenseCodes(),
      loadRevenueCodes(),
      loadFinancingTypes(),
    ]);
    setLoading(false);
  };

  const loadInstitutionalCodes = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from('budget_institutional_codes')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('tam_kod');
    setInstitutionalCodes(data || []);
  };

  const loadExpenseCodes = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from('expense_economic_codes')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('full_code');
    setExpenseCodes(data || []);
  };

  const loadRevenueCodes = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from('revenue_economic_codes')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('full_code');
    setRevenueCodes(data || []);
  };

  const loadFinancingTypes = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from('financing_types')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('code');
    setFinancingTypes(data || []);
  };

  const getCurrentCodes = () => {
    switch (activeTab) {
      case 'institutional':
        return institutionalCodes;
      case 'expense':
        return expenseCodes;
      case 'revenue':
        return revenueCodes;
      case 'financing':
        return financingTypes;
    }
  };

  const getTableName = () => {
    switch (activeTab) {
      case 'institutional':
        return 'budget_institutional_codes';
      case 'expense':
        return 'expense_economic_codes';
      case 'revenue':
        return 'revenue_economic_codes';
      case 'financing':
        return 'financing_types';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const tableName = getTableName();
      let baseData: any = {
        organization_id: profile.organization_id,
      };

      if (activeTab === 'institutional') {
        const parent = formData.parent_id ? getCurrentCodes().find((c: any) => c.id === formData.parent_id) : null;

        if (formData.level === 1) {
          baseData.level = 1;
          baseData.kurum_kodu = formData.code;
          baseData.kurum_adi = formData.name;
          baseData.tam_kod = `${formData.code}`;
          baseData.il_kodu = '41';
          baseData.il_adi = 'Kocaeli';
          baseData.mahalli_idare_turu = 1;
        } else {
          baseData.level = 2;
          baseData.birim_kodu = formData.code;
          baseData.birim_adi = formData.name;
          baseData.parent_id = formData.parent_id || null;
          if (parent) {
            baseData.tam_kod = `${parent.tam_kod}-${formData.code}`;
            baseData.il_kodu = parent.il_kodu;
            baseData.il_adi = parent.il_adi;
            baseData.mahalli_idare_turu = parent.mahalli_idare_turu;
            baseData.kurum_kodu = parent.kurum_kodu;
            baseData.kurum_adi = parent.kurum_adi;
          }
        }
        baseData.aciklama = formData.description || null;
        baseData.is_active = true;
      } else if (activeTab === 'expense' || activeTab === 'revenue') {
        let fullCode = formData.code;
        if (formData.parent_id) {
          const parent = getCurrentCodes().find((c: any) => c.id === formData.parent_id);
          if (parent) {
            fullCode = `${parent.full_code}-${formData.code}`;
          }
        }
        baseData.level = formData.level;
        baseData.code = formData.code;
        baseData.name = formData.name;
        baseData.parent_id = formData.parent_id || null;
        baseData.full_code = fullCode;
        baseData.is_active = true;
      } else if (activeTab === 'financing') {
        baseData.code = formData.code;
        baseData.name = formData.name;
        baseData.description = formData.description || null;
        baseData.is_active = true;
      }

      if (editingId) {
        const { error } = await supabase
          .from(tableName)
          .update({ ...baseData, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
        alert('Başarıyla güncellendi');
      } else {
        const { error } = await supabase.from(tableName).insert(baseData);
        if (error) throw error;
        alert('Başarıyla eklendi');
      }

      loadAllCodes();
      closeModal();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase.from(getTableName()).delete().eq('id', id);
      if (error) throw error;
      alert('Silindi');
      loadAllCodes();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      if (activeTab === 'institutional') {
        setFormData({
          level: item.level || 1,
          code: item.level === 1 ? item.kurum_kodu : item.birim_kodu,
          name: item.level === 1 ? item.kurum_adi : item.birim_adi,
          parent_id: item.parent_id || '',
          description: item.aciklama || '',
        });
      } else {
        setFormData({
          level: item.level || 1,
          code: item.code,
          name: item.name,
          parent_id: item.parent_id || '',
          description: item.description || '',
        });
      }
    } else {
      setEditingId(null);
      setFormData({
        level: 1,
        code: '',
        name: '',
        parent_id: '',
        description: '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const getParentOptions = () => {
    const codes = getCurrentCodes();
    if (activeTab === 'financing') return [];
    return codes.filter((c: any) => !formData.level || c.level < formData.level);
  };

  const handleBulkImport = async () => {
    if (!profile?.organization_id || !importData.trim()) {
      alert('Lütfen veri yapıştırın');
      return;
    }

    try {
      const lines = importData.trim().split('\n');
      const records = [];
      const seenCodes = new Set<string>();
      let added = 0;
      let skipped = 0;
      let duplicates = 0;

      const { data: existingCodes } = await supabase
        .from(getTableName())
        .select('full_code')
        .eq('organization_id', profile.organization_id);

      const existingFullCodes = new Set(existingCodes?.map(c => c.full_code) || []);

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 3) {
          skipped++;
          continue;
        }

        const level1 = parts[0];
        const level2 = parts[1];
        let level3 = '';
        let level4 = '';
        let nameStartIndex = 2;

        if (parts[2] && /^\d+$/.test(parts[2])) {
          level3 = parts[2];
          nameStartIndex = 3;

          if (parts[3] && /^\d+$/.test(parts[3])) {
            level4 = parts[3];
            nameStartIndex = 4;
          }
        }

        const name = parts.slice(nameStartIndex).join(' ').trim();

        if (!level1 || !level2 || !name) {
          skipped++;
          continue;
        }

        let fullCode = `${level1}-${level2}`;
        let level = 2;
        let code = level2;

        if (level3) {
          fullCode = `${level1}-${level2}-${level3}`;
          level = 3;
          code = level3;
        }

        if (level4) {
          fullCode = `${level1}-${level2}-${level3}-${level4}`;
          level = 4;
          code = level4;
        }

        if (existingFullCodes.has(fullCode) || seenCodes.has(fullCode)) {
          duplicates++;
          continue;
        }

        seenCodes.add(fullCode);

        let tableData: any = {
          organization_id: profile.organization_id,
          name: name,
        };

        if (activeTab === 'institutional') {
          tableData.level = level;
          tableData.code = code;
          tableData.full_code = fullCode;
        } else if (activeTab === 'expense' || activeTab === 'revenue') {
          tableData.level = level;
          tableData.code = code;
          tableData.full_code = fullCode;
        }

        records.push(tableData);
      }

      if (records.length === 0) {
        alert(`İçe aktarılacak yeni kayıt yok. ${duplicates} duplicate atlandı, ${skipped} geçersiz kayıt atlandı`);
        return;
      }

      const { data, error } = await supabase
        .from(getTableName())
        .insert(records)
        .select();

      if (error) throw error;

      added = data?.length || 0;
      alert(`Başarılı! ${added} kayıt eklendi${duplicates > 0 ? `, ${duplicates} duplicate atlandı` : ''}${skipped > 0 ? `, ${skipped} geçersiz kayıt atlandı` : ''}`);

      setImportData('');
      setImportModalOpen(false);
      loadAllCodes();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>;
  }

  const tabs = [
    { id: 'institutional' as CodeType, label: 'Kurumsal Kodlar', color: 'blue' },
    { id: 'expense' as CodeType, label: 'Gider Ekonomik', color: 'green' },
    { id: 'revenue' as CodeType, label: 'Gelir Ekonomik', color: 'purple' },
    { id: 'financing' as CodeType, label: 'Finansman Tipleri', color: 'orange' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kod Tanımları</h1>
          <p className="text-slate-600 mt-1">Bütçe sınıflandırma kodlarını yönetin</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Excel'den İçe Aktar
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kod Ekle
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="p-6">
          {getCurrentCodes().length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600">Henüz kod tanımlanmamış</p>
            </div>
          ) : (
            <div className="space-y-2">
              {getCurrentCodes().map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {item.level && (
                      <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded">
                        Seviye {item.level}
                      </span>
                    )}
                    <span className="font-mono text-sm font-bold text-slate-700 bg-white px-3 py-1 rounded">
                      {activeTab === 'institutional' ? item.tam_kod : (item.full_code || item.code)}
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">
                        {activeTab === 'institutional'
                          ? (item.birim_adi || item.kurum_adi)
                          : item.name}
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                      )}
                      {activeTab === 'institutional' && item.aciklama && (
                        <p className="text-sm text-slate-600 mt-1">{item.aciklama}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Kod Düzenle' : 'Yeni Kod Ekle'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab !== 'financing' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Seviye *
              </label>
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData({ ...formData, level: parseInt(e.target.value), parent_id: '' })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value={1}>Seviye I</option>
                <option value={2}>Seviye II</option>
                <option value={3}>Seviye III</option>
                <option value={4}>Seviye IV</option>
              </select>
            </div>
          )}

          {activeTab !== 'financing' && formData.level && formData.level > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Üst Kod</label>
              <select
                value={formData.parent_id}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Üst Kod Yok</option>
                {getParentOptions().map((parent: any) => (
                  <option key={parent.id} value={parent.id}>
                    {activeTab === 'institutional'
                      ? `${parent.tam_kod} - ${parent.kurum_adi || parent.birim_adi}`
                      : `${parent.full_code} - ${parent.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
              placeholder="Örn: 01"
            />
            {formData.parent_id && (
              <p className="text-xs text-slate-500 mt-1">
                Tam Kod:{' '}
                {activeTab === 'institutional'
                  ? `${getCurrentCodes().find((c: any) => c.id === formData.parent_id)?.tam_kod}-${formData.code || 'XX'}`
                  : `${getCurrentCodes().find((c: any) => c.id === formData.parent_id)?.full_code}-${formData.code || 'XX'}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ad *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>

          {activeTab === 'financing' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              İptal
            </Button>
            <Button type="submit">{editingId ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Excel'den Toplu İçe Aktar"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">FORMAT KURALLARI:</p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Her satır: Kod1 Kod2 [Kod3] İsim şeklinde olmalı</li>
              <li>Seviye 2: 2 12 İsim (2 kod)</li>
              <li>Seviye 3: 2 12 42 İsim (3 kod)</li>
              <li>Excel'den direkt kopyalayıp yapıştırabilirsiniz</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Excel Verilerini Buraya Yapıştırın
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
              placeholder="2    12         SPEHİRCİLİK VE RİSK ODAKLI...&#10;2    12    42   Diğer Afet İyileştirme Faaliyetleri&#10;2    54         MİLLİ SAVUNMA"
            />
            <p className="text-xs text-slate-500 mt-1">
              {importData.split('\n').filter(l => l.trim()).length} satır yapıştırıldı
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setImportModalOpen(false)}
            >
              İptal
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={!importData.trim()}
            >
              <Upload className="w-4 h-4 mr-2" />
              İçe Aktar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
