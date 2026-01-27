import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  ChevronRight, ChevronDown, Plus, Eye, Edit2, Trash2, Send,
  FolderOpen, FileText, File, Search, Filter, Download, Settings
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';

interface Process {
  id: string;
  code: string;
  name: string;
  status: string;
  level: number;
  parent_id: string | null;
  category_id: string;
  category: {
    code: string;
    name: string;
    color: string;
  };
  children?: Process[];
  expanded?: boolean;
}

interface Category {
  id: string;
  code: string;
  name: string;
  color: string;
  icon: string;
}

const statusConfig = {
  draft: { label: 'Taslak', color: 'gray' },
  pending_approval: { label: 'Onay Bekliyor', color: 'yellow' },
  approved: { label: 'Onaylandı', color: 'blue' },
  rejected: { label: 'Reddedildi', color: 'red' },
  active: { label: 'Aktif', color: 'green' },
  inactive: { label: 'Pasif', color: 'orange' }
};

export default function BPMProcessList() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    category: searchParams.get('category') || '',
    status: '',
    department: ''
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isDirector = profile?.role === 'director';

  useEffect(() => {
    if (profile?.organization_id) {
      fetchCategories();
      fetchProcesses();
    }
  }, [profile, filters]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('bpm_categories')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('sort_order');

    if (data) {
      setCategories(data);
    }
  };

  const fetchProcesses = async () => {
    try {
      let query = supabase
        .from('bpm_processes')
        .select(`
          id,
          code,
          name,
          status,
          level,
          parent_id,
          category_id,
          category:bpm_categories(code, name, color)
        `)
        .eq('organization_id', profile?.organization_id);

      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.department) {
        query = query.eq('owner_department_id', filters.department);
      }

      const { data, error } = await query.order('code');

      if (error) throw error;

      if (data) {
        const tree = buildTree(data as any);
        setProcesses(tree);
      }
    } catch (error) {
      console.error('Error fetching processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (flatList: Process[]): Process[] => {
    const map = new Map<string, Process>();
    const roots: Process[] = [];

    flatList.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    flatList.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id) {
        const parent = map.get(item.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedIds(new Set());
    } else {
      const allIds = new Set<string>();
      const collectIds = (items: Process[]) => {
        items.forEach(item => {
          if (item.children && item.children.length > 0) {
            allIds.add(item.id);
            collectIds(item.children);
          }
        });
      };
      collectIds(processes);
      setExpandedIds(allIds);
    }
    setExpandAll(!expandAll);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu süreci silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('bpm_processes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchProcesses();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    if (!confirm('Bu süreci onaya göndermek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('bpm_processes')
        .update({
          status: 'pending_approval',
          submitted_by: profile?.id,
          submitted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      fetchProcesses();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1:
        return FolderOpen;
      case 2:
        return FileText;
      default:
        return File;
    }
  };

  const renderProcess = (process: Process, depth: number = 0) => {
    const hasChildren = process.children && process.children.length > 0;
    const isExpanded = expandedIds.has(process.id);
    const LevelIcon = getLevelIcon(process.level);

    const matchesSearch = !filters.search ||
      process.code.toLowerCase().includes(filters.search.toLowerCase()) ||
      process.name.toLowerCase().includes(filters.search.toLowerCase());

    if (!matchesSearch) return null;

    return (
      <div key={process.id}>
        <div
          className="flex items-center py-3 px-4 hover:bg-gray-50 border-b border-gray-100"
          style={{ paddingLeft: `${depth * 2 + 1}rem` }}
        >
          <div className="flex items-center flex-1 min-w-0">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(process.id)}
                className="mr-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}

            <div
              className="w-1 h-8 mr-3 rounded flex-shrink-0"
              style={{ backgroundColor: process.category.color }}
            />

            <LevelIcon className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-sm font-mono font-semibold text-gray-600 flex-shrink-0">
                {process.code}
              </span>
              <span className="font-medium text-gray-900 truncate">{process.name}</span>
              <span className="text-sm text-gray-500 flex-shrink-0">
                {process.category.name}
              </span>
              <StatusBadge
                status={process.status}
                label={statusConfig[process.status as keyof typeof statusConfig].label}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={() => navigate(`process-management/${process.id}`)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Eye className="w-4 h-4" />
            </button>

            {(isAdmin || isDirector) && process.status === 'draft' && (
              <>
                <button
                  onClick={() => navigate(`process-management/${process.id}/edit`)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSubmitForApproval(process.id)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  title="Onaya Gönder"
                >
                  <Send className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(process.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {(isAdmin || isDirector) && process.status === 'rejected' && (
              <>
                <button
                  onClick={() => navigate(`process-management/${process.id}/edit`)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(process.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {process.children!.map(child => renderProcess(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderCategorySection = (category: Category) => {
    const categoryProcesses = processes.filter(p => p.category_id === category.id);

    if (categoryProcesses.length === 0) return null;

    return (
      <div key={category.id} className="mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-t-lg"
          style={{ backgroundColor: `${category.color}15`, borderLeft: `4px solid ${category.color}` }}
        >
          <span className="font-mono font-bold text-sm">{category.code}</span>
          <h3 className="font-semibold text-gray-900">{category.name}</h3>
          <span className="text-sm text-gray-500">({categoryProcesses.length})</span>
        </div>
        <div className="bg-white shadow rounded-b-lg">
          {categoryProcesses.map(process => renderProcess(process, 0))}
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900">Süreç Listesi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kurumsal süreçleri görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <Button variant="outline" onClick={() => navigate('process-management/categories')}>
              <Settings className="w-4 h-4 mr-2" />
              Kategoriler
            </Button>
          )}
          <Button onClick={() => navigate('process-management/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Süreç
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ara
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Kod veya ad ile ara..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tümü</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durum
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tümü</option>
              {Object.entries(statusConfig).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={toggleExpandAll}
              className="flex-1"
            >
              {expandAll ? 'Tümünü Daralt' : 'Tümünü Genişlet'}
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {processes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Süreç Bulunamadı</h3>
          <p className="mt-1 text-sm text-gray-500">
            Yeni bir süreç ekleyerek başlayın.
          </p>
          <Button className="mt-4" onClick={() => navigate('process-management/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Süreç Ekle
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories
            .filter(cat => !filters.category || cat.id === filters.category)
            .map(cat => renderCategorySection(cat))}
        </div>
      )}
    </div>
  );
}