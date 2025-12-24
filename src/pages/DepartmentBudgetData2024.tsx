import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Save, Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Building2, Upload, FileSpreadsheet } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface EconomicCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
}

interface BudgetDataEntry {
  id: string;
  code_id: string;
  amount: number;
  code?: EconomicCode;
}

export default function DepartmentBudgetData2024() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [expenseCodes, setExpenseCodes] = useState<EconomicCode[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<EconomicCode[]>([]);
  const [expenseData, setExpenseData] = useState<BudgetDataEntry[]>([]);
  const [revenueData, setRevenueData] = useState<BudgetDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'revenue'>('expense');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadDepartments();
      loadEconomicCodes();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedDepartment && expenseCodes.length > 0 && revenueCodes.length > 0) {
      loadBudgetData();
    }
  }, [selectedDepartment, expenseCodes, revenueCodes]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadEconomicCodes = async () => {
    try {
      const [expenseResult, revenueResult] = await Promise.all([
        supabase
          .from('expense_economic_codes')
          .select('id, code, name, full_code')
          .or(`organization_id.eq.${profile?.organization_id},organization_id.is.null`)
          .order('full_code'),
        supabase
          .from('revenue_economic_codes')
          .select('id, code, name, full_code')
          .or(`organization_id.eq.${profile?.organization_id},organization_id.is.null`)
          .order('full_code')
      ]);

      if (expenseResult.error) throw expenseResult.error;
      if (revenueResult.error) throw revenueResult.error;

      setExpenseCodes(expenseResult.data || []);
      setRevenueCodes(revenueResult.data || []);
    } catch (error) {
      console.error('Error loading economic codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBudgetData = async () => {
    if (!selectedDepartment) return;

    try {
      const { data: allData, error } = await supabase
        .from('department_budget_data_2024')
        .select('*')
        .eq('department_id', selectedDepartment.id)
        .eq('year', 2024);

      if (error) throw error;

      const expenseEntries = (allData || []).filter(d => d.type === 'expense');
      const revenueEntries = (allData || []).filter(d => d.type === 'revenue');

      const expenseWithCodes = await Promise.all(
        expenseEntries.map(async (entry) => {
          const code = expenseCodes.find(c => c.id === entry.code_id);
          return { ...entry, code };
        })
      );

      const revenueWithCodes = await Promise.all(
        revenueEntries.map(async (entry) => {
          const code = revenueCodes.find(c => c.id === entry.code_id);
          return { ...entry, code };
        })
      );

      setExpenseData(expenseWithCodes);
      setRevenueData(revenueWithCodes);
    } catch (error) {
      console.error('Error loading budget data:', error);
    }
  };

  const addExpenseRow = () => {
    setExpenseData([...expenseData, { id: `new_${Date.now()}`, code_id: '', amount: 0 }]);
  };

  const addRevenueRow = () => {
    setRevenueData([...revenueData, { id: `new_${Date.now()}`, code_id: '', amount: 0 }]);
  };

  const updateExpenseRow = (index: number, field: 'code_id' | 'amount', value: string | number) => {
    const updated = [...expenseData];
    updated[index] = { ...updated[index], [field]: value };
    setExpenseData(updated);
  };

  const updateRevenueRow = (index: number, field: 'code_id' | 'amount', value: string | number) => {
    const updated = [...revenueData];
    updated[index] = { ...updated[index], [field]: value };
    setRevenueData(updated);
  };

  const deleteExpenseRow = (index: number) => {
    setExpenseData(expenseData.filter((_, i) => i !== index));
  };

  const deleteRevenueRow = (index: number) => {
    setRevenueData(revenueData.filter((_, i) => i !== index));
  };

  const handlePasteData = () => {
    if (!pasteText.trim()) {
      alert('Lütfen yapıştırılacak veri girin!');
      return;
    }

    const lines = pasteText.trim().split('\n');
    const parsedData: BudgetDataEntry[] = [];
    const codes = activeTab === 'expense' ? expenseCodes : revenueCodes;

    let errorCount = 0;
    let successCount = 0;

    lines.forEach((line, index) => {
      if (index === 0 && (line.toLowerCase().includes('kod') || line.toLowerCase().includes('tutar'))) {
        return;
      }

      const parts = line.split('\t').length > 1 ? line.split('\t') : line.split(',');

      if (parts.length >= 2) {
        const codeStr = parts[0].trim();
        const amountStr = parts[1].trim().replace(/[^\d.,]/g, '').replace(',', '.');
        const amount = parseFloat(amountStr);

        if (!isNaN(amount) && amount > 0) {
          const matchedCode = codes.find(c =>
            c.full_code === codeStr ||
            c.code === codeStr ||
            c.full_code.includes(codeStr)
          );

          if (matchedCode) {
            parsedData.push({
              id: `new_${Date.now()}_${index}`,
              code_id: matchedCode.id,
              amount: amount,
              code: matchedCode
            });
            successCount++;
          } else {
            errorCount++;
            console.warn(`Ekonomik kod bulunamadı: ${codeStr}`);
          }
        }
      }
    });

    if (parsedData.length === 0) {
      alert('Geçerli veri bulunamadı! Lütfen formatı kontrol edin.\n\nBeklenen format:\nEkonomik Kod[TAB]Tutar\n01.01.01[TAB]5000');
      return;
    }

    if (activeTab === 'expense') {
      setExpenseData([...expenseData, ...parsedData]);
    } else {
      setRevenueData([...revenueData, ...parsedData]);
    }

    alert(`${successCount} kayıt eklendi${errorCount > 0 ? `, ${errorCount} kayıt hatalı` : ''}!`);
    setShowPasteModal(false);
    setPasteText('');
  };

  const handleSave = async () => {
    if (!selectedDepartment) return;

    setSaving(true);
    try {
      await supabase
        .from('department_budget_data_2024')
        .delete()
        .eq('department_id', selectedDepartment.id)
        .eq('year', 2024);

      const dataToInsert = [
        ...expenseData
          .filter(d => d.code_id && d.amount > 0)
          .map(d => ({
            department_id: selectedDepartment.id,
            year: 2024,
            type: 'expense',
            code_id: d.code_id,
            amount: Number(d.amount),
            organization_id: profile?.organization_id
          })),
        ...revenueData
          .filter(d => d.code_id && d.amount > 0)
          .map(d => ({
            department_id: selectedDepartment.id,
            year: 2024,
            type: 'revenue',
            code_id: d.code_id,
            amount: Number(d.amount),
            organization_id: profile?.organization_id
          }))
      ];

      if (dataToInsert.length > 0) {
        const { error } = await supabase
          .from('department_budget_data_2024')
          .insert(dataToInsert);

        if (error) throw error;
      }

      alert('Bütçe verileri başarıyla kaydedildi!');
      loadBudgetData();
    } catch (error) {
      console.error('Error saving budget data:', error);
      alert('Kayıt sırasında hata oluştu!');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardBody>
            <p className="text-red-600">Bu sayfaya erişim yetkiniz yok. Sadece yöneticiler bu sayfayı görüntüleyebilir.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  const calculateTotal = (data: BudgetDataEntry[]) => {
    return data.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Müdürlük Bütçe Verileri - 2024</h1>
          <p className="text-gray-600 mt-2">Müdürlükler için 2024 yılına ait ekonomik gider ve gelir verilerini yönetin</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Müdürlük Seçimi</h2>
          </div>
        </CardHeader>
        <CardBody>
          <select
            value={selectedDepartment?.id || ''}
            onChange={(e) => {
              const dept = departments.find(d => d.id === e.target.value);
              setSelectedDepartment(dept || null);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Müdürlük seçin...</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.code} - {dept.name}
              </option>
            ))}
          </select>
        </CardBody>
      </Card>

      {selectedDepartment && (
        <>
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('expense')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'expense'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Gider Verileri
              </div>
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'revenue'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Gelir Verileri
              </div>
            </button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {activeTab === 'expense' ? 'Ekonomik Gider Kodları' : 'Ekonomik Gelir Kodları'}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowPasteModal(true)}
                    icon={FileSpreadsheet}
                  >
                    Excel'den Yapıştır
                  </Button>
                  <Button
                    variant="primary"
                    onClick={activeTab === 'expense' ? addExpenseRow : addRevenueRow}
                    icon={Plus}
                  >
                    Satır Ekle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ekonomik Kod</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kod Adı</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Tutar (₺)</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === 'expense' ? expenseData : revenueData).map((row, index) => {
                      const codes = activeTab === 'expense' ? expenseCodes : revenueCodes;
                      const selectedCode = codes.find(c => c.id === row.code_id);

                      return (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <select
                              value={row.code_id}
                              onChange={(e) =>
                                activeTab === 'expense'
                                  ? updateExpenseRow(index, 'code_id', e.target.value)
                                  : updateRevenueRow(index, 'code_id', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Seçin...</option>
                              {codes.map((code) => (
                                <option key={code.id} value={code.id}>
                                  {code.full_code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {selectedCode?.name || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={row.amount || ''}
                              onChange={(e) =>
                                activeTab === 'expense'
                                  ? updateExpenseRow(index, 'amount', e.target.value)
                                  : updateRevenueRow(index, 'amount', e.target.value)
                              }
                              className="w-full px-3 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                activeTab === 'expense'
                                  ? deleteExpenseRow(index)
                                  : deleteRevenueRow(index)
                              }
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(activeTab === 'expense' ? expenseData : revenueData).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          Henüz veri eklenmedi. "Satır Ekle" butonuna tıklayarak başlayın.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {(activeTab === 'expense' ? expenseData : revenueData).length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={2} className="px-4 py-3 text-right">TOPLAM:</td>
                        <td className="px-4 py-3 text-right">
                          {calculateTotal(activeTab === 'expense' ? expenseData : revenueData).toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} ₺
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving}
                  icon={Save}
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Toplam Gider</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      {calculateTotal(expenseData).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} ₺
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Toplam Gelir</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {calculateTotal(revenueData).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} ₺
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Modal
        isOpen={showPasteModal}
        onClose={() => {
          setShowPasteModal(false);
          setPasteText('');
        }}
        title="Excel'den Veri Yapıştır"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Nasıl Kullanılır?</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Excel'de verilerinizi seçin (Ekonomik Kod ve Tutar sütunları)</li>
              <li>Kopyalayın (Ctrl+C veya Cmd+C)</li>
              <li>Aşağıdaki alana yapıştırın (Ctrl+V veya Cmd+V)</li>
              <li>"Yapıştır ve Ekle" butonuna tıklayın</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-700 font-mono">
                Örnek format:<br />
                01.01.01&nbsp;&nbsp;&nbsp;&nbsp;5000<br />
                01.02.01&nbsp;&nbsp;&nbsp;&nbsp;3000
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excel Verilerini Buraya Yapıştırın
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Excel'den kopyaladığınız verileri buraya yapıştırın..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {pasteText.trim().split('\n').filter(l => l.trim()).length} satır tespit edildi
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowPasteModal(false);
                setPasteText('');
              }}
            >
              İptal
            </Button>
            <Button
              variant="primary"
              onClick={handlePasteData}
              icon={Upload}
              disabled={!pasteText.trim()}
            >
              Yapıştır ve Ekle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
