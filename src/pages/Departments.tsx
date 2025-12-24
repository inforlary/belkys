import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Building2, Edit2, Trash2, UserCircle, Plus, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { TURKISH_PROVINCES, MAHALLI_IDARE_TURLERI, getMahalliIdareTuruLabel } from '../utils/turkishProvinces';
import type { Department, Profile } from '../types/database';

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  manager_id: string;
  budget_institutional_code_id: string;
}

interface InstitutionalCode {
  id: string;
  tam_kod: string;
  kurum_adi: string;
  birim_adi: string | null;
  il_kodu: string;
  il_adi: string;
  mahalli_idare_turu: number;
  kurum_kodu: string;
  birim_kodu: string | null;
  aciklama?: string;
  level: number;
  parent_id: string | null;
  children?: InstitutionalCode[];
}

export function Departments() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'departments' | 'institutional-codes'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [institutionalCodes, setInstitutionalCodes] = useState<InstitutionalCode[]>([]);
  const [hierarchicalCodes, setHierarchicalCodes] = useState<InstitutionalCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIl, setFilterIl] = useState('');
  const [filterTur, setFilterTur] = useState('');

  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    code: '',
    description: '',
    manager_id: '',
    budget_institutional_code_id: '',
  });

  const [codeFormData, setCodeFormData] = useState({
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
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [deptsResponse, usersResponse, codesResponse] = await Promise.all([
        supabase
          .from('departments')
          .select('*, profiles!departments_manager_id_fkey(full_name), budget_institutional_codes(tam_kod, kurum_adi, birim_adi)')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        supabase
          .from('profiles')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .in('role', ['admin', 'manager'])
          .order('full_name'),
        supabase
          .from('budget_institutional_codes')
          .select('*')
          .eq('is_active', true)
          .eq('organization_id', profile.organization_id)
          .order('tam_kod'),
      ]);

      if (deptsResponse.data) setDepartments(deptsResponse.data);
      if (usersResponse.data) setUsers(usersResponse.data);
      if (codesResponse.data) {
        setInstitutionalCodes(codesResponse.data);
        buildHierarchy(codesResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildHierarchy(allCodes: InstitutionalCode[]) {
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user?.id)
        .single();

      if (formData.budget_institutional_code_id) {
        const { data: existingDept } = await supabase
          .from('departments')
          .select('id, name')
          .eq('budget_institutional_code_id', formData.budget_institutional_code_id)
          .neq('id', editingDept?.id || '00000000-0000-0000-0000-000000000000')
          .maybeSingle();

        if (existingDept) {
          alert(`Bu kurumsal kod zaten "${existingDept.name}" müdürlüğüne atanmış. Bir kurumsal kod sadece bir müdürlüğe atanabilir.`);
          return;
        }
      }

      if (editingDept) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: formData.name,
            code: formData.code,
            description: formData.description,
            manager_id: formData.manager_id || null,
            budget_institutional_code_id: formData.budget_institutional_code_id || null,
          })
          .eq('id', editingDept.id);

        if (error) {
          if (error.code === '23505' && error.message.includes('departments_budget_institutional_code_id_key')) {
            alert('Bu kurumsal kod zaten başka bir müdürlüğe atanmış. Bir kurumsal kod sadece bir müdürlüğe atanabilir.');
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('departments')
          .insert([
            {
              name: formData.name,
              code: formData.code,
              description: formData.description,
              manager_id: formData.manager_id || null,
              budget_institutional_code_id: formData.budget_institutional_code_id || null,
              organization_id: profile?.organization_id,
            },
          ]);

        if (error) {
          if (error.code === '23505' && error.message.includes('departments_budget_institutional_code_id_key')) {
            alert('Bu kurumsal kod zaten başka bir müdürlüğe atanmış. Bir kurumsal kod sadece bir müdürlüğe atanabilir.');
            return;
          }
          throw error;
        }
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.message || 'İşlem başarısız');
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.organization_id) return;

    let payload: any = {
      organization_id: profile.organization_id,
      created_by: profile.id,
      level: codeFormData.level,
      aciklama: codeFormData.aciklama,
    };

    if (codeFormData.level === 1) {
      const province = TURKISH_PROVINCES.find(p => p.kod === codeFormData.il_kodu);
      if (!province) {
        alert('İl seçimi gerekli');
        return;
      }
      payload = {
        ...payload,
        il_kodu: codeFormData.il_kodu,
        il_adi: province.ad,
        mahalli_idare_turu: codeFormData.mahalli_idare_turu,
        kurum_kodu: codeFormData.kurum_kodu,
        kurum_adi: codeFormData.kurum_adi,
        birim_kodu: null,
        birim_adi: null,
        parent_id: null,
      };
    } else {
      if (!codeFormData.parent_id) {
        alert('Üst kurum seçimi gerekli');
        return;
      }
      const parent = institutionalCodes.find(c => c.id === codeFormData.parent_id);
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
        birim_kodu: codeFormData.birim_kodu,
        birim_adi: codeFormData.birim_adi,
        parent_id: codeFormData.parent_id,
      };
    }

    try {
      if (editingCodeId) {
        const { error } = await supabase
          .from('budget_institutional_codes')
          .update(payload)
          .eq('id', editingCodeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('budget_institutional_codes')
          .insert(payload);
        if (error) throw error;
      }

      setShowCodeModal(false);
      resetCodeForm();
      loadData();
    } catch (error: any) {
      alert(error.message || 'İşlem başarısız');
    }
  }

  async function handleDelete(deptId: string) {
    if (!confirm('Bu müdürlüğü silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deptId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert(error.message || 'Silme işlemi başarısız');
    }
  }

  async function handleCodeDelete(id: string) {
    if (!confirm('Bu kodu silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('budget_institutional_codes')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert(error.message || 'Silme işlemi başarısız');
    }
  }

  function openEditModal(dept: Department) {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      manager_id: dept.manager_id || '',
      budget_institutional_code_id: (dept as any).budget_institutional_code_id || '',
    });
    setShowModal(true);
  }

  async function openCreateModal() {
    setEditingDept(null);
    resetForm();
    await loadData();
    setShowModal(true);
  }

  function openCodeModal() {
    resetCodeForm();
    setShowCodeModal(true);
  }

  function handleAddChild(parentId: string) {
    const parent = institutionalCodes.find(c => c.id === parentId);
    if (!parent) return;

    setAddingChildTo(parentId);
    resetCodeForm();
    setCodeFormData(prev => ({
      ...prev,
      level: 2,
      parent_id: parentId,
    }));
    setShowCodeModal(true);
  }

  function handleEditCode(code: InstitutionalCode) {
    setEditingCodeId(code.id);
    setCodeFormData({
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
    setShowCodeModal(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      code: '',
      description: '',
      manager_id: '',
      budget_institutional_code_id: '',
    });
  }

  function resetCodeForm() {
    setEditingCodeId(null);
    setAddingChildTo(null);
    setCodeFormData({
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
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  const filteredCodes = hierarchicalCodes.filter(c => {
    const matchSearch = searchTerm === '' ||
      c.tam_kod.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.kurum_adi.toLowerCase().includes(searchTerm.toLowerCase());
    const matchIl = filterIl === '' || c.il_kodu === filterIl;
    const matchTur = filterTur === '' || c.mahalli_idare_turu.toString() === filterTur;
    return matchSearch && matchIl && matchTur;
  });

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '';
    const parent = institutionalCodes.find(c => c.id === parentId);
    return parent ? `${parent.tam_kod} - ${parent.kurum_adi}` : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Müdürlük ve Kurumsal Kod Yönetimi</h1>
          <p className="mt-2 text-gray-600">Organizasyon birimlerini ve kurumsal kodları yönetin</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('departments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'departments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5 inline mr-2" />
            Müdürlükler
          </button>
          <button
            onClick={() => setActiveTab('institutional-codes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'institutional-codes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5 inline mr-2" />
            Kurumsal Kodlar
          </button>
        </nav>
      </div>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <>
          <div className="flex justify-end">
            <Button onClick={openCreateModal}>
              <Building2 className="w-5 h-5 mr-2" />
              Yeni Müdürlük
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <Card key={dept.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                      <p className="text-sm text-gray-500">Kod: {dept.code}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(dept)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {dept.description && (
                  <p className="mt-3 text-sm text-gray-600">{dept.description}</p>
                )}

                {(dept as any).profiles && (
                  <div className="mt-4 flex items-center text-sm text-gray-600">
                    <UserCircle className="w-4 h-4 mr-2" />
                    <span>Müdür: {(dept as any).profiles.full_name}</span>
                  </div>
                )}

                {!(dept as any).profiles && (
                  <div className="mt-4 text-sm text-gray-400 italic">
                    Müdür atanmamış
                  </div>
                )}

                {(dept as any).budget_institutional_codes && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-semibold">Kurumsal Kod:</span> {(dept as any).budget_institutional_codes.tam_kod}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Modal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              resetForm();
            }}
            title={editingDept ? 'Müdürlük Düzenle' : 'Yeni Müdürlük'}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Müdürlük Adı
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kod
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Müdür
                </label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurumsal Kod (Bütçe)
                </label>
                <select
                  value={formData.budget_institutional_code_id}
                  onChange={(e) => setFormData({ ...formData, budget_institutional_code_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz (Opsiyonel)</option>
                  {institutionalCodes
                    .filter(c => c.level === 2)
                    .filter(code => {
                      const isAssignedToOtherDept = departments.some(dept =>
                        dept.budget_institutional_code_id === code.id &&
                        dept.id !== editingDept?.id
                      );
                      const isCurrentlySelected = code.id === formData.budget_institutional_code_id;
                      return !isAssignedToOtherDept || isCurrentlySelected;
                    })
                    .map((code) => (
                      <option key={code.id} value={code.id}>
                        {code.tam_kod} - {code.kurum_adi} / {code.birim_adi}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Bu müdürlük gider fişi oluştururken otomatik olarak bu kod kullanılacak
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingDept ? 'Güncelle' : 'Oluştur'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  İptal
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* Institutional Codes Tab */}
      {activeTab === 'institutional-codes' && (
        <>
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className="relative flex-1">
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
              <Button onClick={openCodeModal}>
                <Plus className="w-4 h-4 mr-2" />
                Yeni Kurum Ekle
              </Button>
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
                          <button onClick={() => handleEditCode(parent)} className="text-blue-600 hover:text-blue-700">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleCodeDelete(parent.id)} className="text-red-600 hover:text-red-700">
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
                            <button onClick={() => handleEditCode(child)} className="text-blue-600 hover:text-blue-700">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleCodeDelete(child.id)} className="text-red-600 hover:text-red-700">
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
            isOpen={showCodeModal}
            onClose={() => { setShowCodeModal(false); resetCodeForm(); }}
            title={
              editingCodeId
                ? 'Kodu Düzenle'
                : addingChildTo
                  ? `Alt Birim Ekle: ${getParentName(addingChildTo)}`
                  : 'Yeni Kurum Ekle (1. Düzey)'
            }
          >
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              {!editingCodeId && !addingChildTo && (
                <div className="bg-blue-50 p-3 rounded text-sm">
                  <strong>1. Düzey:</strong> Önce kurumunuzu ekleyin (örn: 41116 Körfez Belediyesi)
                  <br />
                  <strong>2. Düzey:</strong> Sonra müdürlükleri alt birim olarak ekleyin
                </div>
              )}

              {codeFormData.level === 1 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">İl</label>
                      <select
                        required
                        value={codeFormData.il_kodu}
                        onChange={e => setCodeFormData({...codeFormData, il_kodu: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        disabled={editingCodeId !== null}
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
                        value={codeFormData.mahalli_idare_turu}
                        onChange={e => setCodeFormData({...codeFormData, mahalli_idare_turu: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded-lg"
                        disabled={editingCodeId !== null}
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
                        value={codeFormData.kurum_kodu}
                        onChange={e => setCodeFormData({...codeFormData, kurum_kodu: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="01"
                        disabled={editingCodeId !== null}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Kurum Adı</label>
                      <input
                        required
                        type="text"
                        value={codeFormData.kurum_adi}
                        onChange={e => setCodeFormData({...codeFormData, kurum_adi: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Körfez Belediyesi"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <strong>Üst Kurum:</strong> {getParentName(codeFormData.parent_id)}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Birim Kodu (00-99)</label>
                      <input
                        required
                        type="text"
                        pattern="\d{2}"
                        maxLength={2}
                        value={codeFormData.birim_kodu}
                        onChange={e => setCodeFormData({...codeFormData, birim_kodu: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="05"
                        disabled={editingCodeId !== null}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Birim Adı</label>
                      <input
                        required
                        type="text"
                        value={codeFormData.birim_adi}
                        onChange={e => setCodeFormData({...codeFormData, birim_adi: e.target.value})}
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
                  value={codeFormData.aciklama}
                  onChange={e => setCodeFormData({...codeFormData, aciklama: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ek bilgi..."
                />
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm">
                <strong>Önizleme Kod:</strong> {
                  codeFormData.level === 1
                    ? `${codeFormData.il_kodu}.${codeFormData.mahalli_idare_turu}.${codeFormData.kurum_kodu}`
                    : codeFormData.parent_id
                      ? `${institutionalCodes.find(c => c.id === codeFormData.parent_id)?.tam_kod}-${codeFormData.birim_kodu}`
                      : '-'
                }
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => { setShowCodeModal(false); resetCodeForm(); }}>İptal</Button>
                <Button type="submit">{editingCodeId ? 'Güncelle' : 'Ekle'}</Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
