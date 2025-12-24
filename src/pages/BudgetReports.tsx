import BudgetPerformanceReports from '../components/budget-performance/BudgetPerformanceReports';

export default function BudgetReports() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bütçe Raporları</h1>
        <p className="text-slate-600 mt-1">
          İcmal raporları ve çok yıllı bütçe karşılaştırmaları
        </p>
      </div>

      <BudgetPerformanceReports />
    </div>
  );
}
