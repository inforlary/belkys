import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import {
  Users,
  Plus,
  Calendar,
  MapPin,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';

interface Meeting {
  id: string;
  meeting_number: number;
  meeting_date: string;
  location: string | null;
  chairperson: string;
  minutes_url: string | null;
  status: string;
  created_at: string;
  attendees_count?: number;
  decisions_count?: number;
}

const statusLabels: Record<string, string> = {
  planned: 'Planlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const statusColors: Record<string, string> = {
  planned: 'blue',
  completed: 'green',
  cancelled: 'gray',
};

export default function ICIKYKMeetings() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [meetingNumber, setMeetingNumber] = useState(1);
  const [meetingDate, setMeetingDate] = useState('');
  const [location, setLocation] = useState('');
  const [chairperson, setChairperson] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, [profile]);

  const loadMeetings = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('ic_ikyk_meetings')
        .select(`
          *,
          attendees:ic_meeting_attendees(count),
          decisions:ic_meeting_decisions(count)
        `)
        .eq('organization_id', profile.organization_id)
        .order('meeting_date', { ascending: false });

      if (error) throw error;

      const meetingsWithCounts = data?.map(meeting => ({
        ...meeting,
        attendees_count: meeting.attendees?.[0]?.count || 0,
        decisions_count: meeting.decisions?.[0]?.count || 0,
      })) || [];

      setMeetings(meetingsWithCounts);

      if (data && data.length > 0) {
        const maxNumber = Math.max(...data.map(m => m.meeting_number));
        setMeetingNumber(maxNumber + 1);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async () => {
    if (!profile?.organization_id || !profile?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ic_ikyk_meetings')
        .insert({
          organization_id: profile.organization_id,
          meeting_number: meetingNumber,
          meeting_date: meetingDate,
          location: location || null,
          chairperson: chairperson,
          status: 'planned',
          created_by: profile.id
        });

      if (error) throw error;

      setShowNewModal(false);
      resetForm();
      await loadMeetings();
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      if (error.code === '23505') {
        alert('Bu toplantı numarası zaten kullanılıyor');
      } else {
        alert('Toplantı oluşturulurken hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm('Bu toplantıyı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_ikyk_meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Toplantı silinirken hata oluştu');
    }
  };

  const resetForm = () => {
    setMeetingDate('');
    setLocation('');
    setChairperson('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            İKİYK Toplantıları
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            İç Kontrol İzleme ve Yönlendirme Kurulu Toplantıları
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Yeni Toplantı
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Henüz toplantı yok
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            İKİYK toplantısı planlayarak başlayın
          </p>
          {isAdmin && (
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              İlk Toplantıyı Planla
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(meeting.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Toplantı #{meeting.meeting_number}
                    </h3>
                    <StatusBadge
                      status={meeting.status}
                      label={statusLabels[meeting.status]}
                      variant={statusColors[meeting.status] as any}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(meeting.meeting_date).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {meeting.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{meeting.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>Başkan: {meeting.chairperson}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>{meeting.decisions_count} Karar</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/ic-ikyk-meetings/${meeting.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Detaylar
                </Button>
                {isAdmin && meeting.status === 'planned' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/ic-ikyk-meetings/${meeting.id}/edit`)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Düzenle
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteMeeting(meeting.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Sil
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <Modal
          isOpen={showNewModal}
          onClose={() => {
            setShowNewModal(false);
            resetForm();
          }}
          title="Yeni Toplantı"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Toplantı Numarası
              </label>
              <input
                type="number"
                value={meetingNumber}
                onChange={(e) => setMeetingNumber(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Toplantı Tarihi
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yer
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Toplantı yeri"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Toplantı Başkanı
              </label>
              <input
                type="text"
                value={chairperson}
                onChange={(e) => setChairperson(e.target.value)}
                placeholder="Başkan adı"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewModal(false);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button
                onClick={createMeeting}
                disabled={!meetingDate || !chairperson || saving}
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
