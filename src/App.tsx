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
import BudgetPrograms from './pages/BudgetPrograms';
import BudgetCodes from './pages/BudgetCodes';
import BudgetExpenseEntry from './pages/BudgetExpenseEntry';
import BudgetRevenueEntry from './pages/BudgetRevenueEntry';
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
import InternalControlDashboard from './pages/InternalControlDashboard';
import InternalControlAdminDashboard from './pages/InternalControlAdminDashboard';
import InternalControlSelfAssessment from './pages/InternalControlSelfAssessment';
import InternalControlPlans from './pages/InternalControlPlans';
import KIKSStandards from './pages/KIKSStandards';
import InstitutionalFramework from './pages/InstitutionalFramework';
import OrganizationManagement from './pages/OrganizationManagement';
import ProcessManagement from './pages/ProcessManagement';
import RiskManagement from './pages/RiskManagement';
import ControlActivities from './pages/ControlActivities';
import MonitoringEvaluation from './pages/MonitoringEvaluation';
import CAPAManagement from './pages/CAPAManagement';
import InternalControlReports from './pages/InternalControlReports';
import ActivityLogs from './pages/ActivityLogs';
import NotificationCenter from './pages/NotificationCenter';
import DocumentLibrary from './pages/DocumentLibrary';
import EnhancedDashboard from './pages/EnhancedDashboard';
import RemindersManagement from './pages/RemindersManagement';
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
import ActionPlan from './pages/ActionPlan';
import ActionPlanWorkflow from './pages/ActionPlanWorkflow';
import ICRoleManagement from './pages/ICRoleManagement';
import IntegratedRiskReport from './pages/IntegratedRiskReport';
import BudgetPerformanceMapping from './pages/BudgetPerformanceMapping';
import BudgetPerformanceJustification from './pages/BudgetPerformanceJustification';
import BudgetPerformanceInformation from './pages/BudgetPerformanceInformation';
import BudgetPerformanceHistorical from './pages/BudgetPerformanceHistorical';
import BudgetPerformanceProgramDashboard from './pages/BudgetPerformanceProgramDashboard';
import ProgramMapping from './pages/ProgramMapping';
import DepartmentProgramMappingView from './pages/DepartmentProgramMappingView';
import DepartmentBudgetData2024 from './pages/DepartmentBudgetData2024';
import PerformanceCards from './pages/PerformanceCards';

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

    console.log('[App.tsx] === ROUTING DEBUG ===');
    console.log('[App.tsx] currentPath:', currentPath);
    console.log('[App.tsx] window.location.hash:', window.location.hash);

    switch (currentPath) {
      case 'dashboard':
        return <Dashboard />;
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
      case 'budget-expense-entry':
        return <BudgetExpenseEntry />;
      case 'budget-revenue-entry':
        return <BudgetRevenueEntry />;
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
      case 'internal-control-dashboard':
        return <InternalControlDashboard />;
      case 'internal-control-plans':
        return <InternalControlPlans />;
      case 'internal-control-admin-dashboard':
        return <InternalControlAdminDashboard />;
      case 'internal-control-self-assessment':
        return <InternalControlSelfAssessment />;
      case 'kiks-standards':
        return <KIKSStandards />;
      case 'institutional-framework':
        return <InstitutionalFramework />;
      case 'organization-management':
        return <OrganizationManagement />;
      case 'process-management':
        return <ProcessManagement />;
      case 'risk-management':
        return <RiskManagement />;
      case 'control-activities':
        return <ControlActivities />;
      case 'monitoring-evaluation':
        return <MonitoringEvaluation />;
      case 'capa-management':
        return <CAPAManagement />;
      case 'action-plan':
        return <ActionPlan />;
      case 'action-plan-workflow':
        return <ActionPlanWorkflow />;
      case 'ic-role-management':
        return <ICRoleManagement />;
      case 'internal-control-reports':
        return <InternalControlReports />;
      case 'integrated-risk-report':
        return <IntegratedRiskReport />;
      case 'activity-logs':
        return <ActivityLogs />;
      case 'notification-center':
        return <NotificationCenter />;
      case 'document-library':
        return <DocumentLibrary />;
      case 'enhanced-dashboard':
        return <EnhancedDashboard />;
      case 'reminders':
        return <RemindersManagement />;
      case 'user-profile':
        return <UserProfile />;
      case 'activities-optimized':
        return <ActivitiesOptimized />;
      case 'budget-performance-mapping':
        return <BudgetPerformanceMapping />;
      case 'budget-performance-justification':
        return <BudgetPerformanceJustification />;
      case 'budget-performance-information':
        return <BudgetPerformanceInformation />;
      case 'budget-performance-historical':
        return <BudgetPerformanceHistorical />;
      case 'budget-performance-program-dashboard':
        return <BudgetPerformanceProgramDashboard />;
      case 'program-mapping':
        if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'vice_president') {
          return <Dashboard />;
        }
        return <ProgramMapping />;
      case 'department-program-mapping-view':
        return <DepartmentProgramMappingView />;
      case 'department-budget-data-2024':
        return <DepartmentBudgetData2024 />;
      case 'performance-cards':
        return <PerformanceCards />;
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
