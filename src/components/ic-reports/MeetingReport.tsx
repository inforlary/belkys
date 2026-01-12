import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MeetingReportProps {
  onClose: () => void;
}

interface MeetingData {
  id: string;
  meeting_no: string;
  meeting_date: string;
  total_decisions: number;
  completed_decisions: number;
  open_decisions: number;
}

export default function MeetingReport({ onClose }: MeetingReportProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [totalStats, setTotalStats] = useState({
    totalMeetings: 0,
    totalDecisions: 0,
    completedDecisions: 0,
    openDecisions: 0
  });

  useEffect(() => {
    loadReportData();
  }, [selectedYear]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const { data: meetingsData, error } = await supabase
        .from('ic_ikyk_meetings')
        .select(`
          id,
          meeting_no,
          meeting_date
        `)
        .eq('organization_id', profile?.organization_id)
        .gte('meeting_date', `${selectedYear}-01-01`)
        .lte('meeting_date', `${selectedYear}-12-31`)
        .order('meeting_date', { ascending: false });

      if (error) throw error;

      const meetingsWithStats: MeetingData[] = [];
      let totalDecisions = 0;
      let completedDecisions = 0;

      for (const meeting of meetingsData || []) {
        const { data: decisionsData } = await supabase
          .from('ic_ikyk_decisions')
          .select('id, status')
          .eq('meeting_id', meeting.id);

        const total = decisionsData?.length || 0;
        const completed = decisionsData?.filter(d => d.status === 'COMPLETED').length || 0;

        totalDecisions += total;
        completedDecisions += completed;

        meetingsWithStats.push({
          ...meeting,
          total_decisions: total,
          completed_decisions: completed,
          open_decisions: total - completed
        });
      }

      setMeetings(meetingsWithStats);
      setTotalStats({
        totalMeetings: meetingsWithStats.length,
        totalDecisions,
        completedDecisions,
        openDecisions: totalDecisions - completedDecisions
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const summaryData = [
      ['İKİYK TOPLANTI RAPORU'],
      ['Dönem', selectedYear],
      [''],
      ['Toplam Toplantı', totalStats.totalMeetings],
      ['Toplam Karar', totalStats.totalDecisions],
      ['Tamamlanan Karar', `${totalStats.completedDecisions} (${totalStats.totalDecisions > 0 ? ((totalStats.completedDecisions / totalStats.totalDecisions) * 100).toFixed(0) : 0}%)`],
      ['Açık Karar', totalStats.openDecisions]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const meetingsData = meetings.map(m => ({
      'Toplantı No': m.meeting_no,
      'Tarih': new Date(m.meeting_date).toLocaleDateString('tr-TR'),
      'Karar Sayısı': m.total_decisions,
      'Tamamlanan': m.completed_decisions,
      'Açık': m.open_decisions
    }));

    const ws2 = XLSX.utils.json_to_sheet(meetingsData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Toplantılar');

    XLSX.writeFile(wb, `İKİYK_Toplanti_Raporu_${selectedYear}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">İKİYK Toplantı Raporu</h2>
          <p className="text-sm text-gray-600">Dönem: {selectedYear}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input-field"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">TOPLANTI ÖZET</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Toplam Toplantı</div>
            <div className="text-2xl font-bold text-blue-600">{totalStats.totalMeetings}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Toplam Karar</div>
            <div className="text-2xl font-bold text-gray-900">{totalStats.totalDecisions}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Tamamlanan Karar</div>
            <div className="text-2xl font-bold text-green-600">{totalStats.completedDecisions}</div>
            <div className="text-xs text-gray-500">{totalStats.totalDecisions > 0 ? ((totalStats.completedDecisions / totalStats.totalDecisions) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Açık Karar</div>
            <div className="text-2xl font-bold text-orange-600">{totalStats.openDecisions}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">TOPLANTI LİSTESİ</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Karar</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlanan</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Açık</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {meetings.map((meeting) => (
                <tr key={meeting.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{meeting.meeting_no}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(meeting.meeting_date).toLocaleDateString('tr-TR')}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{meeting.total_decisions}</td>
                  <td className="px-4 py-3 text-center text-sm text-green-600">{meeting.completed_decisions}</td>
                  <td className="px-4 py-3 text-center text-sm text-orange-600">{meeting.open_decisions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
