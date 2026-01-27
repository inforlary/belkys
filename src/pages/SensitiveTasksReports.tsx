import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  FileText,
  Clock,
  AlertCircle,
  History,
  Users,
  Download,
  FileSpreadsheet,
  ArrowLeft
} from 'lucide-react';
import { SensitiveTask } from '../types/sensitive-tasks';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  generateReport: () => void;
}

export default function SensitiveTasksReports() {
  const { navigate } = useLocation();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<SensitiveTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadTasks();
    }
  }, [profile?.organization_id]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sensitive_tasks')
        .select(`
          *,
          department:departments(id, name),
          assigned_primary:profiles!assigned_primary_id(id, full_name, email, role),
          assigned_backup:profiles!assigned_backup_id(id, full_name, email, role),
          workflow:workflow_processes(id, name, code)
        `)
        .eq('organization_id', profile!.organization_id);

      if (error) throw error;
      setTasks(data as unknown as SensitiveTask[]);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInventoryReport = () => {
    console.log('Hassas Görev Envanteri raporu oluşturuluyor...');
    alert('Hassas Görev Envanteri raporu oluşturuluyor. Bu özellik yakında eklenecek.');
  };

  const generateDueSoonReport = () => {
    console.log('Rotasyonu Yaklaşanlar raporu oluşturuluyor...');
    const dueSoonTasks = tasks.filter(t => t.status === 'rotation_due');
    alert(`${dueSoonTasks.length} adet rotasyonu yaklaşan görev bulundu. Rapor özelliği yakında eklenecek.`);
  };

  const generateNoBackupReport = () => {
    console.log('Yedeksiz Görevler raporu oluşturuluyor...');
    const noBackupTasks = tasks.filter(t => !t.assigned_backup_id && t.assigned_primary_id);
    alert(`${noBackupTasks.length} adet yedeksiz görev bulundu. Rapor özelliği yakında eklenecek.`);
  };

  const generateHistoryReport = () => {
    console.log('Rotasyon Geçmişi raporu oluşturuluyor...');
    alert('Rotasyon Geçmişi raporu oluşturuluyor. Bu özellik yakında eklenecek.');
  };

  const generatePersonnelReport = () => {
    console.log('Personel Bazlı Görünüm raporu oluşturuluyor...');
    const personnelCounts = new Map<string, number>();
    tasks.forEach(task => {
      if (task.assigned_primary_id) {
        const count = personnelCounts.get(task.assigned_primary_id) || 0;
        personnelCounts.set(task.assigned_primary_id, count + 1);
      }
    });
    const overloadedCount = Array.from(personnelCounts.values()).filter(count => count >= 3).length;
    alert(`${overloadedCount} personel 3 veya daha fazla hassas görevde görevli. Rapor özelliği yakında eklenecek.`);
  };

  const reportCards: ReportCard[] = [
    {
      id: 'inventory',
      title: 'Hassas Görev Envanteri',
      description: 'Tüm hassas görevler, asil ve yedek personel listesi',
      icon: FileText,
      color: 'blue',
      generateReport: generateInventoryReport
    },
    {
      id: 'due-soon',
      title: 'Rotasyonu Yaklaşanlar',
      description: '15 gün içinde rotasyonu dolacak görevler',
      icon: Clock,
      color: 'yellow',
      generateReport: generateDueSoonReport
    },
    {
      id: 'no-backup',
      title: 'Yedeksiz Görevler',
      description: 'Yedek personel atanmamış hassas görevler',
      icon: AlertCircle,
      color: 'red',
      generateReport: generateNoBackupReport
    },
    {
      id: 'history',
      title: 'Rotasyon Geçmişi',
      description: 'Tüm rotasyon işlemlerinin kaydı',
      icon: History,
      color: 'purple',
      generateReport: generateHistoryReport
    },
    {
      id: 'personnel',
      title: 'Personel Bazlı Görünüm',
      description: 'Her personelin kaç hassas görevde olduğu',
      icon: Users,
      color: 'green',
      generateReport: generatePersonnelReport
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; hover: string }> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:bg-blue-200' },
      yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', hover: 'hover:bg-yellow-200' },
      red: { bg: 'bg-red-100', text: 'text-red-600', hover: 'hover:bg-red-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', hover: 'hover:bg-purple-200' },
      green: { bg: 'bg-green-100', text: 'text-green-600', hover: 'hover:bg-green-200' }
    };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hassas Görev Raporları</h1>
          <p className="mt-2 text-slate-600">Denetim ve analiz raporları oluşturun</p>
        </div>
        <button
          onClick={() => navigate('/sensitive-tasks')}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard'a Dön
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 gap-4">
          {reportCards.map((card) => {
            const Icon = card.icon;
            const colors = getColorClasses(card.color);

            return (
              <div
                key={card.id}
                className="flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all group"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`${colors.bg} ${colors.hover} rounded-xl p-4 transition-colors`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{card.title}</h3>
                    <p className="text-sm text-slate-600">{card.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={card.generateReport}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Rapor Oluştur
                  </button>
                  <button
                    className="p-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                    title="PDF olarak indir"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    className="p-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                    title="Excel olarak indir"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Uyarı</h3>
            <p className="text-sm text-blue-700">
              3 veya daha fazla hassas görevde görevli personeller raporlarda kırmızı ile işaretlenir.
              Bu durum, personel yük dağılımının dengelenmesi gerektiğini gösterir.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Toplam Görev</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{tasks.length}</p>
          <p className="text-sm text-slate-600 mt-2">Hassas görev sayısı</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Rotasyon Yakın</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {tasks.filter(t => t.status === 'rotation_due').length}
          </p>
          <p className="text-sm text-slate-600 mt-2">15 gün içinde</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Yedeksiz</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {tasks.filter(t => !t.assigned_backup_id && t.assigned_primary_id).length}
          </p>
          <p className="text-sm text-slate-600 mt-2">Yedek atanmamış</p>
        </div>
      </div>
    </div>
  );
}
