import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import Button from '../components/ui/Button';

interface ApprovalProcess {
  id: string;
  code: string;
  name: string;
  submitted_at: string;
  category: {
    name: string;
    color: string;
  };
  submitted_by_profile: {
    full_name: string;
  };
  owner_department: {
    name: string;
  } | null;
}

export default function BPMApprovals() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [processes, setProcesses] = useState<ApprovalProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.organization_id) {
      fetchPendingProcesses();
    }
  }, [profile]);

  const fetchPendingProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('bpm_processes')
        .select(`
          id,
          code,
          name,
          submitted_at,
          category:bpm_categories(name, color),
          submitted_by_profile:profiles!bpm_processes_submitted_by_fkey(full_name),
          owner_department:departments(name)
        `)
        .eq('organization_id', profile?.organization_id)
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      setProcesses(data as any || []);
    } catch (error) {
      console.error('Error fetching pending processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === processes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processes.map(p => p.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      alert('Lütfen en az bir süreç seçin');
      return;
    }

    if (!confirm(`Seçili ${selectedIds.size} süreci onaylamak istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const updates = Array.from(selectedIds).map(id =>
        supabase
          .from('bpm_processes')
          .update({
            status: 'approved',
            reviewed_by: profile?.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', id)
      );

      await Promise.all(updates);
      setSelectedIds(new Set());
      fetchPendingProcesses();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) {
      alert('Lütfen en az bir süreç seçin');
      return;
    }

    const reason = prompt('Red nedeni:');
    if (!reason?.trim()) return;

    try {
      const updates = Array.from(selectedIds).map(id =>
        supabase
          .from('bpm_processes')
          .update({
            status: 'rejected',
            reviewed_by: profile?.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason
          })
          .eq('id', id)
      );

      await Promise.all(updates);
      setSelectedIds(new Set());
      fetchPendingProcesses();
    } catch (error: any) {
      alert(error.message);
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
          <h1 className="text-2xl font-bold text-gray-900">Onay Bekleyen Süreçler</h1>
          <p className="mt-1 text-sm text-gray-500">
            Onay bekleyen süreçleri inceleyin ve onaylayın
          </p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex gap-3">
            <Button onClick={handleBulkApprove}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Seçilenleri Onayla ({selectedIds.size})
            </Button>
            <Button variant="outline" onClick={handleBulkReject}>
              <XCircle className="w-4 h-4 mr-2" />
              Seçilenleri Reddet ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {processes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Onay Bekleyen Süreç Yok</h3>
          <p className="mt-1 text-sm text-gray-500">
            Şu anda onayınızı bekleyen süreç bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === processes.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kod
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Süreç Adı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Birim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gönderen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tarih
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processes.map((process) => (
                <tr key={process.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(process.id)}
                      onChange={() => handleSelect(process.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-semibold text-gray-900">
                      {process.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{process.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: process.category.color }}
                      />
                      <span className="text-sm text-gray-900">{process.category.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {process.owner_department?.name || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {process.submitted_by_profile?.full_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {new Date(process.submitted_at).toLocaleDateString('tr-TR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" onClick={() => navigate(`process-management/${process.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      İncele
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}