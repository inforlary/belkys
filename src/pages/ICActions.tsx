import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Search,
  Filter,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText
} from 'lucide-react';

interface Action {
  id: string;
  code: string;
  action_name: string;
  status: string;
  start_date: string;
  end_date: string;
  responsible_person: string;
  main_standard_id: string;
  sub_standard_id: string;
  created_at: string;
  ic_action_plans?: {
    plan_name: string;
  };
  ic_kiks_main_standards?: {
    code: string;
    name: string;
  };
  ic_kiks_sub_standards?: {
    code: string;
    name: string;
  };
}

export default function ICActions() {
  const { user, profile } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'active' | 'overdue' | 'upcoming'>('all');

  useEffect(() => {
    fetchActions();
  }, [user, profile]);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('ic_actions')
        .select(`
          *,
          ic_action_plans(plan_name),
          ic_kiks_main_standards(code, name),
          ic_kiks_sub_standards(code, name)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'TAMAMLANDI':
        return {
          label: 'Tamamlandı',
          color: 'text-green-700 bg-green-50',
          icon: CheckCircle2
        };
      case 'DEVAM_EDIYOR':
      case 'BASLADI':
        return {
          label: 'Devam Ediyor',
          color: 'text-blue-700 bg-blue-50',
          icon: Clock
        };
      case 'PLANLANMADI':
      case 'BEKLEMEDE':
        return {
          label: 'Beklemede',
          color: 'text-gray-700 bg-gray-50',
          icon: Clock
        };
      default:
        return {
          label: status,
          color: 'text-gray-700 bg-gray-50',
          icon: FileText
        };
    }
  };

  const isOverdue = (endDate: string, status: string) => {
    if (status === 'TAMAMLANDI') return false;
    const today = new Date();
    const end = new Date(endDate);
    return end < today;
  };

  const filteredActions = actions.filter(action => {
    const matchesSearch =
      action.action_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.responsible_person?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || action.status === statusFilter;

    const today = new Date();
    const endDate = new Date(action.end_date);
    const startDate = new Date(action.start_date);
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const matchesDate =
      dateFilter === 'all' ||
      (dateFilter === 'active' && startDate <= today && endDate >= today) ||
      (dateFilter === 'overdue' && isOverdue(action.end_date, action.status)) ||
      (dateFilter === 'upcoming' && daysUntilStart > 0 && daysUntilStart <= 30);

    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tüm Eylemler</h1>
        <p className="mt-2 text-gray-600">
          Kurumunuzdaki tüm iç kontrol eylemlerinin toplu görünümü
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Eylem ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="TAMAMLANDI">Tamamlandı</option>
            <option value="DEVAM_EDIYOR">Devam Ediyor</option>
            <option value="BASLADI">Başladı</option>
            <option value="BEKLEMEDE">Beklemede</option>
            <option value="PLANLANMADI">Planlanmadı</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Tarihler</option>
            <option value="active">Aktif</option>
            <option value="overdue">Gecikmiş</option>
            <option value="upcoming">Yaklaşan (30 gün)</option>
          </select>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>{filteredActions.length} eylem</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Kod
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Eylem Adı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Standart
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sorumlu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tarih
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredActions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Eylem bulunamadı
                  </td>
                </tr>
              ) : (
                filteredActions.map((action) => {
                  const statusInfo = getStatusInfo(action.status);
                  const StatusIcon = statusInfo.icon;
                  const overdue = isOverdue(action.end_date, action.status);

                  return (
                    <tr key={action.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {action.code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {action.action_name}
                        </div>
                        {action.ic_action_plans && (
                          <div className="text-xs text-gray-500 mt-1">
                            Plan: {action.ic_action_plans.plan_name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {action.ic_kiks_main_standards?.code}
                        </div>
                        {action.ic_kiks_sub_standards && (
                          <div className="text-xs text-gray-500 mt-1">
                            {action.ic_kiks_sub_standards.code}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <User className="w-4 h-4 text-gray-400" />
                          {action.responsible_person}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-gray-900">
                              {new Date(action.start_date).toLocaleDateString('tr-TR')}
                            </div>
                            <div className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {new Date(action.end_date).toLocaleDateString('tr-TR')}
                              {overdue && ' (Gecikmiş)'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                        {overdue && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-red-700 bg-red-50">
                              <AlertTriangle className="w-3 h-3" />
                              Gecikmiş
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
