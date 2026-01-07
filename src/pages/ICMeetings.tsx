import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Calendar, MapPin, Users, FileText, CheckCircle, Clock, Plus, Eye, Edit, Send, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Meeting {
  id: string;
  year: number;
  meeting_number: number;
  meeting_date: string;
  meeting_time: string;
  location: string;
  chairman_name: string;
  chairman_title: string;
  status: 'planned' | 'completed' | 'cancelled';
  created_at: string;
  participant_count?: number;
  attended_count?: number;
  agenda_count?: number;
  decision_count?: number;
  completed_decision_count?: number;
  pending_decision_count?: number;
}

interface Stats {
  totalMeetings: number;
  completedMeetings: number;
  totalDecisions: number;
  pendingDecisions: number;
}

export default function ICMeetings() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMeetings: 0,
    completedMeetings: 0,
    totalDecisions: 0,
    pendingDecisions: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (profile?.organization_id) {
      loadMeetings();
    }
  }, [profile, selectedYear, selectedStatus]);

  const loadMeetings = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      let query = supabase
        .from('ic_meetings')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (selectedYear !== 0) {
        query = query.eq('year', selectedYear);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      query = query.order('meeting_date', { ascending: false });

      const { data: meetingsData, error: meetingsError } = await query;

      if (meetingsError) throw meetingsError;

      const meetingsWithCounts = await Promise.all(
        (meetingsData || []).map(async (meeting) => {
          const [participantsResult, agendaResult, decisionsResult] = await Promise.all([
            supabase
              .from('ic_meeting_participants')
              .select('id, attended', { count: 'exact' })
              .eq('meeting_id', meeting.id),
            supabase
              .from('ic_meeting_agenda_items')
              .select('id', { count: 'exact' })
              .eq('meeting_id', meeting.id),
            supabase
              .from('ic_meeting_decisions')
              .select('id, status', { count: 'exact' })
              .eq('meeting_id', meeting.id)
          ]);

          const attendedCount = participantsResult.data?.filter(p => p.attended).length || 0;
          const completedDecisions = decisionsResult.data?.filter(d => d.status === 'completed').length || 0;
          const pendingDecisions = decisionsResult.data?.filter(d => d.status === 'pending' || d.status === 'in_progress').length || 0;

          return {
            ...meeting,
            participant_count: participantsResult.count || 0,
            attended_count: attendedCount,
            agenda_count: agendaResult.count || 0,
            decision_count: decisionsResult.count || 0,
            completed_decision_count: completedDecisions,
            pending_decision_count: pendingDecisions
          };
        })
      );

      setMeetings(meetingsWithCounts);

      const totalMeetings = meetingsWithCounts.filter(m => m.year === new Date().getFullYear()).length;
      const completedMeetings = meetingsWithCounts.filter(m => m.status === 'completed' && m.year === new Date().getFullYear()).length;
      const totalDecisions = meetingsWithCounts.reduce((sum, m) => sum + (m.decision_count || 0), 0);
      const pendingDecisions = meetingsWithCounts.reduce((sum, m) => sum + (m.pending_decision_count || 0), 0);

      setStats({
        totalMeetings,
        completedMeetings,
        totalDecisions,
        pendingDecisions
      });

    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> Tamamlandı
        </span>;
      case 'planned':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          <Calendar className="w-4 h-4" /> Planlanan
        </span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
          <AlertCircle className="w-4 h-4" /> İptal
        </span>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">İKİYK Toplantıları</h1>
          <p className="text-slate-600 mt-1">İç Kontrol İzleme ve Yönlendirme Kurulu</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
          <button
            onClick={() => navigate('internal-control/ikyk/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Yeni Toplantı Planla
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-2">Yıl</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={0}>Tüm Yıllar</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-2">Durum</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tümü</option>
            <option value="planned">Planlanan</option>
            <option value="completed">Tamamlanan</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">{new Date().getFullYear()} Yılı</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalMeetings}</p>
              <p className="text-sm text-slate-500 mt-1">Toplantı</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Tamamlanan</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.completedMeetings}</p>
              <p className="text-sm text-slate-500 mt-1">Toplantı</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Alınan Karar</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalDecisions}</p>
              <p className="text-sm text-slate-500 mt-1">Karar</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Bekleyen</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.pendingDecisions}</p>
              <p className="text-sm text-slate-500 mt-1">Karar</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Yükleniyor...</p>
        </Card>
      ) : meetings.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Henüz toplantı kaydı bulunmuyor</p>
          <p className="text-slate-500 text-sm mt-2">İlk toplantıyı oluşturmak için yukarıdaki butonu kullanın</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {meeting.year}/{meeting.meeting_number} - {meeting.meeting_number}. Olağan Toplantı
                    </h3>
                    {getStatusBadge(meeting.status)}
                  </div>

                  <div className="flex items-center gap-6 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(meeting.meeting_date)} {meeting.meeting_time && formatTime(meeting.meeting_time)}
                    </div>
                    {meeting.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {meeting.location}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {meeting.chairman_name} ({meeting.chairman_title || 'Başkan'})
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-slate-600">
                      Gündem: <span className="font-semibold text-slate-900">{meeting.agenda_count || 0} madde</span>
                    </span>
                    {meeting.status === 'completed' && (
                      <>
                        <span className="text-slate-600">
                          Katılım: <span className="font-semibold text-slate-900">{meeting.attended_count}/{meeting.participant_count}</span>
                          {meeting.participant_count > 0 && (
                            <span className="text-slate-500 ml-1">
                              (%{Math.round((meeting.attended_count || 0) / meeting.participant_count * 100)})
                            </span>
                          )}
                        </span>
                        <span className="text-slate-600">
                          Karar: <span className="font-semibold text-slate-900">{meeting.decision_count || 0} adet</span>
                        </span>
                      </>
                    )}
                    {meeting.status === 'planned' && (
                      <span className="text-slate-600">
                        Davetli: <span className="font-semibold text-slate-900">{meeting.participant_count || 0} kişi</span>
                      </span>
                    )}
                  </div>

                  {meeting.status === 'completed' && meeting.decision_count > 0 && (
                    <div className="mt-3 text-sm">
                      <span className="text-slate-600">
                        Kararlar: <span className="text-green-600 font-medium">{meeting.completed_decision_count} tamamlandı</span>
                        {meeting.pending_decision_count > 0 && (
                          <>, <span className="text-orange-600 font-medium">{meeting.pending_decision_count} bekliyor</span></>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => navigate(`internal-control/ikyk/${meeting.id}`)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Görüntüle
                  </button>
                  {meeting.status === 'planned' && (profile?.role === 'admin' || profile?.role === 'super_admin') && (
                    <>
                      <button
                        onClick={() => navigate(`internal-control/ikyk/${meeting.id}/edit`)}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Düzenle
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Davet Gönder
                      </button>
                    </>
                  )}
                  {meeting.status === 'completed' && (
                    <button
                      onClick={() => navigate(`internal-control/ikyk/${meeting.id}/minutes`)}
                      className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Tutanak
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
