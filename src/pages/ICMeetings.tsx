import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users } from 'lucide-react';

export default function ICMeetings() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadMeetings();
    }
  }, [profile?.organization_id]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('ikyk_meetings')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Toplantılar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PLANNED: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PLANNED: 'Planlandı',
      COMPLETED: 'Gerçekleşti',
      CANCELLED: 'İptal Edildi',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" />
          İKİYK Toplantıları
        </h1>
        <p className="text-slate-600 mt-2">
          İç Kontrol İzleme ve Yönlendirme Kurulu toplantılarını yönetin
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Toplantı No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarih</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Yer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Başkan</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Durum</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {meetings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Henüz toplantı kaydı bulunmuyor
                </td>
              </tr>
            ) : (
              meetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    #{meeting.meeting_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(meeting.meeting_date).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {meeting.location || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {meeting.chairperson || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(meeting.status)}`}>
                      {getStatusLabel(meeting.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
