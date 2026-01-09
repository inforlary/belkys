import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, LayoutDashboard, Target, Flag, BarChart3, Briefcase, Menu, X, LogOut, User, Users, Building, Calendar, Lock, MessageSquare, CheckSquare, FileText, Network, File as FileEdit, CreditCard, Archive, ChevronDown, ChevronRight, DollarSign, Coins, TrendingUp, TrendingDown, Layers, FileBarChart, Settings, Wind, Grid2x2 as Grid, Shield, ShieldAlert, ShieldCheck, Activity, AlertTriangle, AlertCircle, ClipboardCheck, FileWarning, Search, Bell, FolderOpen, GitMerge, Database, Hash, Eye, GitBranch, Clock, Workflow, Award, FileSearch, Scale, Lightbulb, BookOpen, Package, Mail, Key, Download, UserCog, ListChecks } from 'lucide-react';
import { useLocation } from '../hooks/useLocation';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';

interface LayoutProps {
  children: ReactNode;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
  strictAdminOnly?: boolean;
  requiresDepartment?: boolean;
  allowDirector?: boolean;
}

interface MenuSection {
  label: string;
  icon: any;
  items: MenuItem[];
}

interface ICPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  status: string;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const { profile, signOut } = useAuth();
  const { currentPath, navigate } = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [latestNotification, setLatestNotification] = useState<string | null>(null);
  const [icPlans, setIcPlans] = useState<ICPlan[]>([]);
  const [selectedIcPlanId, setSelectedIcPlanId] = useState<string | null>(null);
  const [showIcPlanDropdown, setShowIcPlanDropdown] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (profile?.organization_id) {
      if (profile?.department_id) {
        loadNotifications();
      }
      loadPendingApprovals();

      const interval = setInterval(() => {
        loadPendingApprovals();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.organization_id && moduleAccess.internal_control) {
      loadIcPlans();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    const savedPlanId = localStorage.getItem('selectedIcPlanId');
    if (savedPlanId) {
      setSelectedIcPlanId(savedPlanId);
    }
  }, []);

  const loadIcPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_plans')
        .select('id, name, start_year, end_year, status')
        .eq('organization_id', profile?.organization_id)
        .eq('status', 'active')
        .order('start_year', { ascending: false });

      if (error) throw error;
      setIcPlans(data || []);

      if (data && data.length > 0 && !selectedIcPlanId) {
        const defaultPlan = data[0];
        setSelectedIcPlanId(defaultPlan.id);
        localStorage.setItem('selectedIcPlanId', defaultPlan.id);
      }
    } catch (error) {
      console.error('Error loading IC plans:', error);
    }
  };

  const handleIcPlanChange = (planId: string) => {
    setSelectedIcPlanId(planId);
    localStorage.setItem('selectedIcPlanId', planId);
    setShowIcPlanDropdown(false);
  };

  useEffect(() => {
    if (currentPath.startsWith('program-mapping') ||
        currentPath.startsWith('department-program-mapping') ||
        currentPath.startsWith('budget-performance') ||
        currentPath === 'program-mapping') {
      if (!expandedSections.includes('Bütçe ve Performans')) {
        setExpandedSections(prev => [...prev, 'Bütçe ve Performans']);
      }
    }
  }, [currentPath]);

  const loadNotifications = async () => {
    if (!profile?.organization_id || !profile?.department_id) return;

    try {
      const { data, error } = await supabase
        .from('quarter_notifications')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('department_id', profile.department_id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUnreadNotifications(data?.length || 0);
      if (data && data.length > 0) {
        setLatestNotification(data[0].message);
      }
    } catch (error) {
      console.error('Bildirimler yüklenirken hata:', error);
    }
  };

  const loadPendingApprovals = async () => {
    if (!profile?.organization_id) return;

    try {
      let query = supabase
        .from('indicator_data_entries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id);

      if (profile.role === 'admin' || profile.role === 'vice_president') {
        query = query.eq('status', 'awaiting_admin_approval');
      } else if (profile.role === 'director' && profile.department_id) {
        query = query
          .eq('department_id', profile.department_id)
          .eq('status', 'awaiting_director_approval');
      } else {
        setPendingApprovals(0);
        return;
      }

      const { count, error } = await query;

      if (error) throw error;

      console.log('Bekleyen onay sayısı:', count, 'Role:', profile.role);
      setPendingApprovals(count || 0);
    } catch (error) {
      console.error('Bekleyen onaylar yüklenirken hata:', error);
    }
  };

  const markNotificationsAsRead = async () => {
    if (!profile?.organization_id || !profile?.department_id) return;

    try {
      await supabase
        .from('quarter_notifications')
        .update({ is_read: true })
        .eq('organization_id', profile.organization_id)
        .eq('department_id', profile.department_id)
        .eq('is_read', false);

      setUnreadNotifications(0);
      setLatestNotification(null);
    } catch (error) {
      console.error('Bildirimler okundu olarak işaretlenirken hata:', error);
    }
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionKey)
        ? prev.filter(key => key !== sectionKey)
        : [...prev, sectionKey]
    );
  };

  const topMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Ana Sayfa', path: 'dashboard' },
    { icon: Activity, label: 'Entegre Yönetim', path: 'integrated-management' },
    { icon: FolderOpen, label: 'Dokümanlar', path: 'document-library' },
  ];

  const getModuleAccess = () => {
    if (profile?.is_super_admin) {
      return {
        strategic_planning: true,
        activity_reports: true,
        budget_performance: true,
        internal_control: true,
      };
    }
    return {
      strategic_planning: profile?.organization?.module_strategic_planning ?? true,
      activity_reports: profile?.organization?.module_activity_reports ?? true,
      budget_performance: profile?.organization?.module_budget_performance ?? true,
      internal_control: profile?.organization?.module_internal_control ?? true,
    };
  };

  const moduleAccess = getModuleAccess();

  const menuSections: MenuSection[] = [
    {
      label: 'Stratejik Plan',
      icon: Target,
      items: [
        { icon: Target, label: 'Hedeflerim', path: 'my-goals', requiresDepartment: true },
        { icon: FileText, label: 'Raporlar', path: 'reports' },
        { icon: Target, label: 'Stratejik Planlar', path: 'plans', adminOnly: true },
        { icon: Flag, label: 'Amaçlar', path: 'objectives', adminOnly: true },
        { icon: Target, label: 'Hedefler', path: 'goals', adminOnly: true },
        { icon: BarChart3, label: 'Göstergeler', path: 'indicators', adminOnly: true },
        { icon: Briefcase, label: 'Faaliyetler', path: 'activities', adminOnly: true },
        { icon: FileEdit, label: 'İşbirliği Planlama', path: 'collaboration-planning', adminOnly: true },
        { icon: Network, label: 'Hedefler İlişki Matrisi', path: 'goal-relationship-matrix', adminOnly: true },
        { icon: Coins, label: 'Maliyetlendirme', path: 'collaboration-cost-estimate', adminOnly: true },
        { icon: Wind, label: 'PESTLE Analizi', path: 'pestle-analysis', adminOnly: true },
        { icon: Grid, label: 'SWOT Analizi', path: 'swot-analysis', adminOnly: true },
        { icon: FileText, label: 'Durum Analizi Raporu', path: 'strategic-analysis-report', adminOnly: true },
        { icon: Archive, label: 'Veri Girişi', path: 'data-archive', requiresDepartment: true },
        { icon: CheckSquare, label: 'Veri Onayları', path: 'data-approvals', requiresDepartment: true },
        { icon: TrendingUp, label: 'Performans İzleme', path: 'performance-monitoring', adminOnly: true },
        { icon: BarChart3, label: 'Performans Karşılaştırma', path: 'performance-comparison', adminOnly: true },
        { icon: CreditCard, label: 'Hedef Kartları', path: 'goal-cards', adminOnly: true },
        { icon: Calendar, label: 'Çeyrek Aktivasyon', path: 'quarter-activation', adminOnly: true },
        { icon: ClipboardCheck, label: 'Yıl Sonu Değerlendirme', path: 'strategic-plan-evaluation' },
      ],
    },
    {
      label: 'Faaliyet Raporu',
      icon: FileText,
      items: [
        { icon: FileText, label: 'Raporlarım', path: 'activity-reports', requiresDepartment: true },
        { icon: CheckSquare, label: 'Birim Teslim Durumu', path: 'activity-reports/unit-submissions', adminOnly: true },
        { icon: Settings, label: 'Rapor Yönetimi', path: 'report-management', adminOnly: true },
      ],
    },
    {
      label: 'Bütçe ve Performans',
      icon: TrendingUp,
      items: [
        { icon: Clock, label: 'Bütçe Dönemi Yönetimi', path: 'budget-period-management', adminOnly: true },
        { icon: Layers, label: 'Program Eşleştirme', path: 'program-mapping', strictAdminOnly: true },
        { icon: Eye, label: 'Program Görüntüle', path: 'department-program-mapping-view' },
        { icon: FileText, label: 'Faaliyet Gerekçesi', path: 'budget-performance-justification', requiresDepartment: true },
        { icon: BarChart3, label: 'Performans Bilgisi', path: 'budget-performance-information', requiresDepartment: true },
        { icon: FileBarChart, label: 'Performans Kartları', path: 'performance-cards', adminOnly: true },
      ],
    },
    {
      label: 'Risk Yönetimi',
      icon: AlertTriangle,
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: 'risks' },
        { icon: FileWarning, label: 'Risk Kaydı', path: 'risks/register' },
        { icon: Grid, label: 'Risk Matrisi', path: 'risks/matrix' },
        { icon: BarChart3, label: 'Göstergeler', path: 'risks/indicators' },
        { icon: CheckSquare, label: 'Faaliyetler', path: 'risks/treatments' },
        { icon: Layers, label: 'Kategoriler', path: 'risks/categories', adminOnly: true },
      ],
    },
    {
      label: 'İç Kontrol',
      icon: ShieldCheck,
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: 'internal-control/dashboard' },
        { icon: BookOpen, label: 'Standartlar & Eylemler', path: 'internal-control/standards' },
        { icon: ClipboardCheck, label: 'Eylem Planları', path: 'internal-control/action-plans' },
        { icon: ListChecks, label: 'Tüm Eylemler', path: 'internal-control/actions' },
        { icon: Scale, label: 'Öz Değerlendirmeler', path: 'internal-control/assessments' },
        { icon: Users, label: 'İKİYK Toplantıları', path: 'internal-control/ikyk', adminOnly: true },
        { icon: Award, label: 'Güvence Beyanları', path: 'internal-control/assurance', adminOnly: true },
        { icon: FileText, label: 'Raporlar', path: 'internal-control/reports' },
      ],
    },
    {
      label: 'Ayarlar',
      icon: Settings,
      items: [
        { icon: Settings, label: 'Ayarlar', path: 'settings', adminOnly: true },
        { icon: Settings, label: 'Genel Ayarlar', path: 'settings/general', adminOnly: true },
        { icon: Building, label: 'Kurum Bilgileri', path: 'settings/organization', adminOnly: true },
        { icon: Shield, label: 'Güvenlik', path: 'settings/security', adminOnly: true },
        { icon: Mail, label: 'E-posta', path: 'settings/email', adminOnly: true },
        { icon: Package, label: 'Modüller', path: 'settings/modules', adminOnly: true },
        { icon: Key, label: 'API Anahtarları', path: 'settings/api-keys', adminOnly: true },
        { icon: Database, label: 'Yedekleme', path: 'settings/backups', adminOnly: true },
        { icon: Clock, label: 'Zamanlanmış Görevler', path: 'settings/scheduled-jobs', adminOnly: true },
        { icon: Bell, label: 'Duyurular', path: 'settings/announcements', adminOnly: true },
      ],
    },
    {
      label: 'Yönetim',
      icon: ShieldAlert,
      items: [
        { icon: LayoutDashboard, label: 'Yönetim Paneli', path: 'admin/dashboard', strictAdminOnly: true },
        { icon: UserCog, label: 'Roller ve Yetkiler', path: 'admin/roles', strictAdminOnly: true },
        { icon: FileSearch, label: 'Denetim Logları', path: 'admin/audit-logs', strictAdminOnly: true },
        { icon: Shield, label: 'Giriş Denemeleri', path: 'admin/login-attempts', strictAdminOnly: true },
        { icon: Activity, label: 'Aktif Oturumlar', path: 'admin/sessions', strictAdminOnly: true },
        { icon: TrendingUp, label: 'Sistem Sağlığı', path: 'admin/system-health', strictAdminOnly: true },
        { icon: Download, label: 'Güncellemeler', path: 'admin/updates', strictAdminOnly: true },
      ],
    },
  ];

  const bottomMenuItems: MenuItem[] = [
    { icon: Bell, label: 'Bildirimler', path: 'notification-center' },
    { icon: MessageSquare, label: 'Mesajlar', path: 'messages' },
    { icon: Activity, label: 'Aktivite Logları', path: 'activity-logs', adminOnly: true },
    { icon: Users, label: 'Kullanıcılar', path: 'users', adminOnly: true },
    { icon: Building, label: 'Müdürlükler', path: 'departments', adminOnly: true },
    { icon: TrendingUp, label: 'Başkan Yrd. Performansı', path: 'vice-president-performance', adminOnly: true },
    { icon: User, label: 'Profilim', path: 'user-profile' },
  ];

  const superAdminMenuItem: MenuItem = {
    icon: Settings,
    label: 'Super Admin',
    path: 'super-admin',
  };

  const handleLogout = async () => {
    await signOut();
  };

  const shouldShowMenuItem = (item: MenuItem) => {
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    const isAdminOrVP = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'vice_president';
    const isDirector = profile?.role === 'director';

    if (item.strictAdminOnly && !isAdmin) return false;
    if (item.adminOnly && !isAdminOrVP && !(item.allowDirector && isDirector)) return false;
    if (item.requiresDepartment && !profile?.department_id && !isAdminOrVP) return false;
    return true;
  };

  const shouldShowSection = (section: MenuSection) => {
    const hasAccessibleItems = section.items.some(item => shouldShowMenuItem(item));
    if (!hasAccessibleItems) return false;

    if (section.label === 'Stratejik Plan') return moduleAccess.strategic_planning;
    if (section.label === 'Faaliyet Raporu') return moduleAccess.activity_reports;
    if (section.label === 'Bütçe Yönetimi') return moduleAccess.budget_performance;
    if (section.label === 'Bütçe ve Performans') return moduleAccess.budget_performance;
    if (section.label === 'İç Kontrol') return moduleAccess.internal_control;
    if (section.label === 'Risk Yönetimi') return true;

    return true;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-0'
        } overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 rounded-lg p-2">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">BEL KYS</h1>
              <p className="text-xs text-slate-400">Kurumsal Yönetim Sistemi</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-0.5 flex-1 overflow-y-auto">
          {!profile?.is_super_admin && topMenuItems.map((item) => {
            if (!shouldShowMenuItem(item)) return null;
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}

          {!profile?.is_super_admin && (
            <div className="pt-2">
              {menuSections.map((section) => {
                if (!shouldShowSection(section)) return null;

                const sectionKey = section.label.toLowerCase().replace(/\s+/g, '-');
                const isExpanded = expandedSections.includes(sectionKey);
                const SectionIcon = section.icon;
                const hasActiveItem = section.items.some(item => item.path === currentPath);

                return (
                  <div key={sectionKey} className="mb-0.5">
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
                        hasActiveItem
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <SectionIcon className="w-5 h-5" />
                        <span className="font-medium">{section.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-0.5 ml-4 space-y-0.5">
                        {section.label === 'İç Kontrol' && icPlans.length > 0 && (
                          <div className="mb-2 px-2">
                            <div className="relative">
                              <button
                                onClick={() => setShowIcPlanDropdown(!showIcPlanDropdown)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Calendar className="w-4 h-4 flex-shrink-0" />
                                  <span className="truncate">
                                    {icPlans.find(p => p.id === selectedIcPlanId)?.name || 'Plan Seçin'}
                                  </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showIcPlanDropdown ? 'rotate-180' : ''}`} />
                              </button>

                              {showIcPlanDropdown && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg shadow-lg border border-slate-700 max-h-48 overflow-y-auto">
                                  {icPlans.map((plan) => (
                                    <button
                                      key={plan.id}
                                      onClick={() => handleIcPlanChange(plan.id)}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                                        selectedIcPlanId === plan.id ? 'bg-slate-700 text-white' : 'text-slate-300'
                                      }`}
                                    >
                                      <div className="font-medium">{plan.name}</div>
                                      <div className="text-xs text-slate-400">
                                        {plan.start_year} - {plan.end_year}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {section.items.map((item) => {
                          if (!shouldShowMenuItem(item)) return null;
                          const Icon = item.icon;
                          const isActive = currentPath === item.path;
                          const showBadge = item.path === 'data-approvals' && pendingApprovals > 0;
                          return (
                            <button
                              key={item.path}
                              onClick={() => navigate(item.path)}
                              className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                                isActive
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="flex-1 text-left">{item.label}</span>
                              {showBadge && (
                                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                  {pendingApprovals}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 mt-2">
            {profile?.is_super_admin && (
              <button
                onClick={() => navigate(superAdminMenuItem.path)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors mb-2 ${
                  currentPath === superAdminMenuItem.path
                    ? 'bg-orange-600 text-white'
                    : 'text-orange-300 hover:bg-orange-900 hover:text-white border border-orange-700'
                }`}
              >
                <superAdminMenuItem.icon className="w-5 h-5" />
                <span className="font-medium">{superAdminMenuItem.label}</span>
              </button>
            )}
            {bottomMenuItems.map((item) => {
              if (!shouldShowMenuItem(item)) return null;
              if (profile?.is_super_admin && item.path !== 'user-profile' && item.path !== 'notification-center') return null;
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3 mb-3">
            <div className="bg-slate-700 rounded-full p-2">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-slate-600" />
              ) : (
                <Menu className="w-6 h-6 text-slate-600" />
              )}
            </button>

            <div className="flex items-center space-x-4">
              {!profile?.is_super_admin && <GlobalSearch />}
              {!profile?.is_super_admin && <NotificationBell />}
              {!profile?.is_super_admin && latestNotification && unreadNotifications > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">{latestNotification}</p>
                  </div>
                  <button
                    onClick={markNotificationsAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Okundu İşaretle
                  </button>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-500">
                  {profile?.is_super_admin ? 'Super Admin' :
                   profile?.role === 'admin' ? 'Yönetici' :
                   profile?.role === 'vice_president' ? 'Başkan Yardımcısı' :
                   profile?.role === 'manager' ? 'Müdür' : 'Kullanıcı'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
