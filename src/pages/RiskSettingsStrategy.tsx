import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  Users
} from 'lucide-react';

interface RiskStrategy {
  id?: string;
  policy_text: string;
  risk_appetite: 'low' | 'medium' | 'high';
  tolerance_levels: any;
  roles_responsibilities: any;
  approval_status: string;
  approved_by?: string;
  approved_at?: string;
}

export default function RiskSettingsStrategy() {
  const { profile } = useAuth();
  const [strategy, setStrategy] = useState<RiskStrategy>({
    policy_text: '',
    risk_appetite: 'medium',
    tolerance_levels: {
      critical: 'Kabul edilemez - Acil eylem gerekli',
      high: 'Yüksek öncelik - Azaltma planı gerekli',
      medium: 'İzleme gerekli - Kontrollü kabul edilebilir',
      low: 'Kabul edilebilir - Düzenli gözlem'
    },
    roles_responsibilities: [
      { role: 'Üst Yönetim', responsibility: 'Risk politikası onayı, strateji belirleme' },
      { role: 'Risk Koordinatörü', responsibility: 'Risk yönetim sistemini koordine etme' },
      { role: 'Risk Sahipleri', responsibility: 'Risk değerlendirme ve azaltma faaliyetleri' },
      { role: 'Birim Yöneticileri', responsibility: 'Birim bazlı risk tanımlama ve raporlama' }
    ],
    approval_status: 'draft'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadStrategy();
  }, [profile?.organization_id]);

  const loadStrategy = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('risk_strategy')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setStrategy(data);
      }
    } catch (error) {
      console.error('Error loading strategy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const orgId = profile?.organization_id;
      if (!orgId) return;

      const dataToSave = {
        ...strategy,
        organization_id: orgId,
        updated_at: new Date().toISOString()
      };

      let error;
      if (strategy.id) {
        const result = await supabase
          .from('risk_strategy')
          .update(dataToSave)
          .eq('id', strategy.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('risk_strategy')
          .insert([dataToSave])
          .select()
          .single();
        error = result.error;
        if (result.data) {
          setStrategy(result.data);
        }
      }

      if (error) throw error;

      setMessage({ type: 'success', text: 'Risk stratejisi başarıyla kaydedildi' });
    } catch (error) {
      console.error('Error saving strategy:', error);
      setMessage({ type: 'error', text: 'Kaydetme sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!strategy.id) {
        setMessage({ type: 'error', text: 'Önce stratejiyi kaydetmelisiniz' });
        return;
      }

      const { error } = await supabase
        .from('risk_strategy')
        .update({
          approval_status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', strategy.id);

      if (error) throw error;

      setStrategy({
        ...strategy,
        approval_status: 'approved',
        approved_by: profile?.id,
        approved_at: new Date().toISOString()
      });

      setMessage({ type: 'success', text: 'Risk stratejisi onaylandı' });
    } catch (error) {
      console.error('Error approving strategy:', error);
      setMessage({ type: 'error', text: 'Onaylama sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const addRole = () => {
    setStrategy({
      ...strategy,
      roles_responsibilities: [
        ...strategy.roles_responsibilities,
        { role: '', responsibility: '' }
      ]
    });
  };

  const updateRole = (index: number, field: 'role' | 'responsibility', value: string) => {
    const updated = [...strategy.roles_responsibilities];
    updated[index][field] = value;
    setStrategy({ ...strategy, roles_responsibilities: updated });
  };

  const removeRole = (index: number) => {
    const updated = strategy.roles_responsibilities.filter((_: any, i: number) => i !== index);
    setStrategy({ ...strategy, roles_responsibilities: updated });
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
          <h1 className="text-3xl font-bold text-gray-900">Risk Strateji Belgesi</h1>
          <p className="mt-2 text-gray-600">
            Risk yönetim politikası, iştah ve rol tanımları
          </p>
        </div>
        <div className="flex items-center gap-3">
          {strategy.approval_status === 'approved' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Onaylı</span>
            </div>
          )}
          {strategy.approval_status === 'draft' && profile?.role === 'admin' && (
            <button
              onClick={handleApprove}
              disabled={saving}
              className="btn-secondary flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Onayla
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
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

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Risk Politikası</h2>
          </div>
          <textarea
            value={strategy.policy_text}
            onChange={(e) => setStrategy({ ...strategy, policy_text: e.target.value })}
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Kurum risk yönetim politikası metnini buraya yazınız..."
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Risk İştahı</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: 'low', label: 'Düşük', description: 'Minimum risk kabul edilebilir' },
              { value: 'medium', label: 'Orta', description: 'Kontrollü risk kabul edilebilir' },
              { value: 'high', label: 'Yüksek', description: 'Yüksek getiri için risk kabul edilir' }
            ].map((option) => (
              <label
                key={option.value}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  strategy.risk_appetite === option.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="risk_appetite"
                  value={option.value}
                  checked={strategy.risk_appetite === option.value}
                  onChange={(e) => setStrategy({ ...strategy, risk_appetite: e.target.value as any })}
                  className="sr-only"
                />
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600 mt-1">{option.description}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Risk Tolerans Seviyeleri</h3>
          <div className="space-y-3">
            {Object.entries(strategy.tolerance_levels || {}).map(([level, description]) => (
              <div key={level} className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700 capitalize">{level}:</span>
                </div>
                <input
                  type="text"
                  value={description as string}
                  onChange={(e) => setStrategy({
                    ...strategy,
                    tolerance_levels: { ...strategy.tolerance_levels, [level]: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Roller ve Sorumluluklar</h2>
            </div>
            <button
              onClick={addRole}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Yeni Rol Ekle
            </button>
          </div>
          <div className="space-y-3">
            {strategy.roles_responsibilities?.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="text"
                  value={item.role}
                  onChange={(e) => updateRole(index, 'role', e.target.value)}
                  placeholder="Rol"
                  className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <input
                  type="text"
                  value={item.responsibility}
                  onChange={(e) => updateRole(index, 'responsibility', e.target.value)}
                  placeholder="Sorumluluk"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={() => removeRole(index)}
                  className="text-red-600 hover:text-red-700 px-2"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        </div>

        {strategy.approval_status === 'approved' && strategy.approved_at && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <div>
                <span className="font-medium">Onay Durumu:</span> Onaylandı
              </div>
              <div className="mt-1">
                <span className="font-medium">Onay Tarihi:</span>{' '}
                {new Date(strategy.approved_at).toLocaleDateString('tr-TR')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
