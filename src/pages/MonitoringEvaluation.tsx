import React, { useState, useEffect } from 'react';
import { Search, ClipboardCheck, Calendar, TrendingUp, Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle, Filter, Paperclip, Download, FileText, X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Card } from '../components/ui/Card';

interface ControlTest {
  id: string;
  control_id: string;
  test_period_start: string;
  test_period_end: string;
  tester_id?: string;
  test_date: string;
  sample_size?: number;
  exceptions_found: number;
  test_result: 'pass' | 'pass_with_exceptions' | 'fail' | 'not_applicable';
  test_notes?: string;
  evidence_urls?: string[];
  control_code?: string;
  control_title?: string;
  tester_name?: string;
  created_at: string;
}

interface Control {
  id: string;
  control_code: string;
  control_title: string;
  frequency: string;
}

interface User {
  id: string;
  full_name: string;
}

export default function MonitoringEvaluation() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [tests, setTests] = useState<ControlTest[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<ControlTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [testForm, setTestForm] = useState({
    control_id: '',
    test_period_start: '',
    test_period_end: '',
    tester_id: '',
    test_date: new Date().toISOString().split('T')[0],
    sample_size: 0,
    exceptions_found: 0,
    test_result: 'pass' as 'pass' | 'pass_with_exceptions' | 'fail' | 'not_applicable',
    test_notes: '',
    evidence_urls: [] as string[]
  });

  const [stats, setStats] = useState({
    total_tests: 0,
    passed: 0,
    failed: 0,
    pass_with_exceptions: 0,
    pass_rate: 0
  });

  useEffect(() => {
    if (profile?.organization_id && selectedPlanId) {
      loadData();
    }
  }, [profile, selectedPlanId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTests(),
        loadControls(),
        loadUsers()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTests = async () => {
    if (!selectedPlanId) return;

    const { data, error } = await supabase
      .from('ic_control_tests')
      .select(`
        *,
        ic_controls(control_code, control_title),
        tester:profiles!ic_control_tests_tester_id_fkey(full_name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId)
      .order('test_date', { ascending: false });

    if (!error && data) {
      const formatted = data.map((test: any) => ({
        id: test.id,
        control_id: test.control_id,
        test_period_start: test.test_period_start,
        test_period_end: test.test_period_end,
        tester_id: test.tester_id,
        test_date: test.test_date,
        sample_size: test.sample_size,
        exceptions_found: test.exceptions_found,
        test_result: test.test_result,
        test_notes: test.test_notes,
        evidence_urls: test.evidence_urls || [],
        control_code: test.ic_controls?.control_code,
        control_title: test.ic_controls?.control_title,
        tester_name: test.tester?.full_name,
        created_at: test.created_at
      }));
      setTests(formatted);
      calculateStats(formatted);
    }
  };

  const loadControls = async () => {
    if (!selectedPlanId) return;

    const { data, error } = await supabase
      .from('ic_controls')
      .select('id, control_code, control_title, frequency')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId)
      .eq('status', 'active')
      .order('control_code');

    if (!error && data) setControls(data);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', profile!.organization_id)
      .order('full_name');

    if (!error && data) setUsers(data);
  };

  const calculateStats = (testData: ControlTest[]) => {
    const total = testData.length;
    const passed = testData.filter(t => t.test_result === 'pass').length;
    const failed = testData.filter(t => t.test_result === 'fail').length;
    const passWithExceptions = testData.filter(t => t.test_result === 'pass_with_exceptions').length;
    const passRate = total > 0 ? ((passed + passWithExceptions) / total * 100) : 0;

    setStats({
      total_tests: total,
      passed,
      failed,
      pass_with_exceptions: passWithExceptions,
      pass_rate: Math.round(passRate)
    });
  };

  const handleSaveTest = async () => {
    try {
      const payload = {
        ...testForm,
        organization_id: profile!.organization_id,
        ic_plan_id: selectedPlanId,
        tester_id: testForm.tester_id || profile!.id,
        evidence_urls: testForm.evidence_urls.length > 0 ? testForm.evidence_urls : null
      };

      if (editingTest) {
        await supabase
          .from('ic_control_tests')
          .update(payload)
          .eq('id', editingTest.id);
      } else {
        await supabase
          .from('ic_control_tests')
          .insert(payload);
      }

      setShowTestModal(false);
      resetForm();
      loadTests();
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Test kaydedilirken bir hata oluştu');
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!confirm('Bu testi silmek istediğinizden emin misiniz?')) return;

    try {
      await supabase
        .from('ic_control_tests')
        .delete()
        .eq('id', id);
      loadTests();
    } catch (error) {
      console.error('Error deleting test:', error);
    }
  };

  const openEditTest = (test: ControlTest) => {
    setEditingTest(test);
    setTestForm({
      control_id: test.control_id,
      test_period_start: test.test_period_start,
      test_period_end: test.test_period_end,
      tester_id: test.tester_id || '',
      test_date: test.test_date,
      sample_size: test.sample_size || 0,
      exceptions_found: test.exceptions_found,
      test_result: test.test_result,
      test_notes: test.test_notes || '',
      evidence_urls: test.evidence_urls || []
    });
    setShowTestModal(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !profile?.organization_id) return;

    setUploadingFiles(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile.organization_id}/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('ic-test-evidence')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert(`Dosya yüklenirken hata oluştu: ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('ic-test-evidence')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setTestForm({
        ...testForm,
        evidence_urls: [...testForm.evidence_urls, ...uploadedUrls]
      });

      alert(`${uploadedUrls.length} dosya başarıyla yüklendi`);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Dosyalar yüklenirken hata oluştu');
    } finally {
      setUploadingFiles(false);
      event.target.value = '';
    }
  };

  const handleRemoveFile = async (url: string) => {
    if (!confirm('Bu dosyayı kaldırmak istediğinizden emin misiniz?')) return;

    try {
      const path = url.split('/ic-test-evidence/')[1];
      if (path) {
        await supabase.storage.from('ic-test-evidence').remove([path]);
      }

      setTestForm({
        ...testForm,
        evidence_urls: testForm.evidence_urls.filter(u => u !== url)
      });
    } catch (error) {
      console.error('Error removing file:', error);
      alert('Dosya silinirken hata oluştu');
    }
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return decodeURIComponent(fileName);
  };

  const resetForm = () => {
    setEditingTest(null);
    setTestForm({
      control_id: '',
      test_period_start: '',
      test_period_end: '',
      tester_id: '',
      test_date: new Date().toISOString().split('T')[0],
      sample_size: 0,
      exceptions_found: 0,
      test_result: 'pass',
      test_notes: '',
      evidence_urls: []
    });
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pass_with_exceptions':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'pass':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pass_with_exceptions':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getResultLabel = (result: string) => {
    const labels: Record<string, string> = {
      pass: 'Başarılı',
      pass_with_exceptions: 'İstisnalarla Başarılı',
      fail: 'Başarısız',
      not_applicable: 'Uygulanmaz'
    };
    return labels[result] || result;
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch =
      test.control_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.control_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.tester_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesResult = filterResult === 'all' || test.test_result === filterResult;

    let matchesPeriod = true;
    if (filterPeriod !== 'all') {
      const testDate = new Date(test.test_date);
      const now = new Date();
      const diffMonths = (now.getFullYear() - testDate.getFullYear()) * 12 + (now.getMonth() - testDate.getMonth());

      if (filterPeriod === 'month' && diffMonths > 1) matchesPeriod = false;
      if (filterPeriod === 'quarter' && diffMonths > 3) matchesPeriod = false;
      if (filterPeriod === 'year' && diffMonths > 12) matchesPeriod = false;
    }

    return matchesSearch && matchesResult && matchesPeriod;
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                İzleme & Kontrol Testleri modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
            <ClipboardCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">İzleme & Kontrol Testleri</h1>
            <p className="text-sm text-gray-600">Kontrol Etkinlik Testleri ve Sonuçları</p>
            {selectedPlan && (
              <p className="text-xs text-gray-500">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              resetForm();
              setShowTestModal(true);
            }}
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Yeni Test
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Test</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_tests}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                <ClipboardCheck className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Başarılı</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.passed}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Başarısız</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.failed}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Başarı Oranı</p>
                <p className="text-3xl font-bold text-teal-600 mt-2">{stats.pass_rate}%</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg">
                <TrendingUp className="w-8 h-8 text-teal-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Kontrol kodu, başlık veya tester ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Tüm Sonuçlar</option>
            <option value="pass">Başarılı</option>
            <option value="pass_with_exceptions">İstisnalarla Başarılı</option>
            <option value="fail">Başarısız</option>
            <option value="not_applicable">Uygulanmaz</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Tüm Zamanlar</option>
            <option value="month">Son 1 Ay</option>
            <option value="quarter">Son 3 Ay</option>
            <option value="year">Son 1 Yıl</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Card>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Yükleniyor...</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTests.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500">
                Henüz kontrol testi bulunmuyor
              </div>
            </Card>
          ) : (
            filteredTests.map((test) => (
              <Card key={test.id}>
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {getResultIcon(test.test_result)}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {test.control_code} - {test.control_title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                            <span>Test Tarihi: {new Date(test.test_date).toLocaleDateString('tr-TR')}</span>
                            <span>•</span>
                            <span>Dönem: {new Date(test.test_period_start).toLocaleDateString('tr-TR')} - {new Date(test.test_period_end).toLocaleDateString('tr-TR')}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getResultColor(test.test_result)}`}>
                          {getResultLabel(test.test_result)}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-6 mt-4 pt-4 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Test Eden</p>
                          <p className="text-sm font-medium text-gray-900">{test.tester_name || 'Belirtilmemiş'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Örneklem Büyüklüğü</p>
                          <p className="text-sm font-medium text-gray-900">{test.sample_size || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Bulunan İstisnalar</p>
                          <p className={`text-sm font-medium ${test.exceptions_found > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {test.exceptions_found}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Kanıt Sayısı</p>
                          <p className="text-sm font-medium text-gray-900">{test.evidence_urls?.length || 0}</p>
                        </div>
                      </div>

                      {test.test_notes && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Test Notları</p>
                          <p className="text-sm text-gray-700">{test.test_notes}</p>
                        </div>
                      )}

                      {test.evidence_urls && test.evidence_urls.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="w-4 h-4 text-gray-500" />
                            <p className="text-xs text-gray-500">Kanıt Dosyaları ({test.evidence_urls.length})</p>
                          </div>
                          <div className="space-y-1">
                            {test.evidence_urls.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors group"
                              >
                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-xs text-gray-700 flex-1 truncate">
                                  {getFileName(url)}
                                </span>
                                <Download className="w-4 h-4 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => openEditTest(test)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTest(test.id)}
                          className="text-red-600 hover:text-red-800 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Modal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        title={editingTest ? 'Test Sonucunu Düzenle' : 'Yeni Kontrol Testi'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol *</label>
            <select
              value={testForm.control_id}
              onChange={(e) => setTestForm({ ...testForm, control_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Kontrol seçiniz</option>
              {controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {control.control_code} - {control.control_title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Dönemi Başlangıç *</label>
              <input
                type="date"
                value={testForm.test_period_start}
                onChange={(e) => setTestForm({ ...testForm, test_period_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Dönemi Bitiş *</label>
              <input
                type="date"
                value={testForm.test_period_end}
                onChange={(e) => setTestForm({ ...testForm, test_period_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Tarihi *</label>
              <input
                type="date"
                value={testForm.test_date}
                onChange={(e) => setTestForm({ ...testForm, test_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Eden</label>
              <select
                value={testForm.tester_id}
                onChange={(e) => setTestForm({ ...testForm, tester_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Seçiniz (varsayılan: siz)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Örneklem Büyüklüğü</label>
              <input
                type="number"
                min="0"
                value={testForm.sample_size}
                onChange={(e) => setTestForm({ ...testForm, sample_size: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bulunan İstisnalar</label>
              <input
                type="number"
                min="0"
                value={testForm.exceptions_found}
                onChange={(e) => setTestForm({ ...testForm, exceptions_found: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Sonucu *</label>
            <select
              value={testForm.test_result}
              onChange={(e) => setTestForm({ ...testForm, test_result: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="pass">Başarılı</option>
              <option value="pass_with_exceptions">İstisnalarla Başarılı</option>
              <option value="fail">Başarısız</option>
              <option value="not_applicable">Uygulanmaz</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Notları</label>
            <textarea
              value={testForm.test_notes}
              onChange={(e) => setTestForm({ ...testForm, test_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={4}
              placeholder="Test detayları, bulgular, yorumlar..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kanıt Dosyaları
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-teal-500 transition-colors">
              <input
                type="file"
                id="evidence-upload"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={handleFileUpload}
                disabled={uploadingFiles}
                className="hidden"
              />
              <label
                htmlFor="evidence-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className={`w-8 h-8 ${uploadingFiles ? 'text-gray-400' : 'text-teal-600'}`} />
                <span className="text-sm text-gray-600">
                  {uploadingFiles ? 'Dosyalar yükleniyor...' : 'Dosya yüklemek için tıklayın veya sürükleyin'}
                </span>
                <span className="text-xs text-gray-500">
                  PDF, Resim, Word, Excel dosyaları (Max 10MB)
                </span>
              </label>
            </div>

            {testForm.evidence_urls.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Yüklenen Dosyalar ({testForm.evidence_urls.length})
                </p>
                {testForm.evidence_urls.map((url, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 flex-1 truncate">
                      {getFileName(url)}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                      title="İndir"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleRemoveFile(url)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Sil"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSaveTest}
              disabled={!testForm.control_id || !testForm.test_period_start || !testForm.test_period_end || !testForm.test_date}
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              Kaydet
            </Button>
            <Button
              onClick={() => setShowTestModal(false)}
              variant="secondary"
              className="flex-1"
            >
              İptal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
