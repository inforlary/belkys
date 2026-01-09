import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Save,
  X,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Target,
  BarChart3,
  Users,
  FileCheck,
  Download
} from 'lucide-react';

interface RiskSettings {
  id?: string;
  organization_id?: string;
  risk_appetite: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_appetite_description: string;
  policy_text: string;
  roles_responsibilities: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface ApproverProfile {
  full_name: string;
  title?: string;
}

type TabType = 'policy' | 'appetite' | 'tolerance' | 'roles' | 'approval';

const RISK_TOLERANCE_LEVELS = [
  {
    level: 'Düşük',
    emoji: '🟢',
    scoreRange: '1-4',
    tolerance: 'Kabul edilir',
    action: 'İzleme'
  },
  {
    level: 'Orta',
    emoji: '🟡',
    scoreRange: '5-9',
    tolerance: 'Kabul edilir',
    action: 'Kontrol gerekli'
  },
  {
    level: 'Yüksek',
    emoji: '🟠',
    scoreRange: '10-14',
    tolerance: 'Sınırlı kabul',
    action: 'Azaltma gerekli'
  },
  {
    level: 'Çok Yüksek',
    emoji: '🔴',
    scoreRange: '15-19',
    tolerance: 'Kabul edilmez',
    action: 'Acil önlem'
  },
  {
    level: 'Kritik',
    emoji: '⬛',
    scoreRange: '20-25',
    tolerance: 'Kabul edilmez',
    action: 'Derhal müdahale'
  }
];

const DEFAULT_ROLES = `Üst Yönetici:
• Risk yönetimi politikasını onaylar
• Risk iştahını belirler
• Kaynak tahsis eder

Risk Koordinatörü:
• Risk yönetimi sürecini koordine eder
• Raporları hazırlar
• Eğitimleri planlar

Birim Yöneticileri:
• Birim risklerini tanımlar
• Kontrolleri uygular
• Faaliyetleri takip eder

Risk Sahipleri:
• Riskin izlenmesinden sorumlu
• Kontrol etkinliğini değerlendirir
• Değişiklikleri raporlar`;

export default function RiskSettingsStrategy() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('policy');
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [approverProfile, setApproverProfile] = useState<ApproverProfile | null>(null);

  const [settings, setSettings] = useState<RiskSettings>({
    risk_appetite: 'MEDIUM',
    risk_appetite_description: '',
    policy_text: '',
    roles_responsibilities: DEFAULT_ROLES
  });

  const [editedSettings, setEditedSettings] = useState<RiskSettings>(settings);

  useEffect(() => {
    loadSettings();
  }, [profile?.organization_id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (!profile?.organization_id) return;

      const { data, error } = await supabase
        .from('risk_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setEditedSettings(data);

        if (data.approved_by) {
          const { data: approverData } = await supabase
            .from('profiles')
            .select('full_name, title')
            .eq('id', data.approved_by)
            .single();

          if (approverData) {
            setApproverProfile(approverData);
          }
        }
      } else {
        const defaultSettings: RiskSettings = {
          risk_appetite: 'MEDIUM',
          risk_appetite_description: '',
          policy_text: '',
          roles_responsibilities: DEFAULT_ROLES
        };
        setSettings(defaultSettings);
        setEditedSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Ayarlar yüklenirken hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!profile?.organization_id) return;

      const dataToSave = {
        ...editedSettings,
        organization_id: profile.organization_id,
        updated_at: new Date().toISOString()
      };

      if (settings.id) {
        const { error } = await supabase
          .from('risk_settings')
          .update(dataToSave)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('risk_settings')
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSettings(data);
          setEditedSettings(data);
        }
      }

      await loadSettings();
      setIsEditMode(false);
      setMessage({ type: 'success', text: 'Risk strateji belgesi başarıyla kaydedildi' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Kaydetme sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedSettings(settings);
    setIsEditMode(false);
    setMessage(null);
  };

  const handleApprove = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!settings.id) {
        setMessage({ type: 'error', text: 'Önce stratejiyi kaydetmelisiniz' });
        return;
      }

      const { error } = await supabase
        .from('risk_settings')
        .update({
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) throw error;

      await loadSettings();
      setMessage({ type: 'success', text: 'Risk strateji belgesi onaylandı' });
    } catch (error) {
      console.error('Error approving:', error);
      setMessage({ type: 'error', text: 'Onaylama sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    setMessage({ type: 'error', text: 'PDF indirme özelliği yakında eklenecek' });
  };

  const getAppetiteLabel = (appetite: string) => {
    switch (appetite) {
      case 'LOW': return 'DÜŞÜK';
      case 'MEDIUM': return 'ORTA';
      case 'HIGH': return 'YÜKSEK';
      default: return appetite;
    }
  };

  const getAppetiteDescription = (appetite: string) => {
    switch (appetite) {
      case 'LOW': return 'Kurum riskten kaçınır. Sadece düşük riskli faaliyetler kabul edilir.';
      case 'MEDIUM': return 'Kurum dengeli yaklaşım benimser. Makul riskler kabul edilebilir.';
      case 'HIGH': return 'Kurum hedefler için yüksek risk almaya hazırdır.';
      default: return '';
    }
  };

  const getAppetiteProgress = (appetite: string) => {
    switch (appetite) {
      case 'LOW': return 33;
      case 'MEDIUM': return 66;
      case 'HIGH': return 100;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'policy' as TabType, label: 'Risk Politikası', icon: FileText },
    { id: 'appetite' as TabType, label: 'Risk İştahı', icon: Target },
    { id: 'tolerance' as TabType, label: 'Risk Tolerans Seviyeleri', icon: BarChart3 },
    { id: 'roles' as TabType, label: 'Roller ve Sorumluluklar', icon: Users },
    { id: 'approval' as TabType, label: 'Onay Bilgileri', icon: FileCheck }
  ];

  const currentSettings = isEditMode ? editedSettings : settings;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Strateji Belgesi</h1>
          <p className="mt-2 text-gray-600">Risk politikası, iştah ve sorumluluklar</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditMode && isAdmin && (
            <button
              onClick={() => setIsEditMode(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Düzenle
            </button>
          )}
          {isEditMode && (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'policy' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Risk Yönetimi Politikası</h2>
              </div>

              {isEditMode ? (
                <textarea
                  value={currentSettings.policy_text}
                  onChange={(e) =>
                    setEditedSettings({ ...editedSettings, policy_text: e.target.value })
                  }
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Kurumun risk yönetimi politikasını buraya yazın..."
                />
              ) : (
                <div className="prose max-w-none">
                  {currentSettings.policy_text ? (
                    <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-4 rounded-lg">
                      {currentSettings.policy_text}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">
                      Risk politikası henüz tanımlanmamış
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'appetite' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Kurumsal Risk İştahı</h2>
              </div>

              {!isEditMode && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">Mevcut Seviye:</div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-full transition-all duration-500"
                          style={{ width: `${getAppetiteProgress(currentSettings.risk_appetite)}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {getAppetiteLabel(currentSettings.risk_appetite)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'LOW', label: 'DÜŞÜK', description: 'Riskten kaçınma', detail: getAppetiteDescription('LOW') },
                  { value: 'MEDIUM', label: 'ORTA', description: 'Dengeli yaklaşım', detail: getAppetiteDescription('MEDIUM') },
                  { value: 'HIGH', label: 'YÜKSEK', description: 'Risk almaya açık', detail: getAppetiteDescription('HIGH') }
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      currentSettings.risk_appetite === option.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200'
                    } ${isEditMode ? 'cursor-pointer hover:border-blue-300' : ''}`}
                    onClick={() => {
                      if (isEditMode) {
                        setEditedSettings({
                          ...editedSettings,
                          risk_appetite: option.value as 'LOW' | 'MEDIUM' | 'HIGH'
                        });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-gray-900">{option.label}</div>
                      {currentSettings.risk_appetite === option.value && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{option.description}</div>
                    {!isEditMode && currentSettings.risk_appetite === option.value && (
                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        {option.detail}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                {isEditMode ? (
                  <textarea
                    value={currentSettings.risk_appetite_description}
                    onChange={(e) =>
                      setEditedSettings({
                        ...editedSettings,
                        risk_appetite_description: e.target.value
                      })
                    }
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Risk iştahı hakkında ek açıklama..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {currentSettings.risk_appetite_description || (
                      <span className="text-gray-500 italic">
                        {getAppetiteDescription(currentSettings.risk_appetite)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tolerance' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">Risk Tolerans Seviyeleri</h2>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Seviyesi</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Skor Aralığı</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tolerans</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_TOLERANCE_LEVELS.map((level, index) => (
                      <tr key={index} className="border-b border-gray-200 last:border-0">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{level.emoji}</span>
                            <span className="font-medium text-gray-900">{level.level}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{level.scoreRange}</td>
                        <td className="py-3 px-4 text-gray-700">{level.tolerance}</td>
                        <td className="py-3 px-4 text-gray-700">{level.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  Bu tablo risk seviyelerinin genel tanımlarını içerir. Risk kriterleri ve hesaplama yöntemi için
                  <button className="ml-1 font-medium underline hover:text-blue-900">
                    Risk Kriterleri
                  </button> sayfasını ziyaret edin.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Roller ve Sorumluluklar</h2>
              </div>

              {isEditMode ? (
                <textarea
                  value={currentSettings.roles_responsibilities}
                  onChange={(e) =>
                    setEditedSettings({
                      ...editedSettings,
                      roles_responsibilities: e.target.value
                    })
                  }
                  rows={16}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Rol ve sorumlulukları buraya yazın..."
                />
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <div className="space-y-6">
                    {currentSettings.roles_responsibilities.split('\n\n').map((section, index) => {
                      const lines = section.split('\n');
                      const role = lines[0].replace(':', '');
                      const responsibilities = lines.slice(1);

                      return (
                        <div key={index} className="border-b border-gray-300 last:border-0 pb-4 last:pb-0">
                          <div className="font-bold text-gray-900 mb-2">{role}</div>
                          <div className="space-y-1">
                            {responsibilities.map((resp, idx) => (
                              <div key={idx} className="text-gray-700 text-sm pl-4">
                                {resp}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'approval' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Belge Durumu</h2>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Durum:</div>
                    <div className="flex items-center gap-2">
                      {settings.approved_at ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-700">Onaylandı</span>
                        </>
                      ) : settings.id ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                          <span className="font-medium text-yellow-700">Onay Bekliyor</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-gray-600" />
                          <span className="font-medium text-gray-700">Taslak</span>
                        </>
                      )}
                    </div>
                  </div>

                  {settings.approved_at && approverProfile && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Onaylayan:</div>
                      <div className="font-medium text-gray-900">
                        {approverProfile.full_name}
                        {approverProfile.title && (
                          <span className="text-sm text-gray-600 ml-2">
                            ({approverProfile.title})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {settings.approved_at && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Onay Tarihi:</div>
                      <div className="font-medium text-gray-900">
                        {new Date(settings.approved_at).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  )}

                  {settings.updated_at && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Son Güncelleme:</div>
                      <div className="font-medium text-gray-900">
                        {new Date(settings.updated_at).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {settings.id && isAdmin && (
                <div className="flex gap-3">
                  {!settings.approved_at && (
                    <button
                      onClick={handleApprove}
                      disabled={saving}
                      className="btn-primary flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Onaya Gönder
                    </button>
                  )}
                  <button
                    onClick={handleDownloadPDF}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    PDF İndir
                  </button>
                </div>
              )}

              {!settings.id && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    Risk strateji belgesini onaylayabilmek için önce kaydetmelisiniz.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
