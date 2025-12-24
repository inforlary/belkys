import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { CheckCircle, XCircle, Clock, Search } from 'lucide-react';

interface DataEntry {
  id: string;
  indicator_id: string;
  value: number;
  entry_date: string;
  period_type: string;
  period_year: number;
  period_month: number | null;
  period_quarter: number | null;
  notes: string | null;
  status: string;
  entered_by: string;
  indicators: {
    code: string;
    name: string;
    unit: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function DataApprovals() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const getDefaultStatus = () => {
    if (profile?.role === 'admin' || profile?.role === 'vice_president') {
      return 'pending_admin';
    }
    return 'pending_director';
  };

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [initialized, setInitialized] = useState(false);

  const months = [
    { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
    { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
    { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
    { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' }
  ];

  useEffect(() => {
    if (profile && !initialized) {
      const defaultStatus = getDefaultStatus();
      setStatusFilter(defaultStatus);
      setInitialized(true);
    }
  }, [profile?.role, initialized]);

  useEffect(() => {
    if (profile && statusFilter) {
      loadEntries();
    }
  }, [statusFilter]);

  const loadEntries = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    const isDirector = profile.role === 'director';
    const isAdmin = profile.role === 'admin' || profile.role === 'vice_president';

    if (!isDirector && !isAdmin) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      console.log('=== LOADING ENTRIES DEBUG ===');
      console.log('Profile:', {
        role: profile.role,
        organization_id: profile.organization_id,
        department_id: profile.department_id
      });
      console.log('Status Filter:', statusFilter);
      console.log('Is Director:', isDirector);
      console.log('Is Admin:', isAdmin);

      let query = supabase
        .from('indicator_data_entries')
        .select(`
          *,
          indicators(code, name, unit),
          profiles!indicator_data_entries_entered_by_fkey(full_name, email)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('status', statusFilter)
        .order('entry_date', { ascending: false });

      if (isDirector && profile.department_id) {
        console.log('Adding department filter:', profile.department_id);
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;

      console.log('Query result:', { data, error });
      console.log('Number of entries found:', data?.length || 0);

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (entryId: string) => {
    if (!confirm('Bu veri girişini onaylamak istediğinizden emin misiniz?')) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const isDirector = profile?.role === 'director';
      const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

      if (isDirector && entry.status === 'pending_director') {
        const { error } = await supabase
          .from('indicator_data_entries')
          .update({
            status: 'pending_admin',
            director_approved_by: profile?.id,
            director_approved_at: new Date().toISOString()
          })
          .eq('id', entryId);

        if (error) throw error;
        await loadEntries();
        alert('Veri yönetici onayına gönderildi');
      } else if (isAdmin && entry.status === 'pending_admin') {
        const { error } = await supabase
          .from('indicator_data_entries')
          .update({
            status: 'approved',
            reviewed_by: profile?.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', entryId);

        if (error) throw error;
        await loadEntries();
        alert('Veri başarıyla onaylandı');
      } else {
        alert('Bu veriyi onaylama yetkiniz yok');
        return;
      }
    } catch (error: any) {
      alert(error.message || 'Onaylama başarısız');
    }
  };

  const handleReject = async (entryId: string) => {
    const reason = prompt('Red nedeni:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('indicator_data_entries')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', entryId);

      if (error) throw error;
      await loadEntries();
      alert('Veri reddedildi');
    } catch (error: any) {
      alert(error.message || 'Red işlemi başarısız');
    }
  };

  const getPeriodLabel = (entry: DataEntry) => {
    if (entry.period_type === 'monthly') {
      return `${months[entry.period_month! - 1].label} ${entry.period_year}`;
    } else if (entry.period_type === 'quarterly') {
      return `${entry.period_quarter}. Çeyrek ${entry.period_year}`;
    } else {
      return `${entry.period_year}`;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; color: string; text: string }> = {
      draft: { icon: Clock, color: 'bg-slate-100 text-slate-700', text: 'Taslak' },
      pending_director: { icon: Clock, color: 'bg-yellow-100 text-yellow-700', text: 'Müdür Onayında' },
      pending_admin: { icon: Clock, color: 'bg-blue-100 text-blue-700', text: 'Yönetici Onayında' },
      approved: { icon: CheckCircle, color: 'bg-green-100 text-green-700', text: 'Onaylandı' },
      rejected: { icon: XCircle, color: 'bg-red-100 text-red-700', text: 'Reddedildi' }
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  const filteredEntries = entries.filter(entry =>
    entry.indicators.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.indicators.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  const isDirector = profile?.role === 'director';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  if (!isDirector && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardBody>
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-slate-600">
                Bu sayfaya erişim yetkiniz yok. Sadece müdürler ve yöneticiler veri onaylayabilir.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Veri Onayları</h1>
        <p className="text-slate-600 mt-1">
          Gönderilen veri girişlerini inceleyin ve onaylayın
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Gösterge veya kullanıcı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {isDirector && (
            <option value="pending_director">Müdür Onayı Bekleyenler</option>
          )}
          {isAdmin && (
            <option value="pending_admin">Yönetici Onayı Bekleyenler</option>
          )}
          <option value="approved">Onaylananlar</option>
          <option value="rejected">Reddedilenler</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {statusFilter === 'pending_director' && 'Müdür Onayı Bekleyen Girişler'}
            {statusFilter === 'pending_admin' && 'Yönetici Onayı Bekleyen Girişler'}
            {statusFilter === 'approved' && 'Onaylanan Girişler'}
            {statusFilter === 'rejected' && 'Reddedilen Girişler'}
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Gösterilecek veri yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Gösterge
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Periyot
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Değer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Giren Kişi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{entry.indicators.code}</div>
                        <div className="text-sm text-slate-600">{entry.indicators.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {getPeriodLabel(entry)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-lg font-bold text-blue-600">
                          {entry.value} {entry.indicators.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-slate-900">{entry.profiles.full_name}</div>
                        <div className="text-slate-500">{entry.profiles.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {((isDirector && entry.status === 'pending_director') ||
                          (isAdmin && entry.status === 'pending_admin')) && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(entry.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Onayla
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(entry.id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reddet
                            </Button>
                          </div>
                        )}
                        {entry.status !== 'pending_director' && entry.status !== 'pending_admin' && (
                          <span className="text-sm text-slate-500">
                            {new Date(entry.entry_date).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <div className="text-center">
                <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">
                  {entries.filter(e =>
                    e.status === 'pending_director' || e.status === 'pending_admin'
                  ).length}
                </div>
                <div className="text-sm text-slate-600">Onay Bekleyen</div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">
                  {entries.filter(e => e.status === 'approved').length}
                </div>
                <div className="text-sm text-slate-600">Onaylanan</div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-center">
                <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">
                  {entries.filter(e => e.status === 'rejected').length}
                </div>
                <div className="text-sm text-slate-600">Reddedilen</div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
