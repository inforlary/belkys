import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  TestTube,
  AlertTriangle,
  FileWarning,
  CheckCircle,
  XCircle,
  Clock,
  Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface ActionPlan {
  id: string;
  plan_code: string;
  kiks_action_id: string;
  planned_actions: string;
  completion_date: string;
  status: string;
  ic_kiks_actions?: {
    code: string;
    description: string;
    ic_kiks_sub_standards?: {
      code: string;
      title: string;
    };
  };
}

interface Control {
  id: string;
  control_code: string;
  control_title: string;
  control_type: string;
  control_nature: string;
  frequency: string;
  design_effectiveness: string;
  operating_effectiveness: string;
  status: string;
  test_count?: number;
  finding_count?: number;
}

interface ControlTest {
  id: string;
  test_code: string;
  test_date: string;
  test_result: string;
  sample_size: number;
  exceptions_found: number;
  test_notes?: string;
}

interface Finding {
  id: string;
  finding_code: string;
  finding_title: string;
  severity: string;
  status: string;
  identified_date: string;
  capa_count?: number;
}

interface CAPA {
  id: string;
  capa_code: string;
  title: string;
  capa_type: string;
  priority: string;
  status: string;
  due_date: string;
  completion_percentage: number;
}

const CONTROL_TYPE_LABELS = {
  preventive: 'Önleyici',
  detective: 'Tespit Edici',
  corrective: 'Düzeltici'
};

const EFFECTIVENESS_LABELS = {
  effective: 'Etkin',
  partially_effective: 'Kısmen Etkin',
  ineffective: 'Etkisiz',
  not_assessed: 'Değerlendirilmedi'
};

const TEST_RESULT_LABELS = {
  pass: 'Başarılı',
  pass_with_exceptions: 'İstisnalarla Başarılı',
  fail: 'Başarısız',
  not_applicable: 'Geçerli Değil'
};

const SEVERITY_LABELS = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik'
};

export default function ActionPlanWorkflow() {
  const { profile } = useAuth();
  const { selectedPlanId, hasPlan } = useICPlan();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [selectedActionPlan, setSelectedActionPlan] = useState<ActionPlan | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlTests, setControlTests] = useState<ControlTest[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    controls: true,
    tests: false,
    findings: false,
    capas: false
  });

  const [showControlForm, setShowControlForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [showCapaForm, setShowCapaForm] = useState(false);
  const [selectedControl, setSelectedControl] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedFinding, setSelectedFinding] = useState<string>('');

  const [controlFormData, setControlFormData] = useState({
    control_title: '',
    control_description: '',
    control_type: 'preventive' as const,
    control_nature: 'manual' as const,
    frequency: 'monthly' as const,
    evidence_required: ''
  });

  const [testFormData, setTestFormData] = useState({
    test_date: new Date().toISOString().split('T')[0],
    test_period_start: '',
    test_period_end: '',
    sample_size: 0,
    exceptions_found: 0,
    test_result: 'pass' as const,
    test_notes: ''
  });

  const [findingFormData, setFindingFormData] = useState({
    finding_title: '',
    finding_description: '',
    severity: 'medium' as const,
    root_cause_analysis: ''
  });

  const [capaFormData, setCapaFormData] = useState({
    title: '',
    description: '',
    capa_type: 'corrective' as const,
    proposed_action: '',
    due_date: '',
    priority: 'medium' as const
  });

  useEffect(() => {
    if (profile && selectedPlanId) {
      fetchActionPlans();
    }
  }, [profile, selectedPlanId]);

  useEffect(() => {
    if (selectedActionPlan) {
      fetchWorkflowData();
    }
  }, [selectedActionPlan]);

  const fetchActionPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ic_action_plans')
        .select(`
          *,
          ic_kiks_actions(
            code,
            description,
            ic_kiks_sub_standards(
              code,
              title
            )
          )
        `)
        .eq('organization_id', profile?.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActionPlans(data || []);
    } catch (error) {
      console.error('Error fetching action plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowData = async () => {
    if (!selectedActionPlan) return;

    try {
      const [controlsRes, testsRes, findingsRes, capasRes] = await Promise.all([
        supabase
          .from('ic_controls')
          .select(`
            *,
            ic_control_tests(count),
            ic_findings(count)
          `)
          .eq('kiks_action_id', selectedActionPlan.kiks_action_id)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_control_tests')
          .select('*')
          .eq('kiks_action_id', selectedActionPlan.kiks_action_id),
        supabase
          .from('ic_findings')
          .select(`
            *,
            ic_capas(count)
          `)
          .eq('kiks_action_id', selectedActionPlan.kiks_action_id),
        supabase
          .from('ic_capas')
          .select('*')
          .eq('kiks_action_id', selectedActionPlan.kiks_action_id)
      ]);

      if (controlsRes.error) throw controlsRes.error;
      if (testsRes.error) throw testsRes.error;
      if (findingsRes.error) throw findingsRes.error;
      if (capasRes.error) throw capasRes.error;

      setControls(controlsRes.data || []);
      setControlTests(testsRes.data || []);
      setFindings(findingsRes.data || []);
      setCapas(capasRes.data || []);
    } catch (error) {
      console.error('Error fetching workflow data:', error);
    }
  };

  const handleCreateControl = async () => {
    if (!selectedActionPlan || !controlFormData.control_title) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_controls')
        .insert({
          organization_id: profile?.organization_id,
          kiks_action_id: selectedActionPlan.kiks_action_id,
          ic_plan_id: selectedPlanId,
          control_title: controlFormData.control_title,
          control_description: controlFormData.control_description,
          control_type: controlFormData.control_type,
          control_nature: controlFormData.control_nature,
          frequency: controlFormData.frequency,
          evidence_required: controlFormData.evidence_required,
          status: 'active'
        });

      if (error) throw error;

      alert('Kontrol faaliyeti başarıyla oluşturuldu');
      setShowControlForm(false);
      setControlFormData({
        control_title: '',
        control_description: '',
        control_type: 'preventive',
        control_nature: 'manual',
        frequency: 'monthly',
        evidence_required: ''
      });
      fetchWorkflowData();
    } catch (error: any) {
      console.error('Error creating control:', error);
      alert('Hata: ' + error.message);
    }
  };

  const handleCreateTest = async () => {
    if (!selectedControl || !testFormData.test_date) {
      alert('Lütfen kontrol seçin ve test tarihini girin');
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_control_tests')
        .insert({
          organization_id: profile?.organization_id,
          control_id: selectedControl,
          kiks_action_id: selectedActionPlan?.kiks_action_id,
          test_date: testFormData.test_date,
          test_period_start: testFormData.test_period_start,
          test_period_end: testFormData.test_period_end,
          sample_size: testFormData.sample_size,
          exceptions_found: testFormData.exceptions_found,
          test_result: testFormData.test_result,
          test_notes: testFormData.test_notes,
          tester_id: profile?.id
        });

      if (error) throw error;

      alert('Kontrol testi başarıyla kaydedildi');
      setShowTestForm(false);
      setTestFormData({
        test_date: new Date().toISOString().split('T')[0],
        test_period_start: '',
        test_period_end: '',
        sample_size: 0,
        exceptions_found: 0,
        test_result: 'pass',
        test_notes: ''
      });
      fetchWorkflowData();
    } catch (error: any) {
      console.error('Error creating test:', error);
      alert('Hata: ' + error.message);
    }
  };

  const handleCreateFinding = async () => {
    if (!selectedTest || !findingFormData.finding_title) {
      alert('Lütfen test seçin ve bulgu başlığını girin');
      return;
    }

    try {
      const testData = controlTests.find(t => t.id === selectedTest);
      const { error } = await supabase
        .from('ic_findings')
        .insert({
          organization_id: profile?.organization_id,
          control_test_id: selectedTest,
          kiks_action_id: selectedActionPlan?.kiks_action_id,
          finding_title: findingFormData.finding_title,
          finding_description: findingFormData.finding_description,
          severity: findingFormData.severity,
          root_cause_analysis: findingFormData.root_cause_analysis,
          identified_date: new Date().toISOString().split('T')[0],
          identified_by: profile?.id,
          status: 'open',
          finding_source: 'control_test'
        });

      if (error) throw error;

      alert('Bulgu başarıyla kaydedildi');
      setShowFindingForm(false);
      setFindingFormData({
        finding_title: '',
        finding_description: '',
        severity: 'medium',
        root_cause_analysis: ''
      });
      fetchWorkflowData();
    } catch (error: any) {
      console.error('Error creating finding:', error);
      alert('Hata: ' + error.message);
    }
  };

  const handleCreateCapa = async () => {
    if (!selectedFinding || !capaFormData.title) {
      alert('Lütfen bulgu seçin ve CAPA başlığını girin');
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_capas')
        .insert({
          organization_id: profile?.organization_id,
          finding_id: selectedFinding,
          kiks_action_id: selectedActionPlan?.kiks_action_id,
          title: capaFormData.title,
          description: capaFormData.description,
          capa_type: capaFormData.capa_type,
          proposed_action: capaFormData.proposed_action,
          due_date: capaFormData.due_date,
          priority: capaFormData.priority,
          responsible_user_id: profile?.id,
          responsible_department_id: profile?.department_id,
          status: 'open',
          completion_percentage: 0
        });

      if (error) throw error;

      alert('CAPA başarıyla oluşturuldu');
      setShowCapaForm(false);
      setCapaFormData({
        title: '',
        description: '',
        capa_type: 'corrective',
        proposed_action: '',
        due_date: '',
        priority: 'medium'
      });
      fetchWorkflowData();
    } catch (error: any) {
      console.error('Error creating CAPA:', error);
      alert('Hata: ' + error.message);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-7 h-7 text-blue-600" />
          Eylem Planı İş Akışı
        </h1>
        <p className="text-gray-600 mt-1">
          Eylem planlarından kontrollere, testlerden bulgulara kadar tüm süreç
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Eylem Planı Seçin
        </label>
        <select
          value={selectedActionPlan?.id || ''}
          onChange={(e) => {
            const plan = actionPlans.find(p => p.id === e.target.value);
            setSelectedActionPlan(plan || null);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Eylem Planı Seçin --</option>
          {actionPlans.map(plan => (
            <option key={plan.id} value={plan.id}>
              {plan.ic_kiks_actions?.code} - {plan.planned_actions.substring(0, 80)}...
            </option>
          ))}
        </select>
      </div>

      {selectedActionPlan && (
        <>
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 rounded">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  {selectedActionPlan.ic_kiks_actions?.ic_kiks_sub_standards?.code} -
                  {selectedActionPlan.ic_kiks_actions?.ic_kiks_sub_standards?.title}
                </h3>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Eylem:</strong> {selectedActionPlan.planned_actions}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('controls')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.controls ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <span className="font-semibold">Kontrol Faaliyetleri</span>
                  <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded">{controls.length}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowControlForm(!showControlForm);
                  }}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Kontrol Ekle
                </button>
              </button>

              {expandedSections.controls && (
                <div className="p-6 border-t">
                  {showControlForm && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold mb-4">Yeni Kontrol Faaliyeti</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Başlığı *</label>
                          <input
                            type="text"
                            value={controlFormData.control_title}
                            onChange={(e) => setControlFormData({ ...controlFormData, control_title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                          <textarea
                            value={controlFormData.control_description}
                            onChange={(e) => setControlFormData({ ...controlFormData, control_description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Tipi</label>
                            <select
                              value={controlFormData.control_type}
                              onChange={(e) => setControlFormData({ ...controlFormData, control_type: e.target.value as any })}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="preventive">Önleyici</option>
                              <option value="detective">Tespit Edici</option>
                              <option value="corrective">Düzeltici</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Doğası</label>
                            <select
                              value={controlFormData.control_nature}
                              onChange={(e) => setControlFormData({ ...controlFormData, control_nature: e.target.value as any })}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="manual">Manuel</option>
                              <option value="automated">Otomatik</option>
                              <option value="semi_automated">Yarı Otomatik</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sıklık</label>
                            <select
                              value={controlFormData.frequency}
                              onChange={(e) => setControlFormData({ ...controlFormData, frequency: e.target.value as any })}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="continuous">Sürekli</option>
                              <option value="daily">Günlük</option>
                              <option value="weekly">Haftalık</option>
                              <option value="monthly">Aylık</option>
                              <option value="quarterly">Çeyreklik</option>
                              <option value="annual">Yıllık</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowControlForm(false)}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                          >
                            İptal
                          </button>
                          <button
                            onClick={handleCreateControl}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {controls.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>Henüz kontrol faaliyeti eklenmemiş</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {controls.map(control => (
                        <div key={control.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{control.control_title}</h4>
                              <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {CONTROL_TYPE_LABELS[control.control_type as keyof typeof CONTROL_TYPE_LABELS]}
                                </span>
                                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                  {control.frequency}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <TestTube className="w-4 h-4" />
                                <span>{control.test_count || 0} Test</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{control.finding_count || 0} Bulgu</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('tests')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.tests ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <TestTube className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">Kontrol Testleri</span>
                  <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">{controlTests.length}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (controls.length === 0) {
                      alert('Önce kontrol faaliyeti eklemelisiniz');
                      return;
                    }
                    setShowTestForm(!showTestForm);
                  }}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  disabled={controls.length === 0}
                >
                  <Plus className="w-4 h-4" />
                  Test Ekle
                </button>
              </button>

              {expandedSections.tests && (
                <div className="p-6 border-t">
                  {showTestForm && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold mb-4">Yeni Kontrol Testi</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Seçin *</label>
                          <select
                            value={selectedControl}
                            onChange={(e) => setSelectedControl(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="">-- Kontrol Seçin --</option>
                            {controls.map(control => (
                              <option key={control.id} value={control.id}>
                                {control.control_title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Test Tarihi *</label>
                            <input
                              type="date"
                              value={testFormData.test_date}
                              onChange={(e) => setTestFormData({ ...testFormData, test_date: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dönem Başlangıç</label>
                            <input
                              type="date"
                              value={testFormData.test_period_start}
                              onChange={(e) => setTestFormData({ ...testFormData, test_period_start: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dönem Bitiş</label>
                            <input
                              type="date"
                              value={testFormData.test_period_end}
                              onChange={(e) => setTestFormData({ ...testFormData, test_period_end: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Örnek Büyüklüğü</label>
                            <input
                              type="number"
                              value={testFormData.sample_size}
                              onChange={(e) => setTestFormData({ ...testFormData, sample_size: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bulunan İstisnalar</label>
                            <input
                              type="number"
                              value={testFormData.exceptions_found}
                              onChange={(e) => setTestFormData({ ...testFormData, exceptions_found: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Test Sonucu</label>
                            <select
                              value={testFormData.test_result}
                              onChange={(e) => setTestFormData({ ...testFormData, test_result: e.target.value as any })}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="pass">Başarılı</option>
                              <option value="pass_with_exceptions">İstisnalarla Başarılı</option>
                              <option value="fail">Başarısız</option>
                              <option value="not_applicable">Geçerli Değil</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                          <textarea
                            value={testFormData.test_notes}
                            onChange={(e) => setTestFormData({ ...testFormData, test_notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowTestForm(false)}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                          >
                            İptal
                          </button>
                          <button
                            onClick={handleCreateTest}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {controlTests.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <TestTube className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>Henüz kontrol testi yapılmamış</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {controlTests.map(test => (
                        <div key={test.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Test Tarihi: {new Date(test.test_date).toLocaleDateString('tr-TR')}</p>
                              <p className="text-sm mt-1">Örnek: {test.sample_size}, İstisna: {test.exceptions_found}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              test.test_result === 'pass' ? 'bg-green-100 text-green-800' :
                              test.test_result === 'pass_with_exceptions' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {TEST_RESULT_LABELS[test.test_result as keyof typeof TEST_RESULT_LABELS]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('findings')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.findings ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="font-semibold">Bulgular</span>
                  <span className="bg-orange-100 text-orange-800 text-sm px-2 py-1 rounded">{findings.length}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (controlTests.length === 0) {
                      alert('Önce kontrol testi yapmalısınız');
                      return;
                    }
                    setShowFindingForm(!showFindingForm);
                  }}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                  disabled={controlTests.length === 0}
                >
                  <Plus className="w-4 h-4" />
                  Bulgu Ekle
                </button>
              </button>

              {expandedSections.findings && (
                <div className="p-6 border-t">
                  {showFindingForm && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold mb-4">Yeni Bulgu</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Testi *</label>
                          <select
                            value={selectedTest}
                            onChange={(e) => setSelectedTest(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="">-- Test Seçin --</option>
                            {controlTests.map(test => (
                              <option key={test.id} value={test.id}>
                                {new Date(test.test_date).toLocaleDateString('tr-TR')} - {TEST_RESULT_LABELS[test.test_result as keyof typeof TEST_RESULT_LABELS]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bulgu Başlığı *</label>
                          <input
                            type="text"
                            value={findingFormData.finding_title}
                            onChange={(e) => setFindingFormData({ ...findingFormData, finding_title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                          <textarea
                            value={findingFormData.finding_description}
                            onChange={(e) => setFindingFormData({ ...findingFormData, finding_description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Önem Derecesi</label>
                          <select
                            value={findingFormData.severity}
                            onChange={(e) => setFindingFormData({ ...findingFormData, severity: e.target.value as any })}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="low">Düşük</option>
                            <option value="medium">Orta</option>
                            <option value="high">Yüksek</option>
                            <option value="critical">Kritik</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Kök Neden Analizi</label>
                          <textarea
                            value={findingFormData.root_cause_analysis}
                            onChange={(e) => setFindingFormData({ ...findingFormData, root_cause_analysis: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowFindingForm(false)}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                          >
                            İptal
                          </button>
                          <button
                            onClick={handleCreateFinding}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {findings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>Henüz bulgu kaydedilmemiş</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {findings.map(finding => (
                        <div key={finding.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{finding.finding_title}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Tespit: {new Date(finding.identified_date).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                finding.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                finding.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {SEVERITY_LABELS[finding.severity as keyof typeof SEVERITY_LABELS]}
                              </span>
                              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                {finding.capa_count || 0} CAPA
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('capas')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.capas ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <FileWarning className="w-5 h-5 text-red-600" />
                  <span className="font-semibold">CAPA (Düzeltici ve Önleyici Faaliyetler)</span>
                  <span className="bg-red-100 text-red-800 text-sm px-2 py-1 rounded">{capas.length}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (findings.length === 0) {
                      alert('Önce bulgu kaydedilmelidir');
                      return;
                    }
                    setShowCapaForm(!showCapaForm);
                  }}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                  disabled={findings.length === 0}
                >
                  <Plus className="w-4 h-4" />
                  CAPA Ekle
                </button>
              </button>

              {expandedSections.capas && (
                <div className="p-6 border-t">
                  {showCapaForm && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold mb-4">Yeni CAPA</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bulgu Seçin *</label>
                          <select
                            value={selectedFinding}
                            onChange={(e) => setSelectedFinding(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="">-- Bulgu Seçin --</option>
                            {findings.map(finding => (
                              <option key={finding.id} value={finding.id}>
                                {finding.finding_title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CAPA Başlığı *</label>
                          <input
                            type="text"
                            value={capaFormData.title}
                            onChange={(e) => setCapaFormData({ ...capaFormData, title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                          <textarea
                            value={capaFormData.description}
                            onChange={(e) => setCapaFormData({ ...capaFormData, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CAPA Tipi</label>
                            <select
                              value={capaFormData.capa_type}
                              onChange={(e) => setCapaFormData({ ...capaFormData, capa_type: e.target.value as any })}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="corrective">Düzeltici</option>
                              <option value="preventive">Önleyici</option>
                              <option value="both">Her İkisi</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
                            <select
                              value={capaFormData.priority}
                              onChange={(e) => setCapaFormData({ ...capaFormData, priority: e.target.value as any })}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="low">Düşük</option>
                              <option value="medium">Orta</option>
                              <option value="high">Yüksek</option>
                              <option value="critical">Kritik</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Tarih *</label>
                            <input
                              type="date"
                              value={capaFormData.due_date}
                              onChange={(e) => setCapaFormData({ ...capaFormData, due_date: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Önerilen Aksiyon *</label>
                          <textarea
                            value={capaFormData.proposed_action}
                            onChange={(e) => setCapaFormData({ ...capaFormData, proposed_action: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowCapaForm(false)}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                          >
                            İptal
                          </button>
                          <button
                            onClick={handleCreateCapa}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {capas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileWarning className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>Henüz CAPA oluşturulmamış</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {capas.map(capa => (
                        <div key={capa.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{capa.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Hedef: {new Date(capa.due_date).toLocaleDateString('tr-TR')}
                              </p>
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: `${capa.completion_percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">{capa.completion_percentage}%</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                capa.priority === 'critical' ? 'bg-red-100 text-red-800' :
                                capa.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                capa.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {capa.priority}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                capa.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                                capa.status === 'verified' ? 'bg-teal-100 text-teal-800' :
                                capa.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {capa.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
