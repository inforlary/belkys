import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useLocation } from './hooks/useLocation';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StrategicPlans from './pages/StrategicPlans';
import Objectives from './pages/Objectives';
import Goals from './pages/Goals';
import Indicators from './pages/Indicators';
import DataEntry from './pages/DataEntry';
import Activities from './pages/Activities';
import { Users } from './pages/Users';
import { Departments } from './pages/Departments';
import QuarterActivation from './pages/QuarterActivation';
import Messages from './pages/Messages';
import MessagesEnhanced from './pages/MessagesEnhanced';
import DataApprovals from './pages/DataApprovals';
import DataArchive from './pages/DataArchive';
import MyGoals from './pages/MyGoals';
import Reports from './pages/Reports';
import Collaborations from './pages/Collaborations';
import CollaborationPlanning from './pages/CollaborationPlanning';
import GoalRelationshipMatrix from './pages/GoalRelationshipMatrix';
import CollaborationCostEstimate from './pages/CollaborationCostEstimate';
import GoalCards from './pages/GoalCards';
import ActivityReports from './pages/ActivityReports';
import ActivityReportEdit from './pages/ActivityReportEdit';
import ActivityReportDetail from './pages/ActivityReportDetail';
import ActivityReportExport from './pages/ActivityReportExport';
import ActivityReportUnitSubmissions from './pages/ActivityReportUnitSubmissions';
import BudgetPrograms from './pages/BudgetPrograms';
import BudgetCodes from './pages/BudgetCodes';
import BudgetReports from './pages/BudgetReports';
import BudgetAuthorizations from './pages/BudgetAuthorizations';
import BudgetPerformance from './pages/BudgetPerformance';
import BudgetPerformanceForms from './pages/BudgetPerformanceForms';
import VicePresidentPerformance from './pages/VicePresidentPerformance';
import PerformanceMonitoring from './pages/PerformanceMonitoring';
import PerformanceComparison from './pages/PerformanceComparison';
import SuperAdmin from './pages/SuperAdmin';
import PESTLEAnalysis from './pages/PESTLEAnalysis';
import SWOTAnalysis from './pages/SWOTAnalysis';
import StrategicAnalysisReport from './pages/StrategicAnalysisReport';
import ReportManagement from './pages/ReportManagement';
import ActivityLogs from './pages/ActivityLogs';
import NotificationCenter from './pages/NotificationCenter';
import DocumentLibrary from './pages/DocumentLibrary';
import EnhancedDashboard from './pages/EnhancedDashboard';
import UserProfile from './pages/UserProfile';
import ActivitiesOptimized from './pages/ActivitiesOptimized';
import FiscalYearManagement from './pages/FiscalYearManagement';
import PeriodLockManagement from './pages/PeriodLockManagement';
import BudgetPerformanceDashboard from './pages/BudgetPerformanceDashboard';
import BudgetProposals from './pages/BudgetProposals';
import BudgetProposalForm from './pages/BudgetProposalForm';
import BudgetProposalDetail from './pages/BudgetProposalDetail';
import BudgetProposalEdit from './pages/BudgetProposalEdit';
import BudgetCampaigns from './pages/BudgetCampaigns';
import BudgetApprovals from './pages/BudgetApprovals';
import BudgetProgramStructure from './pages/BudgetProgramStructure';
import BudgetExpenseItems from './pages/BudgetExpenseItems';
import ProgramActivityMapping from './pages/ProgramActivityMapping';
import MappedEconomicCodeEntry from './pages/MappedEconomicCodeEntry';
import SubProgramActivities from './pages/SubProgramActivities';
import BudgetPerformanceJustification from './pages/BudgetPerformanceJustification';
import BudgetPerformanceInformation from './pages/BudgetPerformanceInformation';
import ProgramMapping from './pages/ProgramMapping';
import DepartmentProgramMappingView from './pages/DepartmentProgramMappingView';
import PerformanceCards from './pages/PerformanceCards';
import BudgetPeriodManagement from './pages/BudgetPeriodManagement';
import StrategicPlanEvaluation from './pages/StrategicPlanEvaluation';
import IntegratedManagementDashboard from './pages/IntegratedManagementDashboard';
import RiskManagement from './pages/RiskManagement';
import RiskDashboard from './pages/RiskDashboard';
import RiskSettings from './pages/RiskSettings';
import RiskSettingsStrategy from './pages/RiskSettingsStrategy';
import RiskSettingsCriteria from './pages/RiskSettingsCriteria';
import RiskRegister from './pages/RiskRegister';
import RiskRegisterNew from './pages/RiskRegisterNew';
import RiskDetail from './pages/RiskDetail';
import RiskMatrix from './pages/RiskMatrix';
import RiskIndicators from './pages/RiskIndicators';
import RiskIndicatorEntry from './pages/RiskIndicatorEntry';
import RiskControls from './pages/RiskControls';
import RiskTreatments from './pages/RiskTreatments';
import RiskTreatmentDetail from './pages/RiskTreatmentDetail';
import RiskCategories from './pages/RiskCategories';
import RiskReports from './pages/RiskReports';
import QualityDashboard from './pages/QualityDashboard';
import QualityProcesses from './pages/QualityProcesses';
import QualityProcessDetail from './pages/QualityProcessDetail';
import QualityProcessKPITracking from './pages/QualityProcessKPITracking';
import QualityDocuments from './pages/QualityDocuments';
import QualityDOF from './pages/QualityDOF';
import QualityDOFDetail from './pages/QualityDOFDetail';
import QualityAudits from './pages/QualityAudits';
import QualityAuditDetail from './pages/QualityAuditDetail';
import QualityCustomerSatisfaction from './pages/QualityCustomerSatisfaction';
import QualityReports from './pages/QualityReports';
import InternalControl from './pages/InternalControl';
import InternalControlDashboard from './pages/InternalControlDashboard';
import ICStandards from './pages/ICStandards';
import ICActionPlans from './pages/ICActionPlans';
import ICActions from './pages/ICActions';
import ICActionPlanDetail from './pages/ICActionPlanDetail';
import ICActionDetail from './pages/ICActionDetail';
import ICAssessments from './pages/ICAssessments';
import ICMeetings from './pages/ICMeetings';
import ICAssuranceStatements from './pages/ICAssuranceStatements';
import ICReports from './pages/ICReports';
import Settings from './pages/Settings';
import GeneralSettings from './pages/GeneralSettings';
import OrganizationSettings from './pages/OrganizationSettings';
import SecuritySettings from './pages/SecuritySettings';
import EmailSettings from './pages/EmailSettings';
import ModuleManagement from './pages/ModuleManagement';
import ApiKeysManagement from './pages/ApiKeysManagement';
import BackupManagement from './pages/BackupManagement';
import ScheduledJobsManagement from './pages/ScheduledJobsManagement';
import SystemAnnouncements from './pages/SystemAnnouncements';
import AdminDashboard from './pages/AdminDashboard';
import RoleManagement from './pages/RoleManagement';
import AuditLogs from './pages/AuditLogs';
import LoginAttemptsLog from './pages/LoginAttemptsLog';
import ActiveSessions from './pages/ActiveSessions';
import SystemHealth from './pages/SystemHealth';
import SystemUpdates from './pages/SystemUpdates';

function AppContent() {
  const { user, loading, profile } = useAuth();
  const { currentPath, navigate } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (profile?.is_super_admin && currentPath !== 'super-admin' && currentPath !== 'user-profile' && currentPath !== 'notification-center') {
    navigate('super-admin');
  }

const renderPage = () => {
    console.log('[App.tsx] renderPage called with currentPath:', currentPath);

    if (currentPath.startsWith('budget-proposals/') && currentPath.includes('/edit')) {
      return <BudgetProposalEdit />;
    }
    if (currentPath.startsWith('budget-proposals/') && !currentPath.includes('/new') && !currentPath.includes('/edit')) {
      return <BudgetProposalDetail />;
    }
    if (currentPath.startsWith('activity-reports/') && currentPath.includes('/edit')) {
      return <ActivityReportEdit />;
    }
    if (currentPath.startsWith('activity-reports/') && currentPath.includes('/export')) {
      return <ActivityReportExport />;
    }
    if (currentPath.startsWith('activity-reports/') && !currentPath.includes('/edit') && !currentPath.includes('/export') && !currentPath.includes('/unit-submissions')) {
      return <ActivityReportDetail />;
    }
    if (currentPath.startsWith('risks/treatments/') && currentPath !== 'risks/treatments') {
      return <RiskTreatmentDetail />;
    }
    if (currentPath.startsWith('risk-management/risks/') && currentPath !== 'risk-management/risks') {
      return <RiskDetail />;
    }
    if (currentPath.startsWith('quality-management/processes/') && currentPath !== 'quality-management/processes') {
      return <QualityProcessDetail />;
    }
    if (currentPath.startsWith('quality-management/dof/') && currentPath !== 'quality-management/dof') {
      return <QualityDOFDetail />;
    }
    if (currentPath.startsWith('quality-management/audits/') && currentPath !== 'quality-management/audits') {
      return <QualityAuditDetail />;
    }
    if (currentPath.match(/internal-control\/action-plans\/[^/]+\/actions\/[^/]+/)) {
      return <ICActionDetail />;
    }
    if (currentPath.startsWith('internal-control/action-plans/') && currentPath !== 'internal-control/action-plans') {
      return <ICActionPlanDetail />;
    }

    console.log('[App.tsx] === ROUTING DEBUG ===');
    console.log('[App.tsx] currentPath:', currentPath);
    console.log('[App.tsx] window.location.hash:', window.location.hash);

    switch (currentPath) {
      case 'dashboard':
        return <Dashboard />;
      case 'integrated-management':
        return <IntegratedManagementDashboard />;
      case 'reports':
        return <Reports />;
      case 'plans':
        return <StrategicPlans />;
      case 'objectives':
        return <Objectives />;
      case 'goals':
        return <Goals />;
      case 'indicators':
        return <Indicators />;
      case 'data-entry':
        return <DataEntry />;
      case 'activities':
        return <Activities />;
      case 'collaborations':
        return <Collaborations />;
      case 'collaboration-planning':
        return <CollaborationPlanning />;
      case 'goal-relationship-matrix':
        return <GoalRelationshipMatrix />;
      case 'collaboration-cost-estimate':
        return <CollaborationCostEstimate />;
      case 'goal-cards':
        return <GoalCards />;
      case 'activity-reports':
        return <ActivityReports />;
      case 'activity-reports/unit-submissions':
        return <ActivityReportUnitSubmissions />;
      case 'users':
        return <Users />;
      case 'departments':
        return <Departments />;
      case 'quarter-activation':
        return <QuarterActivation />;
      case 'messages':
        return <MessagesEnhanced />;
      case 'messages-old':
        return <Messages />;
      case 'data-approvals':
        return <DataApprovals />;
      case 'data-archive':
        return <DataArchive />;
      case 'my-goals':
        return <MyGoals />;
      case 'budget-programs':
        return <BudgetPrograms />;
      case 'budget-codes':
        return <BudgetCodes />;
      case 'budget-reports':
        return <BudgetReports />;
      case 'budget-authorizations':
        return <BudgetAuthorizations />;
      case 'budget-performance':
        return <BudgetPerformance />;
      case 'budget-performance-forms':
        return <BudgetPerformanceForms />;
      case 'fiscal-year-management':
        return <FiscalYearManagement />;
      case 'period-lock-management':
        return <PeriodLockManagement />;
      case 'budget-performance-dashboard':
        return <BudgetPerformanceDashboard />;
      case 'budget-proposals':
        return <BudgetProposals />;
      case 'budget-proposals/new':
        return <BudgetProposalForm />;
      case 'budget-program-structure':
        return <BudgetProgramStructure />;
      case 'budget-period-management':
        return <BudgetPeriodManagement />;
      case 'budget-expense-items':
        console.log('[App.tsx] Matched budget-expense-items case!');
        return <BudgetExpenseItems />;
      case 'budget-campaigns':
        return <BudgetCampaigns />;
      case 'budget-approvals':
        return <BudgetApprovals />;
      case 'sub-program-activities':
        return <SubProgramActivities />;
      case 'program-activity-mapping':
        return <ProgramActivityMapping />;
      case 'mapped-economic-code-entry':
        return <MappedEconomicCodeEntry />;
      case 'vice-president-performance':
        return <VicePresidentPerformance />;
      case 'performance-monitoring':
        return <PerformanceMonitoring />;
      case 'performance-comparison':
        return <PerformanceComparison />;
      case 'super-admin':
        return <SuperAdmin />;
      case 'pestle-analysis':
        return <PESTLEAnalysis />;
      case 'swot-analysis':
        return <SWOTAnalysis />;
      case 'strategic-analysis-report':
        return <StrategicAnalysisReport />;
      case 'report-management':
        return <ReportManagement />;
      case 'activity-logs':
        return <ActivityLogs />;
      case 'notification-center':
        return <NotificationCenter />;
      case 'document-library':
        return <DocumentLibrary />;
      case 'enhanced-dashboard':
        return <EnhancedDashboard />;
      case 'user-profile':
        return <UserProfile />;
      case 'activities-optimized':
        return <ActivitiesOptimized />;
      case 'budget-performance-justification':
        return <BudgetPerformanceJustification />;
      case 'budget-performance-information':
        return <BudgetPerformanceInformation />;
      case 'program-mapping':
        if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'vice_president') {
          return <Dashboard />;
        }
        return <ProgramMapping />;
      case 'department-program-mapping-view':
        return <DepartmentProgramMappingView />;
      case 'performance-cards':
        return <PerformanceCards />;
      case 'strategic-plan-evaluation':
        return <StrategicPlanEvaluation />;
      case 'risks':
        return <RiskManagement />;
      case 'risks/register':
        return <RiskRegister />;
      case 'risks/register/new':
        return <RiskRegisterNew />;
      case 'risks/matrix':
        return <RiskMatrix />;
      case 'risks/indicators':
        return <RiskIndicators />;
      case 'risks/treatments':
        return <RiskTreatments />;
      case 'risks/categories':
        return <RiskCategories />;
      case 'risk-management':
        return <RiskManagement />;
      case 'risk-management/dashboard':
        return <RiskDashboard />;
      case 'risk-management/settings':
        return <RiskSettings />;
      case 'risk-management/settings/strategy':
        return <RiskSettingsStrategy />;
      case 'risk-management/settings/categories':
        return <RiskCategories />;
      case 'risk-management/settings/criteria':
        return <RiskSettingsCriteria />;
      case 'risk-management/risks':
        return <RiskRegister />;
      case 'risk-management/matrix':
        return <RiskMatrix />;
      case 'risk-management/controls':
        return <RiskControls />;
      case 'risk-management/treatments':
        return <RiskTreatments />;
      case 'risk-management/indicators':
        return <RiskIndicators />;
      case 'risk-management/indicators/entry':
        return <RiskIndicatorEntry />;
      case 'risk-management/reports':
        return <RiskReports />;
      case 'quality-management':
        return <QualityDashboard />;
      case 'quality-management/dashboard':
        return <QualityDashboard />;
      case 'quality-management/processes':
        return <QualityProcesses />;
      case 'quality-management/process-kpis':
        return <QualityProcessKPITracking />;
      case 'quality-management/documents':
        return <QualityDocuments />;
      case 'quality-management/dof':
        return <QualityDOF />;
      case 'quality-management/audits':
        return <QualityAudits />;
      case 'quality-management/customer-satisfaction':
        return <QualityCustomerSatisfaction />;
      case 'quality-management/reports':
        return <QualityReports />;
      case 'internal-control':
        return <InternalControl />;
      case 'internal-control/dashboard':
        return <InternalControlDashboard />;
      case 'internal-control/standards':
        return <ICStandards />;
      case 'internal-control/action-plans':
        return <ICActionPlans />;
      case 'internal-control/actions':
        return <ICActions />;
      case 'internal-control/assessments':
        return <ICAssessments />;
      case 'internal-control/ikyk':
        return <ICMeetings />;
      case 'internal-control/assurance':
        return <ICAssuranceStatements />;
      case 'internal-control/reports':
        return <ICReports />;
      case 'settings':
        return <Settings />;
      case 'settings/general':
        return <GeneralSettings />;
      case 'settings/organization':
        return <OrganizationSettings />;
      case 'settings/security':
        return <SecuritySettings />;
      case 'settings/email':
        return <EmailSettings />;
      case 'settings/modules':
        return <ModuleManagement />;
      case 'settings/api-keys':
        return <ApiKeysManagement />;
      case 'settings/backups':
        return <BackupManagement />;
      case 'settings/scheduled-jobs':
        return <ScheduledJobsManagement />;
      case 'settings/announcements':
        return <SystemAnnouncements />;
      case 'admin/dashboard':
        return <AdminDashboard />;
      case 'admin/roles':
        return <RoleManagement />;
      case 'admin/audit-logs':
        return <AuditLogs />;
      case 'admin/login-attempts':
        return <LoginAttemptsLog />;
      case 'admin/sessions':
        return <ActiveSessions />;
      case 'admin/system-health':
        return <SystemHealth />;
      case 'admin/updates':
        return <SystemUpdates />;
      default:
        console.log('[App.tsx] No match found for currentPath, returning Dashboard');
        return profile?.is_super_admin ? <SuperAdmin /> : <Dashboard />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
