import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  GitBranch, FileText, CheckCircle, Clock, GitMerge, AlertCircle,
  TrendingUp, Eye, Edit2, Plus
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';

interface Stats {
  total: number;
  active: number;
  pending: number;
  withWorkflow: number;
}

interface Category {
  id: string;
  code: string;
  name: string;
  color: string;
  icon: string;
  processCount: number;
}

interface Process {
  id: string;
  code: string;
  name: string;
  status: string;
  category: {
    name: string;
    color: string;
  };
  created_at: string;
}

const statusConfig = {
  draft: { label: 'Taslak', color: 'gray' },
  pending_approval: { label: 'Onay Bekliyor', color: 'yellow' },
  approved: { label: 'Onaylandı', color: 'blue' },
  rejected: { label: 'Reddedildi', color: 'red' },
  active: { label: 'Aktif', color: 'green' },
  inactive: { label: 'Pasif', color: 'orange' }
};

export default function BPMDashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, withWorkflow: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentProcesses, setRecentProcesses] = useState<Process[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchStats(),
        fetchCategories(),
        fetchRecentProcesses(),
        isAdmin && fetchPendingApprovals()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const { data: processes } = await supabase
      .from('bpm_processes')
      .select('status, workflow_process_id')
      .eq('organization_id', profile?.organization_id);

    if (processes) {
      setStats({
        total: processes.length,
        active: processes.filter(p => p.status === 'active').length,
        pending: processes.filter(p => p.status === 'pending_approval').length,
        withWorkflow: processes.filter(p => p.workflow_process_id !== null).length
      });
    }
  };

  const fetchCategories = async () => {
    const { data: cats } = await supabase
      .from('bpm_categories')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('sort_order');

    if (cats) {
      const categoriesWithCount = await Promise.all(
        cats.map(async (cat) => {
          const { count } = await supabase
            .from('bpm_processes')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id);

          return {
            ...cat,
            processCount: count || 0
          };
        })
      );

      setCategories(categoriesWithCount);
    }
  };

  const fetchRecentProcesses = async () => {
    const { data } = await supabase
      .from('bpm_processes')
      .select(`
        id,
        code,
        name,
        status,
        created_at,
        category:bpm_categories(name, color)
      `)
      .eq('organization_id', profile?.organization_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setRecentProcesses(data as any);
    }
  };

  const fetchPendingApprovals = async () => {
    const { data } = await supabase
      .from('bpm_processes')
      .select(`
        id,
        code,
        name,
        status,
        created_at,
        category:bpm_categories(name, color)
      `)
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'pending_approval')
      .order('submitted_at', { ascending: true })
      .limit(5);

    if (data) {
      setPendingApprovals(data as any);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Süreç Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kurumsal süreç yönetimi ve iş akışları
          </p>
        </div>
        <Button onClick={() => navigate('process-management/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Süreç
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <GitBranch className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Toplam Süreç</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aktif Süreç</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <Clock className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Onay Bekleyen</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <GitMerge className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">İş Akışı Bağlı</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.withWorkflow}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Kategoriler</h2>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate('process-management/categories')}>
              <Edit2 className="w-4 h-4 mr-2" />
              Kategori Yönet
            </Button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Kategori Yok</h3>
            <p className="mt-1 text-sm text-gray-500">
              Başlamak için kategori ekleyin.
            </p>
            {isAdmin && (
              <Button className="mt-4" onClick={() => navigate('process-management/categories')}>
                Kategori Ekle
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                onClick={() => navigate(`process-management/list?category=${category.id}`)}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
                style={{ borderLeft: `4px solid ${category.color}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      {category.code}
                    </span>
                    <h3 className="font-semibold text-gray-900 mt-1">{category.name}</h3>
                  </div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: category.color }}
                  >
                    {category.processCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && pendingApprovals.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Onay Bekleyen Süreçler</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('process-management/approvals')}>
                Tümünü Gör
              </Button>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingApprovals.map((process) => (
              <div key={process.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-semibold text-gray-600">
                        {process.code}
                      </span>
                      <h3 className="font-medium text-gray-900">{process.name}</h3>
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: process.category.color }}
                      />
                      <span className="text-sm text-gray-500">{process.category.name}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`process-management/${process.id}`)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Görüntüle
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Son Eklenen Süreçler</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('process-management/list')}>
              Tümünü Gör
            </Button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentProcesses.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Henüz süreç eklenmemiş
            </div>
          ) : (
            recentProcesses.map((process) => (
              <div key={process.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-semibold text-gray-600">
                        {process.code}
                      </span>
                      <h3 className="font-medium text-gray-900">{process.name}</h3>
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: process.category.color }}
                      />
                      <span className="text-sm text-gray-500">{process.category.name}</span>
                      <StatusBadge
                        status={process.status}
                        label={statusConfig[process.status as keyof typeof statusConfig].label}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(process.created_at).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`process-management/${process.id}`)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Görüntüle
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}