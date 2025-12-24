import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TURKISH_PROVINCES, MAHALLI_IDARE_TURLERI, getMahalliIdareTuruLabel } from '../utils/turkishProvinces';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Search, Building2, ChevronRight, ChevronDown, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface InstitutionalCode {
  id: string;
  il_kodu: string;
  il_adi: string;
  mahalli_idare_turu: number;
  kurum_kodu: string;
  kurum_adi: string;
  birim_kodu: string | null;
  birim_adi: string | null;
  tam_kod: string;
  aciklama?: string;
  is_active: boolean;
  level: number;
  parent_id: string | null;
  children?: InstitutionalCode[];
}

export default function InstitutionalCodes() {
  const { profile } = useAuth();
  const [codes, setCodes] = useState<InstitutionalCode[]>([]);
  const [hierarchicalCodes, setHierarchicalCodes] = useState<InstitutionalCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIl, setFilterIl] = useState('');
  const [filterTur, setFilterTur] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const [formData, setFormData] = useState({
    il_kodu: '',
    mahalli_idare_turu: 1,
    kurum_kodu: '',
    kurum_adi: '',
    birim_kodu: '',
    birim_adi: '',
    aciklama: '',
    level: 1,
    parent_id: null as string | null,
  });

  useEffect(() => {
    if (profile?.organization_id) loadCodes();
  }, [profile]);

  const loadCodes = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('budget_institutional_codes')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('tam_kod');

    const allCodes = data || [];
    setCodes(allCodes);
    buildHierarchy(allCodes);
    setLoading(false);
  };

  const buildHierarchy = (allCodes: InstitutionalCode[]) => {
    const level1 = allCodes.filter(c => c.level === 1);
    const level2Map = new Map<string, InstitutionalCode[]>();

    allCodes.filter(c => c.level === 2).forEach(child => {
      if (child.parent_id) {
        if (!level2Map.has(child.parent_id)) {
          level2Map.set(child.parent_id, []);
        }
        level2Map.get(child.parent_id)!.push(child);
      }
    });

    const hierarchy = level1.map(parent => ({
      ...parent,
      children: level2Map.get(parent.id) || []
    }));

    setHierarchicalCodes(hierarchy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    let payload: any = {
      organization_id: profile.organization_id,
      created_by: profile.id,
      level: formData.level,
      aciklama: formData.aciklama,
    };

    if (formData.level === 1) {
      const province = TURKISH_PROVINCES.find(p => p.kod === formData.il_kodu);
      if (!province) {
        alert('İl seçimi gerekli');
        return;
      }
      payload = {
        ...payload,
        il_kodu: formData.il_kodu,
        il_adi: province.ad,
        mahalli_idare_turu: formData.mahalli_idare_turu,
        kurum_kodu: formData.kurum_kodu,
        kurum_adi: formData.kurum_adi,
        birim_kodu: null,
        birim_adi: null,
        parent_id: null,
      };
    } else {
      if (!formData.parent_id) {
        alert('Üst kurum seçimi gerekli');
        return;
      }
      const parent = codes.find(c => c.id === formData.parent_id);
      if (!parent) {
        alert('Üst kurum bulunamadı');
        return;
      }
      payload = {
        ...payload,
        il_kodu: parent.il_kodu,
        il_adi: parent.il_adi,
        mahalli_idare_turu: parent.mahalli_idare_turu,
        kurum_kodu: parent.kurum_kodu,
        kurum_adi: parent.kurum_adi,
        birim_kodu: formData.birim_kodu,
        birim_adi: formData.birim_adi,
        parent_id: formData.parent_id,
      };
    }

    if (editingId) {
      const { error } = await supabase
        .from('budget_institutional_codes')
        .update(payload)
        .eq('id', editingId);
      if (error) {
        alert('Güncelleme hatası: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('budget_institutional_codes')
        .insert(payload);
      if (error) {
        if (error.code === '23505') {
          alert('Bu kod kombinasyonu zaten mevcut!');
        } else {
          alert('Ekleme hatası: ' + error.message);
        }
        return;
      }
    }

    setModalOpen(false);
    resetForm();
    loadCodes();
  };

  const handleEdit = (code: InstitutionalCode) => {
    setEditingId(code.id);
    setFormData({
      il_kodu: code.il_kodu,
      mahalli_idare_turu: code.mahalli_idare_turu,
      kurum_kodu: code.kurum_kodu,
      kurum_adi: code.kurum_adi,
      birim_kodu: code.birim_kodu || '',
      birim_adi: code.birim_adi || '',
      aciklama: code.aciklama || '',
      level: code.level,
      parent_id: code.parent_id,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kodu silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase
      .from('budget_institutional_codes')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      alert('Silme hatası: ' + error.message);
    } else {
      loadCodes();
    }
  };

  const handleAddChild = (parentId: string) => {
    const parent = codes.find(c => c.id === parentId);
    if (!parent) return;

    setAddingChildTo(parentId);
    resetForm();
    setFormData(prev => ({
      ...prev,
      level: 2,
      parent_id: parentId,
    }));
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setAddingChildTo(null);
    setFormData({
      il_kodu: '',
      mahalli_idare_turu: 1,
      kurum_kodu: '',
      kurum_adi: '',
      birim_kodu: '',
      birim_adi: '',
      aciklama: '',
      level: 1,
      parent_id: null,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const downloadTemplate = () => {
    const template = [
      {
        'İl Kodu': '41',
        'Mahalli İdare Türü': '1',
        'Kurum Kodu': '16',
        'Kurum Adı': 'Körfez Belediyesi',
        'Birim Kodu': '',
        'Birim Adı': '',
        'Açıklama': 'Örnek kurum',
        'Düzey': '1'
      },
      {
        'İl Kodu': '41',
        'Mahalli İdare Türü': '1',
        'Kurum Kodu': '16',
        'Kurum Adı': 'Körfez Belediyesi',
        'Birim Kodu': '05',
        'Birim Adı': 'Yazı İşleri Müdürlüğü',
        'Açıklama': 'Örnek birim',
        'Düzey': '2'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
      { wch: 30 },
      { wch: 12 },
      { wch: 30 },
      { wch: 30 },
      { wch: 8 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kurumsal Kodlar');

    const infoSheet = XLSX.utils.aoa_to_sheet([
      ['KURUMSAL KODLAR İMPORT ŞABLONU'],
      [],
      ['AÇIKLAMALAR:'],
      ['1. İl Kodu: 2 haneli il plaka kodu (örn: 41)'],
      ['2. Mahalli İdare Türü: 1=Belediye, 2=İl Özel İdaresi, 3=Bağlı Kuruluş'],
      ['3. Kurum Kodu: 2 haneli kod (örn: 16)'],
      ['4. Kurum Adı: Kurumun tam adı'],
      ['5. Birim Kodu: 2. düzey için 2 haneli kod (1. düzey için boş bırakın)'],
      ['6. Birim Adı: 2. düzey için birim adı (1. düzey için boş bırakın)'],
      ['7. Açıklama: İsteğe bağlı ek bilgi'],
      ['8. Düzey: 1=Kurum, 2=Alt Birim'],
      [],
      ['ÖNEMLİ NOTLAR:'],
      ['- Önce 1. düzey (Kurum) kayıtları, sonra 2. düzey (Birim) kayıtları girilmelidir'],
      ['- 2. düzey kayıtlar için İl Kodu, Mahalli İdare Türü, Kurum Kodu ve Kurum Adı üst kurumla aynı olmalıdır'],
      ['- Tüm kodlar sayısal olmalıdır'],
      ['- Örnek satırları inceleyip, kendi verilerinizi girin']
    ]);
    XLSX.utils.book_append_sheet(wb, infoSheet, 'Bilgilendirme');

    XLSX.writeFile(wb, 'kurumsal_kodlar_sablonu.xlsx');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(false);
    setImportSuccess(false);
    setImportErrors([]);
    setImportData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const errors: string[] = [];
        const validData: any[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2;
          const ilKodu = String(row['İl Kodu'] || '').padStart(2, '0');
          const mahalliIdareTuru = parseInt(row['Mahalli İdare Türü']);
          const kurumKodu = String(row['Kurum Kodu'] || '').padStart(2, '0');
          const kurumAdi = String(row['Kurum Adı'] || '').trim();
          const birimKodu = row['Birim Kodu'] ? String(row['Birim Kodu']).padStart(2, '0') : '';
          const birimAdi = String(row['Birim Adı'] || '').trim();
          const aciklama = String(row['Açıklama'] || '').trim();
          const duzey = parseInt(row['Düzey']);

          if (!ilKodu || ilKodu.length !== 2 || isNaN(parseInt(ilKodu))) {
            errors.push(`Satır ${rowNum}: İl kodu geçersiz (2 haneli olmalı)`);
            return;
          }

          const province = TURKISH_PROVINCES.find(p => p.kod === ilKodu);
          if (!province) {
            errors.push(`Satır ${rowNum}: İl kodu bulunamadı (${ilKodu})`);
            return;
          }

          if (!mahalliIdareTuru || ![1, 2, 3].includes(mahalliIdareTuru)) {
            errors.push(`Satır ${rowNum}: Mahalli idare türü geçersiz (1, 2 veya 3 olmalı)`);
            return;
          }

          if (!kurumKodu || kurumKodu.length !== 2) {
            errors.push(`Satır ${rowNum}: Kurum kodu geçersiz (2 haneli olmalı)`);
            return;
          }

          if (!kurumAdi) {
            errors.push(`Satır ${rowNum}: Kurum adı boş olamaz`);
            return;
          }

          if (duzey !== 1 && duzey !== 2) {
            errors.push(`Satır ${rowNum}: Düzey 1 veya 2 olmalı`);
            return;
          }

          if (duzey === 2) {
            if (!birimKodu || birimKodu.length !== 2) {
              errors.push(`Satır ${rowNum}: 2. düzey için birim kodu gerekli (2 haneli)`);
              return;
            }
            if (!birimAdi) {
              errors.push(`Satır ${rowNum}: 2. düzey için birim adı gerekli`);
              return;
            }
          }

          validData.push({
            il_kodu: ilKodu,
            il_adi: province.ad,
            mahalli_idare_turu: mahalliIdareTuru,
            kurum_kodu: kurumKodu,
            kurum_adi: kurumAdi,
            birim_kodu: duzey === 2 ? birimKodu : null,
            birim_adi: duzey === 2 ? birimAdi : null,
            aciklama: aciklama || null,
            level: duzey
          });
        });

        setImportErrors(errors);
        setImportData(validData);
        setImportModalOpen(true);
      } catch (error) {
        alert('Excel dosyası okunamadı. Lütfen şablona uygun bir dosya yükleyin.');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const executeImport = async () => {
    if (!profile?.organization_id || importData.length === 0) return;

    setImporting(true);
    setImportSuccess(false);

    const level1Records = importData.filter(d => d.level === 1);
    const level2Records = importData.filter(d => d.level === 2);

    const insertedParents = new Map<string, string>();

    for (const record of level1Records) {
      const payload = {
        organization_id: profile.organization_id,
        created_by: profile.id,
        il_kodu: record.il_kodu,
        il_adi: record.il_adi,
        mahalli_idare_turu: record.mahalli_idare_turu,
        kurum_kodu: record.kurum_kodu,
        kurum_adi: record.kurum_adi,
        birim_kodu: null,
        birim_adi: null,
        aciklama: record.aciklama,
        level: 1,
        parent_id: null
      };

      const { data, error } = await supabase
        .from('budget_institutional_codes')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code !== '23505') {
          console.error('Import error:', error);
        }
      } else if (data) {
        const key = `${record.il_kodu}-${record.mahalli_idare_turu}-${record.kurum_kodu}`;
        insertedParents.set(key, data.id);
      }
    }

    for (const record of level2Records) {
      const key = `${record.il_kodu}-${record.mahalli_idare_turu}-${record.kurum_kodu}`;
      let parentId = insertedParents.get(key);

      if (!parentId) {
        const { data: existing } = await supabase
          .from('budget_institutional_codes')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('il_kodu', record.il_kodu)
          .eq('mahalli_idare_turu', record.mahalli_idare_turu)
          .eq('kurum_kodu', record.kurum_kodu)
          .eq('level', 1)
          .maybeSingle();

        if (existing) {
          parentId = existing.id;
        } else {
          continue;
        }
      }

      const payload = {
        organization_id: profile.organization_id,
        created_by: profile.id,
        il_kodu: record.il_kodu,
        il_adi: record.il_adi,
        mahalli_idare_turu: record.mahalli_idare_turu,
        kurum_kodu: record.kurum_kodu,
        kurum_adi: record.kurum_adi,
        birim_kodu: record.birim_kodu,
        birim_adi: record.birim_adi,
        aciklama: record.aciklama,
        level: 2,
        parent_id: parentId
      };

      await supabase
        .from('budget_institutional_codes')
        .insert(payload);
    }

    setImporting(false);
    setImportSuccess(true);

    setTimeout(() => {
      setImportModalOpen(false);
      setImportData([]);
      setImportErrors([]);
      setImportSuccess(false);
      loadCodes();
    }, 2000);
  };

  const filteredCodes = hierarchicalCodes.filter(c => {
    const matchSearch = searchTerm === '' ||
      c.tam_kod.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.kurum_adi.toLowerCase().includes(searchTerm.toLowerCase());
    const matchIl = filterIl === '' || c.il_kodu === filterIl;
    const matchTur = filterTur === '' || c.mahalli_idare_turu.toString() === filterTur;
    return matchSearch && matchIl && matchTur;
  });

  if (loading) return <div className="p-6">Yükleniyor...</div>;

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '';
    const parent = codes.find(c => c.id === parentId);
    return parent ? `${parent.tam_kod} - ${parent.kurum_adi}` : '';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kurumsal Kodlar</h1>
            <p className="text-sm text-gray-600">Mahalli İdare Bütçe Kurumsal Sınıflandırma (Hiyerarşik)</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Excel Şablonu İndir
          </Button>
          <label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" className="cursor-pointer" onClick={(e) => {
              e.preventDefault();
              (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
            }}>
              <Upload className="w-4 h-4 mr-2" />
              Excel İle İçe Aktar
            </Button>
          </label>
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kurum Ekle
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Kod veya kurum ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select value={filterIl} onChange={e => setFilterIl(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">Tüm İller</option>
            {TURKISH_PROVINCES.map(p => (
              <option key={p.kod} value={p.kod}>{p.ad}</option>
            ))}
          </select>
          <select value={filterTur} onChange={e => setFilterTur(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">Tüm Türler</option>
            {MAHALLI_IDARE_TURLERI.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-12"></th>
                <th className="px-4 py-3 text-left font-medium">Tam Kod</th>
                <th className="px-4 py-3 text-left font-medium">İl</th>
                <th className="px-4 py-3 text-left font-medium">Tür</th>
                <th className="px-4 py-3 text-left font-medium">Kurum / Birim</th>
                <th className="px-4 py-3 text-left font-medium">Açıklama</th>
                <th className="px-4 py-3 text-right font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCodes.map(parent => (
                <>
                  <tr key={parent.id} className="hover:bg-gray-50 bg-blue-50">
                    <td className="px-4 py-3">
                      {parent.children && parent.children.length > 0 && (
                        <button onClick={() => toggleExpand(parent.id)} className="text-gray-600 hover:text-gray-900">
                          {expandedIds.has(parent.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">{parent.tam_kod}</td>
                    <td className="px-4 py-3">{parent.il_adi}</td>
                    <td className="px-4 py-3 text-xs">{getMahalliIdareTuruLabel(parent.mahalli_idare_turu)}</td>
                    <td className="px-4 py-3 font-semibold">{parent.kurum_adi}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{parent.aciklama || '-'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => handleAddChild(parent.id)} className="text-green-600 hover:text-green-700" title="Alt Birim Ekle">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(parent)} className="text-blue-600 hover:text-blue-700">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(parent.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedIds.has(parent.id) && parent.children?.map(child => (
                    <tr key={child.id} className="hover:bg-gray-50 bg-gray-50">
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 font-mono text-gray-700 pl-8">{child.tam_kod}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{child.il_adi}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{getMahalliIdareTuruLabel(child.mahalli_idare_turu)}</td>
                      <td className="px-4 py-3 pl-8 text-gray-700">{child.birim_adi}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{child.aciklama || '-'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEdit(child)} className="text-blue-600 hover:text-blue-700">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(child.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
          {filteredCodes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Kayıt bulunamadı
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          if (!importing) {
            setImportModalOpen(false);
            setImportData([]);
            setImportErrors([]);
            setImportSuccess(false);
          }
        }}
        title="Excel İçe Aktar"
      >
        <div className="space-y-4">
          {importSuccess ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">İçe Aktarma Başarılı!</h3>
                <p className="text-gray-600">{importData.length} kayıt başarıyla eklendi.</p>
              </div>
            </div>
          ) : (
            <>
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-2">Hatalar Bulundu:</h4>
                      <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                        {importErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {importData.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">
                      İçe Aktarılacak Kayıtlar: {importData.length}
                    </h4>
                  </div>
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Tam Kod</th>
                          <th className="px-2 py-1 text-left">Kurum / Birim</th>
                          <th className="px-2 py-1 text-left">Düzey</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importData.map((record, idx) => (
                          <tr key={idx} className="hover:bg-blue-100">
                            <td className="px-2 py-1 font-mono">
                              {record.level === 1
                                ? `${record.il_kodu}.${record.mahalli_idare_turu}.${record.kurum_kodu}`
                                : `${record.il_kodu}.${record.mahalli_idare_turu}.${record.kurum_kodu}-${record.birim_kodu}`
                              }
                            </td>
                            <td className="px-2 py-1">
                              {record.level === 1 ? record.kurum_adi : record.birim_adi}
                            </td>
                            <td className="px-2 py-1">{record.level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportData([]);
                    setImportErrors([]);
                  }}
                  disabled={importing}
                >
                  İptal
                </Button>
                <Button
                  onClick={executeImport}
                  disabled={importing || importData.length === 0}
                >
                  {importing ? 'İçe Aktarılıyor...' : `${importData.length} Kaydı İçe Aktar`}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={
          editingId
            ? 'Kodu Düzenle'
            : addingChildTo
              ? `Alt Birim Ekle: ${getParentName(addingChildTo)}`
              : 'Yeni Kurum Ekle (1. Düzey)'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingId && !addingChildTo && (
            <div className="bg-blue-50 p-3 rounded text-sm">
              <strong>1. Düzey:</strong> Önce kurumunuzu ekleyin (örn: 41116 Körfez Belediyesi)
              <br />
              <strong>2. Düzey:</strong> Sonra müdürlükleri alt birim olarak ekleyin
            </div>
          )}

          {formData.level === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">İl</label>
                  <select
                    required
                    value={formData.il_kodu}
                    onChange={e => setFormData({...formData, il_kodu: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={editingId !== null}
                  >
                    <option value="">Seçiniz</option>
                    {TURKISH_PROVINCES.map(p => (
                      <option key={p.kod} value={p.kod}>{p.ad}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mahalli İdare Türü</label>
                  <select
                    required
                    value={formData.mahalli_idare_turu}
                    onChange={e => setFormData({...formData, mahalli_idare_turu: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={editingId !== null}
                  >
                    {MAHALLI_IDARE_TURLERI.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Kurum Kodu (00-99)</label>
                  <input
                    required
                    type="text"
                    pattern="\d{2}"
                    maxLength={2}
                    value={formData.kurum_kodu}
                    onChange={e => setFormData({...formData, kurum_kodu: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="01"
                    disabled={editingId !== null}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kurum Adı</label>
                  <input
                    required
                    type="text"
                    value={formData.kurum_adi}
                    onChange={e => setFormData({...formData, kurum_adi: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Körfez Belediyesi"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <strong>Üst Kurum:</strong> {getParentName(formData.parent_id)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Birim Kodu (00-99)</label>
                  <input
                    required
                    type="text"
                    pattern="\d{2}"
                    maxLength={2}
                    value={formData.birim_kodu}
                    onChange={e => setFormData({...formData, birim_kodu: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="05"
                    disabled={editingId !== null}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Birim Adı</label>
                  <input
                    required
                    type="text"
                    value={formData.birim_adi}
                    onChange={e => setFormData({...formData, birim_adi: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Yazı İşleri Müdürlüğü"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Açıklama (Opsiyonel)</label>
            <textarea
              value={formData.aciklama}
              onChange={e => setFormData({...formData, aciklama: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ek bilgi..."
            />
          </div>

          <div className="bg-blue-50 p-3 rounded text-sm">
            <strong>Önizleme Kod:</strong> {
              formData.level === 1
                ? `${formData.il_kodu}.${formData.mahalli_idare_turu}.${formData.kurum_kodu}`
                : formData.parent_id
                  ? `${codes.find(c => c.id === formData.parent_id)?.tam_kod}-${formData.birim_kodu}`
                  : '-'
            }
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>İptal</Button>
            <Button type="submit">{editingId ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
