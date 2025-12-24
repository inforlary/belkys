import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, X, Save, ChevronRight, ChevronDown, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface ExpenseCode {
  id: string;
  level: number;
  code: string;
  name: string;
  parent_id: string | null;
  full_code: string;
  is_active: boolean;
  children?: ExpenseCode[];
}

export default function StandardExpenseCodesManager() {
  const [codes, setCodes] = useState<ExpenseCode[]>([]);
  const [allCodes, setAllCodes] = useState<ExpenseCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseCode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [formData, setFormData] = useState({
    level: 1,
    code: '',
    name: '',
    parent_id: null as string | null,
    is_active: true,
  });

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expense_economic_codes')
        .select('*')
        .is('organization_id', null)
        .order('full_code');

      if (error) throw error;

      setAllCodes(data || []);
      const tree = buildTree(data || []);
      setCodes(tree);
    } catch (error) {
      console.error('Gider kodları yüklenirken hata:', error);
      alert('Gider kodları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (items: ExpenseCode[]): ExpenseCode[] => {
    const map = new Map<string, ExpenseCode>();
    const roots: ExpenseCode[] = [];

    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id) {
        const parent = map.get(item.parent_id);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleAdd = (parentCode?: ExpenseCode) => {
    setEditingItem(null);
    setFormData({
      level: parentCode ? parentCode.level + 1 : 1,
      code: '',
      name: '',
      parent_id: parentCode?.id || null,
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (item: ExpenseCode) => {
    setEditingItem(item);
    setFormData({
      level: item.level,
      code: item.code,
      name: item.name,
      parent_id: item.parent_id,
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('Kod ve isim alanları zorunludur');
      return;
    }

    if (formData.level < 1 || formData.level > 4) {
      alert('Seviye 1 ile 4 arasında olmalıdır');
      return;
    }

    try {
      let fullCode = formData.code;
      if (formData.parent_id) {
        const parent = allCodes.find(c => c.id === formData.parent_id);
        if (parent) {
          fullCode = `${parent.full_code}-${formData.code}`;
        }
      }

      if (editingItem) {
        const { error } = await supabase
          .from('expense_economic_codes')
          .update({
            code: formData.code,
            name: formData.name,
            full_code: fullCode,
            is_active: formData.is_active,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expense_economic_codes')
          .insert({
            organization_id: null,
            level: formData.level,
            code: formData.code,
            name: formData.name,
            parent_id: formData.parent_id,
            full_code: fullCode,
            is_active: formData.is_active,
          });

        if (error) throw error;
      }

      setShowModal(false);
      loadCodes();
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Kayıt başarısız: ' + (error.message || ''));
    }
  };

  const handleDelete = async (item: ExpenseCode) => {
    if (!confirm(`"${item.name}" kodunu silmek istediğinizden emin misiniz? Alt kodlar da silinecektir.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_economic_codes')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      loadCodes();
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + (error.message || ''));
    }
  };

  const handleImportPaste = async () => {
    if (!pastedData.trim()) {
      alert('Lütfen veri yapıştırın!');
      return;
    }

    try {
      setImporting(true);
      const lines = pastedData.trim().split('\n');

      let successCount = 0;
      let errorCount = 0;

      for (const line of lines) {
        try {
          const columns = line.split('\t');

          if (columns.length < 5) {
            errorCount++;
            continue;
          }

          const level1 = columns[0] ? columns[0].trim() : '';
          const level2 = columns[1] ? columns[1].trim() : '';
          const level3 = columns[2] ? columns[2].trim() : '';
          const level4 = columns[3] ? columns[3].trim() : '';
          const name = columns[4] ? columns[4].trim() : '';

          if (!level1 || !name) {
            errorCount++;
            continue;
          }

          let level = 1;
          let code = level1;
          let fullCode = level1;
          let parentFullCode = '';

          if (level4) {
            level = 4;
            code = level4;
            parentFullCode = `${level1}.${level2}.${level3}`;
            fullCode = `${level1}.${level2}.${level3}.${level4}`;
          } else if (level3) {
            level = 3;
            code = level3;
            parentFullCode = `${level1}.${level2}`;
            fullCode = `${level1}.${level2}.${level3}`;
          } else if (level2) {
            level = 2;
            code = level2;
            parentFullCode = level1;
            fullCode = `${level1}.${level2}`;
          }

          let parentId = null;
          if (parentFullCode) {
            const parent = allCodes.find(c => c.full_code === parentFullCode);
            if (parent) {
              parentId = parent.id;
            }
          }

          const { error } = await supabase
            .from('expense_economic_codes')
            .insert({
              organization_id: null,
              level,
              code,
              name,
              parent_id: parentId,
              full_code: fullCode,
              is_active: true,
            });

          if (error) {
            console.error('Kayıt hatası:', error);
            errorCount++;
          } else {
            successCount++;
          }

          await loadCodes();
        } catch (err) {
          console.error('Satır işleme hatası:', err);
          errorCount++;
        }
      }

      alert(`İçe aktarma tamamlandı!\nBaşarılı: ${successCount}\nHatalı: ${errorCount}`);
      setShowImportModal(false);
      setPastedData('');
      loadCodes();
    } catch (error: any) {
      console.error('Veri işleme hatası:', error);
      alert('Veri işlenemedi: ' + (error.message || ''));
    } finally {
      setImporting(false);
    }
  };

  const renderTree = (items: ExpenseCode[], level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedNodes.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      return (
        <div key={item.id}>
          <div
            className={`flex items-center justify-between p-3 hover:bg-gray-50 border-b ${
              level > 0 ? 'ml-' + (level * 8) : ''
            }`}
            style={{ marginLeft: level * 32 }}
          >
            <div className="flex items-center gap-3 flex-1">
              {hasChildren ? (
                <button
                  onClick={() => toggleNode(item.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    {item.full_code}
                  </span>
                  <span className="text-sm text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-500">Seviye {item.level}</span>
                  {item.is_active ? (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Aktif
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      Pasif
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.level < 4 && (
                <button
                  onClick={() => handleAdd(item)}
                  className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded"
                  title="Alt Kod Ekle"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleEdit(item)}
                className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                title="Düzenle"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(item)}
                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                title="Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderTree(item.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Standart Gider Ekonomik Kodları</h3>
          <p className="text-sm text-gray-600 mt-1">
            Tüm belediyeler için geçerli olan gider ekonomik kodları (Seviye I-IV)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowImportModal(true)}
            variant="outline"
            className="flex items-center gap-2 border-green-500 text-green-700 hover:bg-green-50"
          >
            <Upload className="w-4 h-4" />
            Excel'den Yapıştır
          </Button>
          <Button onClick={() => handleAdd()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yeni Seviye I Kodu Ekle
          </Button>
        </div>
      </div>

      {codes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600 font-medium">Henüz kod eklenmemiş</p>
          <Button onClick={() => handleAdd()} className="mt-4 flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" />
            İlk Kodu Ekle
          </Button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {renderTree(codes)}
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingItem ? 'Gider Kodu Düzenle' : `Yeni Seviye ${formData.level} Kodu Ekle`}
        >
          <div className="space-y-4">
            {formData.parent_id && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Üst Kod:</strong>{' '}
                  {allCodes.find(c => c.id === formData.parent_id)?.full_code} -{' '}
                  {allCodes.find(c => c.id === formData.parent_id)?.name}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kod <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: 01, 02, 03"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.parent_id
                  ? `Tam kod: ${allCodes.find(c => c.id === formData.parent_id)?.full_code}-${formData.code || '??'}`
                  : `Tam kod: ${formData.code || '??'}`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İsim <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Kod açıklaması"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Aktif
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setPastedData('');
          }}
          title="Excel'den Veri Yapıştır"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">Nasıl Kullanılır:</p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Excel dosyanızı açın (Ekonomik Kod ve Tutar sütunları)</li>
                <li>Verileri seçin (başlık satırı olmadan)</li>
                <li>Kopyalayın (Ctrl+C veya Cmd+C)</li>
                <li>Aşağıdaki alana yapıştırın (Ctrl+V veya Cmd+V)</li>
              </ol>
              <p className="text-xs text-blue-700 mt-3 font-medium">Örnek Format:</p>
              <div className="bg-white border border-blue-300 rounded p-2 mt-1 font-mono text-xs text-gray-800">
                <div>01&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Personel Giderleri</div>
                <div>01&nbsp;&nbsp;01&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Memurlar</div>
                <div>01&nbsp;&nbsp;01&nbsp;&nbsp;10&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Temel Maaşlar</div>
                <div>01&nbsp;&nbsp;01&nbsp;&nbsp;10&nbsp;&nbsp;01&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Temel Maaşlar</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel Verisi
              </label>
              <textarea
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Excel'den kopyaladığınız veriyi buraya yapıştırın..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {pastedData.trim() ? `${pastedData.trim().split('\n').length} satır` : 'Veri bekleniyor...'}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setPastedData('');
                }}
              >
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleImportPaste} disabled={importing || !pastedData.trim()}>
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
