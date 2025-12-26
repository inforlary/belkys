import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  AlertCircle,
  Building,
  List,
  Plus,
  Check,
  Edit3,
  RotateCcw,
  Calendar
} from 'lucide-react';
import { useBudgetPeriod } from '../hooks/useBudgetPeriod';

interface Department {
  id: string;
  name: string;
  code: string;
  organization_id: string;
}

interface Activity {
  id: string;
  activity_code: string;
  activity_name: string;
  sub_program_id: string;
  sub_program?: {
    id: string;
    code: string;
    name: string;
    full_code: string;
    program_id: string;
  };
  program?: {
    id: string;
    code: string;
    name: string;
  };
}

interface EconomicCode {
  id: string;
  full_code: string;
  name: string;
  level: number;
}

interface BudgetItem {
  economic_code_id: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
  increase_rate_2027: number;
  increase_rate_2028: number;
  manual_2027?: boolean;
  manual_2028?: boolean;
}

interface Justification {
  id: string;
  department_id: string;
  organization_id: string;
  activity_id: string;
  legal_basis: string;
  justification: string;
  cost_elements: string;
  budget_needs: any;
  status: 'draft' | 'submitted_to_vp' | 'vp_approved' | 'submitted_to_admin' | 'admin_approved' | 'rejected';
  fiscal_year: number;
}

export default function BudgetPerformanceJustification() {
  const { profile } = useAuth();
  const { currentPeriod, constraints, loading: periodLoading, canCreate, getCurrentFiscalYear } = useBudgetPeriod();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [economicCodes, setEconomicCodes] = useState<EconomicCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [codesLoading, setCodesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null);
  const [economicCodeSearch, setEconomicCodeSearch] = useState<{ [key: string]: string }>({});
  const [showBulkAddModal, setShowBulkAddModal] = useState<string | null>(null);
  const [bulkAddSearch, setBulkAddSearch] = useState('');
  const [selectedCodesForBulk, setSelectedCodesForBulk] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{activityId: string, index: number} | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number>(2026);

  const [formData, setFormData] = useState<{ [key: string]: {
    legal_basis: string;
    justification: string;
    cost_elements: string;
    budget_items: BudgetItem[];
    global_increase_rate_2027: number;
    global_increase_rate_2028: number;
  } }>({});

  useEffect(() => {
    if (profile?.organization_id) {
      loadInitialData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (currentPeriod) {
      setFiscalYear(currentPeriod.budget_year);
    }
  }, [currentPeriod]);

  useEffect(() => {
    if (selectedDepartment && currentPeriod) {
      loadActivities();
      loadJustifications();
    }
  }, [selectedDepartment, currentPeriod]);

  const loadInitialData = async () => {
    setCodesLoading(true);
    try {
      await Promise.all([
        loadDepartments(),
        loadEconomicCodes()
      ]);
    } finally {
      setCodesLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      let query = supabase
        .from('departments')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .order('name');

      if (profile?.role === 'user' && profile?.department_id) {
        query = query.eq('id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setDepartments(data || []);

      if (data && data.length === 1) {
        setSelectedDepartment(data[0]);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadEconomicCodes = async () => {
    try {
      const { data: globalCodes, error: globalError } = await supabase
        .from('expense_economic_codes')
        .select('id, full_code, name, level')
        .eq('level', 4)
        .is('organization_id', null)
        .order('full_code');

      if (globalError) throw globalError;

      let allCodes = [...(globalCodes || [])];

      if (profile?.organization_id) {
        const { data: orgCodes, error: orgError } = await supabase
          .from('expense_economic_codes')
          .select('id, full_code, name, level')
          .eq('level', 4)
          .eq('organization_id', profile.organization_id)
          .order('full_code');

        if (!orgError && orgCodes) {
          allCodes = [...allCodes, ...orgCodes];
        }
      }

      setEconomicCodes(allCodes);
    } catch (error) {
      console.error('Error loading economic codes:', error);
    }
  };


  const loadActivities = async () => {
    if (!selectedDepartment) return;

    const fiscalYear = getCurrentFiscalYear();
    if (!fiscalYear) return;

    setLoading(true);
    try {
      const { data: mappings, error: mappingsError } = await supabase
        .from('program_activity_indicator_mappings')
        .select('activity_id')
        .eq('organization_id', profile!.organization_id)
        .eq('department_id', selectedDepartment.id)
        .eq('fiscal_year', fiscalYear)
        .eq('is_active', true);

      if (mappingsError) throw mappingsError;

      if (!mappings || mappings.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const activityIds = [...new Set(mappings.map(m => m.activity_id))];

      const { data: activitiesData, error: activitiesError } = await supabase
        .from('sub_program_activities')
        .select(`
          *,
          sub_program:sub_programs(
            id,
            code,
            name,
            full_code,
            program_id,
            program:programs(
              id,
              code,
              name
            )
          )
        `)
        .in('id', activityIds)
        .eq('is_active', true)
        .order('activity_code');

      if (activitiesError) throw activitiesError;

      const processedActivities = (activitiesData || []).map(activity => ({
        ...activity,
        program: activity.sub_program?.program,
      }));

      setActivities(processedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJustifications = async () => {
    if (!selectedDepartment) return;

    const fiscalYear = getCurrentFiscalYear();
    if (!fiscalYear) return;

    try {
      const { data, error } = await supabase
        .from('activity_justifications')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .eq('department_id', selectedDepartment.id)
        .eq('fiscal_year', fiscalYear);

      if (error) throw error;

      setJustifications(data || []);

      const initialFormData: any = {};
      (data || []).forEach(j => {
        initialFormData[j.activity_id] = {
          legal_basis: j.legal_basis || '',
          justification: j.justification || '',
          cost_elements: j.cost_elements || '',
          budget_items: j.budget_needs?.items || [],
          global_increase_rate_2027: j.budget_needs?.global_increase_rate_2027 || 0,
          global_increase_rate_2028: j.budget_needs?.global_increase_rate_2028 || 0
        };
      });
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error loading justifications:', error);
    }
  };

  const handleActivityToggle = (activityId: string) => {
    if (expandedActivity === activityId) {
      setExpandedActivity(null);
    } else {
      setExpandedActivity(activityId);
      if (!formData[activityId]) {
        setFormData({
          ...formData,
          [activityId]: {
            legal_basis: '',
            justification: '',
            cost_elements: '',
            budget_items: [],
            global_increase_rate_2027: 0,
            global_increase_rate_2028: 0
          }
        });
      }
    }
  };

  const handleFormChange = (activityId: string, field: string, value: any) => {
    setFormData({
      ...formData,
      [activityId]: {
        ...formData[activityId],
        [field]: value
      }
    });
  };

  const handleAddBudgetItem = (activityId: string) => {
    const currentItems = formData[activityId]?.budget_items || [];
    const globalRate2027 = formData[activityId]?.global_increase_rate_2027 || 0;
    const globalRate2028 = formData[activityId]?.global_increase_rate_2028 || 0;

    setFormData({
      ...formData,
      [activityId]: {
        ...formData[activityId],
        budget_items: [
          ...currentItems,
          {
            economic_code_id: '',
            amount_2026: 0,
            amount_2027: 0,
            amount_2028: 0,
            increase_rate_2027: globalRate2027,
            increase_rate_2028: globalRate2028
          }
        ]
      }
    });
  };

  const handleBulkAddCodes = (activityId: string) => {
    const currentItems = formData[activityId]?.budget_items || [];
    const globalRate2027 = formData[activityId]?.global_increase_rate_2027 || 0;
    const globalRate2028 = formData[activityId]?.global_increase_rate_2028 || 0;
    const existingCodeIds = new Set(currentItems.map(item => item.economic_code_id));

    const newItems = Array.from(selectedCodesForBulk)
      .filter(codeId => !existingCodeIds.has(codeId))
      .map(codeId => ({
        economic_code_id: codeId,
        amount_2026: 0,
        amount_2027: 0,
        amount_2028: 0,
        increase_rate_2027: globalRate2027,
        increase_rate_2028: globalRate2028
      }));

    setFormData({
      ...formData,
      [activityId]: {
        ...formData[activityId],
        budget_items: [...currentItems, ...newItems]
      }
    });

    setShowBulkAddModal(null);
    setSelectedCodesForBulk(new Set());
    setBulkAddSearch('');
  };

  const toggleCodeSelection = (codeId: string) => {
    const newSelected = new Set(selectedCodesForBulk);
    if (newSelected.has(codeId)) {
      newSelected.delete(codeId);
    } else {
      newSelected.add(codeId);
    }
    setSelectedCodesForBulk(newSelected);
  };

  const handleRemoveBudgetItem = (activityId: string, index: number) => {
    const currentItems = formData[activityId]?.budget_items || [];
    setFormData({
      ...formData,
      [activityId]: {
        ...formData[activityId],
        budget_items: currentItems.filter((_, i) => i !== index)
      }
    });
  };

  const handleBudgetItemChange = (activityId: string, index: number, field: string, value: any) => {
    const currentItems = [...(formData[activityId]?.budget_items || [])];
    const currentItem = { ...currentItems[index], [field]: value };

    if (field === 'amount_2026') {
      const baseAmount = parseFloat(value) || 0;
      const globalRate2027 = formData[activityId]?.global_increase_rate_2027 || 0;
      const globalRate2028 = formData[activityId]?.global_increase_rate_2028 || 0;

      if (!currentItem.manual_2027) {
        currentItem.amount_2027 = baseAmount * (1 + globalRate2027 / 100);
      }
      if (!currentItem.manual_2028 && !currentItem.manual_2027) {
        currentItem.amount_2028 = currentItem.amount_2027 * (1 + globalRate2028 / 100);
      } else if (!currentItem.manual_2028 && currentItem.manual_2027) {
        currentItem.amount_2028 = currentItem.amount_2027 * (1 + globalRate2028 / 100);
      }
    }

    if (field === 'amount_2027') {
      currentItem.manual_2027 = true;
      const amount2027 = parseFloat(value) || 0;
      currentItem.amount_2027 = amount2027;

      if (!currentItem.manual_2028) {
        const globalRate2028 = formData[activityId]?.global_increase_rate_2028 || 0;
        currentItem.amount_2028 = amount2027 * (1 + globalRate2028 / 100);
      }
    }

    if (field === 'amount_2028') {
      currentItem.manual_2028 = true;
      currentItem.amount_2028 = parseFloat(value) || 0;
    }

    currentItems[index] = currentItem;
    setFormData({
      ...formData,
      [activityId]: {
        ...formData[activityId],
        budget_items: currentItems
      }
    });
  };

  const resetToAutoCalculation = (activityId: string, index: number, year: 2027 | 2028) => {
    const currentItems = [...(formData[activityId]?.budget_items || [])];
    const currentItem = { ...currentItems[index] };

    if (year === 2027) {
      currentItem.manual_2027 = false;
      const baseAmount = currentItem.amount_2026;
      const globalRate2027 = formData[activityId]?.global_increase_rate_2027 || 0;
      currentItem.amount_2027 = baseAmount * (1 + globalRate2027 / 100);

      if (!currentItem.manual_2028) {
        const globalRate2028 = formData[activityId]?.global_increase_rate_2028 || 0;
        currentItem.amount_2028 = currentItem.amount_2027 * (1 + globalRate2028 / 100);
      }
    } else {
      currentItem.manual_2028 = false;
      const baseAmount = currentItem.amount_2027;
      const globalRate2028 = formData[activityId]?.global_increase_rate_2028 || 0;
      currentItem.amount_2028 = baseAmount * (1 + globalRate2028 / 100);
    }

    currentItems[index] = currentItem;
    setFormData({
      ...formData,
      [activityId]: {
        ...formData[activityId],
        budget_items: currentItems
      }
    });
  };

  const handleGlobalIncreaseRateChange = (activityId: string, field: 'global_increase_rate_2027' | 'global_increase_rate_2028', value: number) => {
    const updatedFormData = { ...formData };
    updatedFormData[activityId] = {
      ...updatedFormData[activityId],
      [field]: value
    };

    const rate2027 = field === 'global_increase_rate_2027' ? value : updatedFormData[activityId].global_increase_rate_2027;
    const rate2028 = field === 'global_increase_rate_2028' ? value : updatedFormData[activityId].global_increase_rate_2028;

    updatedFormData[activityId].budget_items = updatedFormData[activityId].budget_items.map(item => {
      const amount2027 = item.amount_2026 * (1 + rate2027 / 100);
      const amount2028 = amount2027 * (1 + rate2028 / 100);
      return {
        ...item,
        amount_2027: amount2027,
        amount_2028: amount2028
      };
    });

    setFormData(updatedFormData);
  };

  const handleSave = async (activity: Activity, isDraft: boolean) => {
    if (!canCreate()) {
      alert('Şu anda veri girişi yapılamaz. Lütfen dönem durumunu kontrol edin.');
      return;
    }

    const fiscalYear = getCurrentFiscalYear();
    if (!fiscalYear) {
      alert('Aktif bütçe dönemi bulunamadı');
      return;
    }

    setSavingActivityId(activity.id);
    try {
      const data = formData[activity.id];

      if (!data || !data.legal_basis || !data.justification || !data.cost_elements) {
        alert('Lütfen tüm alanları doldurun.');
        return;
      }

      if (!data.budget_items || data.budget_items.length === 0) {
        alert('En az bir bütçe kalemi ekleyin.');
        return;
      }

      const invalidItems = data.budget_items.filter(
        item => !item.economic_code_id || !item.amount_2026 || item.amount_2026 <= 0
      );

      if (invalidItems.length > 0) {
        alert('Tüm bütçe kalemlerini eksiksiz doldurun ve 2026 yılı tutarı giriniz.');
        return;
      }

      const existingJustification = justifications.find(j => j.activity_id === activity.id);

      const justificationData = {
        organization_id: profile!.organization_id,
        department_id: selectedDepartment!.id,
        program_id: activity.sub_program?.program_id,
        sub_program_id: activity.sub_program_id,
        activity_id: activity.id,
        legal_basis: data.legal_basis,
        justification: data.justification,
        cost_elements: data.cost_elements,
        budget_needs: {
          items: data.budget_items,
          global_increase_rate_2027: data.global_increase_rate_2027,
          global_increase_rate_2028: data.global_increase_rate_2028
        },
        status: 'draft',
        fiscal_year: fiscalYear
      };

      if (existingJustification) {
        const { error } = await supabase
          .from('activity_justifications')
          .update(justificationData)
          .eq('id', existingJustification.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('activity_justifications')
          .insert([justificationData]);

        if (error) throw error;
      }

      alert(isDraft ? 'Taslak olarak kaydedildi.' : 'Başarıyla tamamlandı.');
      await loadJustifications();
      setExpandedActivity(null);
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSavingActivityId(null);
    }
  };

  const filteredActivities = activities.filter(a =>
    a.activity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.activity_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.program?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getJustification = (activityId: string) => {
    return justifications.find(j => j.activity_id === activityId);
  };

  const getStatusBadge = (status?: 'draft' | 'submitted_to_vp' | 'vp_approved' | 'submitted_to_admin' | 'admin_approved' | 'rejected') => {
    if (!status) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Oluşturulmamış</span>;
    }
    if (status === 'draft') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Taslak</span>;
    }
    if (status === 'submitted_to_vp') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Başkan Yrd. Onayında</span>;
    }
    if (status === 'vp_approved') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Başkan Yrd. Onayladı</span>;
    }
    if (status === 'submitted_to_admin') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Yönetici Onayında</span>;
    }
    if (status === 'admin_approved') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Onaylandı</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Reddedildi</span>;
  };

  if (periodLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Aktif Bütçe Dönemi Bulunamadı</h3>
              <p className="text-yellow-800">
                Şu anda aktif bir bütçe dönemi bulunmamaktadır. Lütfen yöneticinizle iletişime geçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Faaliyet Gerekçe Formları</h1>
        <p className="text-gray-600">Müdürlüğünüze atanan faaliyetler için gerekçe ve bütçe gider kalemleri oluşturun</p>
      </div>

      {currentPeriod && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-blue-900">
                  {currentPeriod.budget_year} Mali Yılı Bütçesi
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentPeriod.period_status === 'preparation' ? 'bg-blue-100 text-blue-700' :
                  currentPeriod.period_status === 'approval' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {currentPeriod.period_status === 'preparation' ? 'Hazırlık' :
                   currentPeriod.period_status === 'approval' ? 'Onay' : 'Aktif'}
                </span>
              </div>
              {constraints && (
                <p className="text-sm text-blue-700 mt-1">{constraints.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!canCreate() && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Veri Girişi Kapalı</h3>
              <p className="text-sm text-red-700">
                Şu anda yeni gerekçe eklenemez veya düzenlenemez. Dönem durumu veri girişine izin vermiyor.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Müdürlük Seçin</label>
          <select
            value={selectedDepartment?.id || ''}
            onChange={(e) => {
              const dept = departments.find(d => d.id === e.target.value);
              setSelectedDepartment(dept || null);
              setExpandedActivity(null);
            }}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
            disabled={departments.length === 1}
          >
            <option value="">Müdürlük seçin...</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Mali Yıl</label>
          <div className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
            {fiscalYear}
          </div>
          <p className="text-xs text-gray-500 mt-1">Aktif dönemin mali yılı</p>
        </div>
      </div>

      {!selectedDepartment ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Building className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <div className="text-lg text-gray-600">Başlamak için yukarıdan bir müdürlük seçin</div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedDepartment.name}</h2>
                <p className="text-gray-600">Eşleştirilmiş Faaliyet Listesi</p>
              </div>
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold">
                {filteredActivities.length} Faaliyet
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Faaliyet kodu veya adı ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
              />
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Faaliyetler yükleniyor...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 font-semibold">Bu müdürlüğe eşleştirilmiş faaliyet bulunamadı.</p>
              <p className="text-sm text-gray-500 mt-2">
                "Müdürlük-Program Eşleştirme" sayfasından önce faaliyet eşleştirmesi yapılmalıdır.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => {
                const justification = getJustification(activity.id);
                const isExpanded = expandedActivity === activity.id;
                const data = formData[activity.id] || {
                  legal_basis: '',
                  justification: '',
                  cost_elements: '',
                  budget_items: [],
                  global_increase_rate_2027: 0,
                  global_increase_rate_2028: 0
                };

                return (
                  <div key={activity.id} className="bg-white rounded-xl shadow-sm border-2 border-gray-200">
                    <div
                      className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleActivityToggle(activity.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded">
                              {activity.program?.code}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              {activity.sub_program?.full_code}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded">
                              {activity.activity_code}
                            </span>
                            {getStatusBadge(justification?.status)}
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {activity.activity_name}
                          </h3>
                          <div className="text-sm text-gray-600">
                            <span className="font-semibold">Program:</span> {activity.program?.name}
                            <span className="mx-2">•</span>
                            <span className="font-semibold">Alt Program:</span> {activity.sub_program?.name}
                          </div>
                        </div>
                        <div className="ml-4">
                          {isExpanded ? (
                            <ChevronUp className="w-6 h-6 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-200 p-6 bg-gray-50">
                        <div className="space-y-6">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Yasal Dayanak
                            </label>
                            <textarea
                              value={data.legal_basis}
                              onChange={(e) => handleFormChange(activity.id, 'legal_basis', e.target.value)}
                              rows={3}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                              placeholder="Bu faaliyetin yasal dayanağını belirtin..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Gerekçe
                            </label>
                            <textarea
                              value={data.justification}
                              onChange={(e) => handleFormChange(activity.id, 'justification', e.target.value)}
                              rows={4}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                              placeholder="Faaliyetin gerekçesini açıklayın..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Maliyet Unsurları
                            </label>
                            <textarea
                              value={data.cost_elements}
                              onChange={(e) => handleFormChange(activity.id, 'cost_elements', e.target.value)}
                              rows={3}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                              placeholder="Maliyet unsurlarını açıklayın..."
                            />
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Genel Artış Oranları</h3>
                            <p className="text-xs text-gray-600 mb-3">
                              Bu oranlar tüm bütçe kalemleri için geçerli olacaktır.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  2027 Yılı Artış Oranı (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={data.global_increase_rate_2027}
                                  onChange={(e) => handleGlobalIncreaseRateChange(activity.id, 'global_increase_rate_2027', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  placeholder="Örn: 20"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  2027 = 2026 × (1 + {data.global_increase_rate_2027}%)
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  2028 Yılı Artış Oranı (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={data.global_increase_rate_2028}
                                  onChange={(e) => handleGlobalIncreaseRateChange(activity.id, 'global_increase_rate_2028', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  placeholder="Örn: 30"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  2028 = 2027 × (1 + {data.global_increase_rate_2028}%)
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <label className="block text-sm font-semibold text-gray-700">
                                Bütçe Gider Kalemleri
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowBulkAddModal(activity.id);
                                    setSelectedCodesForBulk(new Set());
                                    setBulkAddSearch('');
                                  }}
                                  disabled={codesLoading}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 flex items-center gap-1"
                                >
                                  <List className="w-4 h-4" />
                                  Toplu Kalem Ekle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddBudgetItem(activity.id)}
                                  disabled={codesLoading}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 flex items-center gap-1"
                                >
                                  <Plus className="w-4 h-4" />
                                  Tek Kalem Ekle
                                </button>
                              </div>
                            </div>

                            {codesLoading ? (
                              <div className="text-center py-4 text-gray-500">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto mb-2"></div>
                                Kodlar yükleniyor...
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {data.budget_items.map((item: BudgetItem, index: number) => {
                                  const searchKey = `${activity.id}-${index}`;
                                  const searchValue = economicCodeSearch[searchKey] || '';
                                  const filteredCodes = economicCodes.filter(code =>
                                    code.full_code.toLowerCase().includes(searchValue.toLowerCase()) ||
                                    code.name.toLowerCase().includes(searchValue.toLowerCase())
                                  );
                                  const selectedCode = economicCodes.find(c => c.id === item.economic_code_id);

                                  return (
                                    <div key={index} className="bg-white p-4 rounded-lg border-2 border-gray-200">
                                      <div className="flex gap-3 items-start">
                                        <div className="flex-1 space-y-3">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                              Ekonomik Gider Kodu
                                            </label>
                                            <div className="relative">
                                              <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <input
                                                  type="text"
                                                  value={searchValue}
                                                  onChange={(e) => setEconomicCodeSearch({
                                                    ...economicCodeSearch,
                                                    [searchKey]: e.target.value
                                                  })}
                                                  onFocus={(e) => {
                                                    if (!searchValue && selectedCode) {
                                                      setEconomicCodeSearch({
                                                        ...economicCodeSearch,
                                                        [searchKey]: selectedCode.full_code
                                                      });
                                                    }
                                                  }}
                                                  placeholder="Kod veya isim ile arayın..."
                                                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                                                />
                                              </div>
                                              {searchValue && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                  {filteredCodes.length > 0 ? (
                                                    filteredCodes.slice(0, 100).map((code) => (
                                                      <button
                                                        key={code.id}
                                                        type="button"
                                                        onClick={() => {
                                                          handleBudgetItemChange(activity.id, index, 'economic_code_id', code.id);
                                                          setEconomicCodeSearch({
                                                            ...economicCodeSearch,
                                                            [searchKey]: ''
                                                          });
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-100 last:border-b-0"
                                                      >
                                                        <div className="font-medium text-gray-900">{code.full_code}</div>
                                                        <div className="text-xs text-gray-600">{code.name}</div>
                                                      </button>
                                                    ))
                                                  ) : (
                                                    <div className="px-3 py-2 text-sm text-gray-500">Sonuç bulunamadı</div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            {selectedCode && !searchValue && (
                                              <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                                <span className="font-medium">{selectedCode.full_code}</span> - {selectedCode.name}
                                              </div>
                                            )}
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                2026 Yılı Tutarı (₺)
                                              </label>
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.amount_2026}
                                                onChange={(e) => handleBudgetItemChange(activity.id, index, 'amount_2026', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                                                placeholder="0.00"
                                              />
                                            </div>

                                            <div>
                                              <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-medium text-gray-600">
                                                  2027 Yılı Tutarı (₺)
                                                </label>
                                                {item.manual_2027 ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => resetToAutoCalculation(activity.id, index, 2027)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                    title="Otomatik hesaplamaya dön"
                                                  >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Otomatik
                                                  </button>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const currentItems = [...formData[activity.id].budget_items];
                                                      currentItems[index].manual_2027 = true;
                                                      setFormData({
                                                        ...formData,
                                                        [activity.id]: {
                                                          ...formData[activity.id],
                                                          budget_items: currentItems
                                                        }
                                                      });
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                                    title="Manuel düzenle"
                                                  >
                                                    <Edit3 className="w-3 h-3" />
                                                    Düzenle
                                                  </button>
                                                )}
                                              </div>
                                              {item.manual_2027 ? (
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={item.amount_2027}
                                                  onChange={(e) => handleBudgetItemChange(activity.id, index, 'amount_2027', parseFloat(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
                                                  placeholder="0.00"
                                                />
                                              ) : (
                                                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
                                                  {item.amount_2027.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                                </div>
                                              )}
                                              <div className="text-xs text-gray-500 mt-1">
                                                {item.manual_2027 ? (
                                                  <span className="text-blue-600 font-medium">Manuel değer</span>
                                                ) : (
                                                  <span>Otomatik: %{data.global_increase_rate_2027} artış</span>
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-medium text-gray-600">
                                                  2028 Yılı Tutarı (₺)
                                                </label>
                                                {item.manual_2028 ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => resetToAutoCalculation(activity.id, index, 2028)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                    title="Otomatik hesaplamaya dön"
                                                  >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Otomatik
                                                  </button>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const currentItems = [...formData[activity.id].budget_items];
                                                      currentItems[index].manual_2028 = true;
                                                      setFormData({
                                                        ...formData,
                                                        [activity.id]: {
                                                          ...formData[activity.id],
                                                          budget_items: currentItems
                                                        }
                                                      });
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                                    title="Manuel düzenle"
                                                  >
                                                    <Edit3 className="w-3 h-3" />
                                                    Düzenle
                                                  </button>
                                                )}
                                              </div>
                                              {item.manual_2028 ? (
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={item.amount_2028}
                                                  onChange={(e) => handleBudgetItemChange(activity.id, index, 'amount_2028', parseFloat(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
                                                  placeholder="0.00"
                                                />
                                              ) : (
                                                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
                                                  {item.amount_2028.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                                </div>
                                              )}
                                              <div className="text-xs text-gray-500 mt-1">
                                                {item.manual_2028 ? (
                                                  <span className="text-blue-600 font-medium">Manuel değer</span>
                                                ) : (
                                                  <span>Otomatik: %{data.global_increase_rate_2028} artış</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleRemoveBudgetItem(activity.id, index)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {data.budget_items.length === 0 && (
                                  <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                    Henüz bütçe kalemi eklenmedi. "Kalem Ekle" butonuna tıklayarak başlayın.
                                  </div>
                                )}

                                {data.budget_items.length > 0 && (
                                  <div className="bg-red-50 p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="font-semibold text-gray-700">2026 Toplam:</span>
                                      <span className="text-lg font-bold text-red-700">
                                        {data.budget_items.reduce((sum: number, item: BudgetItem) => sum + (item.amount_2026 || 0), 0).toLocaleString('tr-TR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })} ₺
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="font-semibold text-gray-700">2027 Toplam:</span>
                                      <span className="text-lg font-bold text-red-700">
                                        {data.budget_items.reduce((sum: number, item: BudgetItem) => sum + (item.amount_2027 || 0), 0).toLocaleString('tr-TR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })} ₺
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="font-semibold text-gray-700">2028 Toplam:</span>
                                      <span className="text-lg font-bold text-red-700">
                                        {data.budget_items.reduce((sum: number, item: BudgetItem) => sum + (item.amount_2028 || 0), 0).toLocaleString('tr-TR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })} ₺
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => handleSave(activity, true)}
                              disabled={savingActivityId === activity.id || codesLoading}
                              className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                              {savingActivityId === activity.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Kaydediliyor...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Taslak Kaydet
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave(activity, false)}
                              disabled={savingActivityId === activity.id || codesLoading}
                              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                              {savingActivityId === activity.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Kaydediliyor...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Tamamla ve Kaydet
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showBulkAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Toplu Ekonomik Kod Seçimi</h2>
                <button
                  onClick={() => {
                    setShowBulkAddModal(null);
                    setSelectedCodesForBulk(new Set());
                    setBulkAddSearch('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={bulkAddSearch}
                  onChange={(e) => setBulkAddSearch(e.target.value)}
                  placeholder="Kod veya isim ile arayın..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {selectedCodesForBulk.size} kod seçildi
                </span>
                {selectedCodesForBulk.size > 0 && (
                  <button
                    onClick={() => setSelectedCodesForBulk(new Set())}
                    className="text-red-600 hover:text-red-700 font-medium"
                  >
                    Seçimi Temizle
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {economicCodes
                  .filter(code =>
                    bulkAddSearch === '' ||
                    code.full_code.toLowerCase().includes(bulkAddSearch.toLowerCase()) ||
                    code.name.toLowerCase().includes(bulkAddSearch.toLowerCase())
                  )
                  .map((code) => {
                    const isSelected = selectedCodesForBulk.has(code.id);
                    const isAlreadyAdded = formData[showBulkAddModal]?.budget_items?.some(
                      item => item.economic_code_id === code.id
                    );

                    return (
                      <button
                        key={code.id}
                        type="button"
                        onClick={() => !isAlreadyAdded && toggleCodeSelection(code.id)}
                        disabled={isAlreadyAdded}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          isAlreadyAdded
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-blue-50 border-blue-500'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isAlreadyAdded
                              ? 'bg-gray-300 border-gray-400'
                              : isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                            {isAlreadyAdded && <X className="w-4 h-4 text-gray-600" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{code.full_code}</div>
                            <div className="text-sm text-gray-600">{code.name}</div>
                            {isAlreadyAdded && (
                              <div className="text-xs text-gray-500 mt-1">Bu kod zaten eklenmiş</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkAddModal(null);
                    setSelectedCodesForBulk(new Set());
                    setBulkAddSearch('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAddCodes(showBulkAddModal)}
                  disabled={selectedCodesForBulk.size === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {selectedCodesForBulk.size} Kodu Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
