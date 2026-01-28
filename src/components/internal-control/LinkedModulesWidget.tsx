import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  GitBranch,
  FileText,
  AlertTriangle,
  Shield,
  FolderOpen,
  RefreshCw,
  TrendingUp,
  CheckCircle
} from 'lucide-react';

interface ModuleCounts {
  surec_yonetimi: number;
  is_akis_semalari: number;
  risk_yonetimi: number;
  hassas_gorevler: number;
  dokuman_yonetimi: number;
}

interface LinkedAction {
  id: string;
  code: string;
  title: string;
  action_type: string;
  linked_module: string | null;
  target_quantity: number | null;
  current_quantity: number | null;
  progress_percent: number;
}

export default function LinkedModulesWidget() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<ModuleCounts>({
    surec_yonetimi: 0,
    is_akis_semalari: 0,
    risk_yonetimi: 0,
    hassas_gorevler: 0,
    dokuman_yonetimi: 0
  });
  const [linkedActions, setLinkedActions] = useState<LinkedAction[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadModuleCounts(),
        loadLinkedActions()
      ]);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModuleCounts = async () => {
    const [processes, workflows, risks, sensitiveTasks, documents] = await Promise.all([
      supabase
        .from('qm_processes')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id),

      supabase
        .from('workflow_processes')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id),

      supabase
        .from('risks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id),

      supabase
        .from('sensitive_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id),

      supabase
        .from('document_library')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id)
    ]);

    setCounts({
      surec_yonetimi: processes.count || 0,
      is_akis_semalari: workflows.count || 0,
      risk_yonetimi: risks.count || 0,
      hassas_gorevler: sensitiveTasks.count || 0,
      dokuman_yonetimi: documents.count || 0
    });
  };

  const loadLinkedActions = async () => {
    const { data } = await supabase
      .from('ic_actions')
      .select('id, code, title, action_type, linked_module, target_quantity, current_quantity, progress_percent')
      .eq('organization_id', profile?.organization_id)
      .eq('action_type', 'baglantili')
      .not('linked_module', 'is', null)
      .order('code');

    if (data) {
      setLinkedActions(data);
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'surec_yonetimi':
        return <GitBranch className="w-5 h-5" />;
      case 'is_akis_semalari':
        return <FileText className="w-5 h-5" />;
      case 'risk_yonetimi':
        return <AlertTriangle className="w-5 h-5" />;
      case 'hassas_gorevler':
        return <Shield className="w-5 h-5" />;
      case 'dokuman_yonetimi':
        return <FolderOpen className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getModuleName = (module: string) => {
    const names: Record<string, string> = {
      surec_yonetimi: 'Süreç Yönetimi',
      is_akis_semalari: 'İş Akış Şemaları',
      risk_yonetimi: 'Risk Yönetimi',
      hassas_gorevler: 'Hassas Görevler',
      dokuman_yonetimi: 'Doküman Yönetimi'
    };
    return names[module] || module;
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      surec_yonetimi: 'bg-blue-500',
      is_akis_semalari: 'bg-purple-500',
      risk_yonetimi: 'bg-red-500',
      hassas_gorevler: 'bg-orange-500',
      dokuman_yonetimi: 'bg-green-500'
    };
    return colors[module] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bağlantılı Modül Sayımları</h3>
              <p className="text-sm text-gray-500">Sistem genelindeki modül kayıt sayıları</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Yenile"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(counts).map(([module, count]) => (
              <div
                key={module}
                className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`${getModuleColor(module)} p-2 rounded-lg text-white`}>
                    {getModuleIcon(module)}
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{count}</span>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {getModuleName(module)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {linkedActions.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bağlantılı Eylemler ve İlerleme</h3>
                <p className="text-sm text-gray-500">Modül sayılarına göre otomatik hesaplanan eylem ilerlemeleri</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {linkedActions.map(action => {
                const progressPercent = action.target_quantity && action.target_quantity > 0
                  ? Math.min(100, Math.round((action.current_quantity || 0) / action.target_quantity * 100))
                  : 0;

                return (
                  <div key={action.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`${getModuleColor(action.linked_module || '')} p-3 rounded-lg text-white flex-shrink-0`}>
                        {getModuleIcon(action.linked_module || '')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-500">{action.code}</span>
                            <span className="text-sm font-semibold text-gray-900">{action.title}</span>
                          </div>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                            {getModuleName(action.linked_module || '')}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Hedef Miktar</div>
                            <div className="text-lg font-bold text-gray-900">{action.target_quantity || 0}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Mevcut Miktar</div>
                            <div className="text-lg font-bold text-blue-900">{action.current_quantity || 0}</div>
                          </div>
                          <div className={`${progressPercent >= 100 ? 'bg-green-50' : 'bg-yellow-50'} rounded-lg p-3`}>
                            <div className="text-xs text-gray-500 mb-1">İlerleme</div>
                            <div className={`text-lg font-bold ${progressPercent >= 100 ? 'text-green-900' : 'text-yellow-900'}`}>
                              %{progressPercent}
                            </div>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              progressPercent >= 100 ? 'bg-green-500' :
                              progressPercent >= 75 ? 'bg-blue-500' :
                              progressPercent >= 50 ? 'bg-yellow-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        {action.target_quantity && action.current_quantity !== null && action.current_quantity < action.target_quantity && (
                          <div className="mt-2 text-xs text-gray-600">
                            <span className="font-medium">Eksik:</span>{' '}
                            {action.target_quantity - action.current_quantity} kayıt daha eklenmeli
                          </div>
                        )}

                        {action.current_quantity && action.target_quantity && action.current_quantity >= action.target_quantity && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Hedef tamamlandı!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {linkedActions.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <FileText className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <p className="text-blue-900 font-medium mb-1">Henüz Bağlantılı Eylem Yok</p>
          <p className="text-sm text-blue-700">
            Modüllere bağlı eylem oluşturduğunuzda burada otomatik sayım ve ilerleme gösterilecektir.
          </p>
        </div>
      )}
    </div>
  );
}
