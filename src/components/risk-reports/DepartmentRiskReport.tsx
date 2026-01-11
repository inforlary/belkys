import { useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DepartmentRiskReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [risks, setRisks] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);

  useEffect(() => {
    loadDepartments();
  }, [profile]);

  useEffect(() => {
    if (selectedDept) {
      loadDepartmentData();
    }
  }, [selectedDept]);

  const loadDepartments = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (data) {
        setDepartments(data);
        if (data.length > 0) setSelectedDept(data[0].id);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentData = async () => {
    if (!profile || !selectedDept) return;

    try {
      const [risksRes, treatmentsRes, indicatorsRes] = await Promise.all([
        supabase
          .from('risks')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('department_id', selectedDept),
        supabase
          .from('risk_treatments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('responsible_department', selectedDept),
        supabase
          .from('risk_indicators')
          .select('*, risk:risks!inner(department_id)')
          .eq('organization_id', profile.organization_id)
      ]);

      if (risksRes.data) setRisks(risksRes.data);
      if (treatmentsRes.data) setTreatments(treatmentsRes.data);
      if (indicatorsRes.data) {
        const deptIndicators = indicatorsRes.data.filter(i => i.risk?.department_id === selectedDept);
        setIndicators(deptIndicators);
      }
    } catch (error) {
      console.error('Error loading department data:', error);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Çok Yüksek';
    if (score >= 10) return 'Yüksek';
    if (score >= 5) return 'Orta';
    return 'Düşük';
  };

  const criticalRisks = risks.filter(r => r.residual_score >= 15).length;
  const avgScore = risks.length > 0 ? (risks.reduce((sum, r) => sum + r.residual_score, 0) / risks.length).toFixed(1) : 0;
  const openTreatments = treatments.filter(t => t.status !== 'completed').length;
  const overdueTreatments = treatments.filter(t =>
    t.status !== 'completed' && new Date(t.due_date) < new Date()
  ).length;

  const exportToPDF = () => {
    const dept = departments.find(d => d.id === selectedDept);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('BIRIM RISK RAPORU', 14, 20);
    doc.setFontSize(12);
    doc.text(dept?.name || '', 14, 28);
    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 34);

    let yPos = 45;

    doc.setFontSize(14);
    doc.text('BIRIM RISK PROFILI', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.text(`Toplam Risk: ${risks.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Kritik/Cok Yuksek: ${criticalRisks}`, 14, yPos);
    yPos += 6;
    doc.text(`Ortalama Skor: ${avgScore}`, 14, yPos);
    yPos += 6;
    doc.text(`Acik Faaliyet: ${openTreatments}`, 14, yPos);
    yPos += 6;
    doc.text(`Geciken Faaliyet: ${overdueTreatments}`, 14, yPos);
    yPos += 15;

    if (risks.length > 0) {
      doc.setFontSize(14);
      doc.text('BIRIM RISKLERI', 14, yPos);
      yPos += 10;

      const riskTableData = risks.slice(0, 15).map(risk => [
        risk.code || '-',
        risk.title?.substring(0, 35) || '-',
        risk.inherent_score?.toString() || '0',
        risk.residual_score?.toString() || '0',
        getRiskLevel(risk.residual_score),
        risk.status === 'active' ? 'Aktif' : 'Kapali'
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['KOD', 'RISK ADI', 'DOGAL', 'ARTIK', 'SEVIYE', 'DURUM']],
        body: riskTableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (treatments.length > 0 && yPos < 250) {
      doc.setFontSize(14);
      doc.text('FAALIYET DURUMU', 14, yPos);
      yPos += 10;

      const treatmentTableData = treatments.slice(0, 10).map(t => [
        t.action_plan?.substring(0, 40) || '-',
        t.status === 'completed' ? 'Tamamlandi' : t.status === 'in_progress' ? 'Devam' : 'Baslamadi',
        new Date(t.due_date).toLocaleDateString('tr-TR')
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['FAALIYET', 'DURUM', 'TERMIN']],
        body: treatmentTableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 }
      });
    }

    doc.save(`birim-risk-raporu-${dept?.name}.pdf`);
  };

  const exportToExcel = () => {
    const dept = departments.find(d => d.id === selectedDept);
    const wb = XLSX.utils.book_new();

    const summaryData = [
      [`BİRİM RİSK RAPORU - ${dept?.name || ''}`],
      ['Rapor Tarihi:', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['BİRİM RİSK PROFİLİ'],
      ['Toplam Risk', risks.length],
      ['Kritik/Ç.Yüksek', criticalRisks],
      ['Ortalama Skor', avgScore],
      ['Açık Faaliyet', openTreatments],
      ['Geciken Faaliyet', overdueTreatments]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const riskData = risks.map(r => ({
      'KOD': r.code,
      'RİSK': r.title,
      'DOĞAL': r.inherent_score,
      'ARTIK': r.residual_score,
      'SEVİYE': getRiskLevel(r.residual_score)
    }));

    const ws2 = XLSX.utils.json_to_sheet(riskData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Riskler');

    XLSX.writeFile(wb, `birim-risk-raporu-${dept?.name}.xlsx`);
  };

  const deptName = departments.find(d => d.id === selectedDept)?.name || '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Birim Bazlı Risk Raporu</h1>
          <p className="text-sm text-slate-600 mt-1">Birim bazında risk dağılımı ve analizi</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Birim Seçin <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg"
          >
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        {selectedDept && (
          <div className="space-y-8">
            <div className="flex gap-2 justify-end">
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                BİRİM RİSK PROFİLİ - {deptName}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Toplam Risk</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{risks.length}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Kritik/Ç.Yüksek</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{criticalRisks}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Ortalama Skor</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">{avgScore}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Açık Faaliyet</div>
                  <div className="text-2xl font-bold text-orange-600 mt-1">{openTreatments}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Geciken Faaliyet</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{overdueTreatments}</div>
                </div>
              </div>
            </div>

            {risks.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">BİRİM RİSKLERİ</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">KOD</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">RİSK ADI</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">DOĞAL</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">ARTIK</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">SEVİYE</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">DURUM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {risks.map(risk => {
                        const level = getRiskLevel(risk.residual_score);
                        const getLevelColor = (level: string) => {
                          switch (level) {
                            case 'Kritik': return 'bg-red-100 text-red-800';
                            case 'Çok Yüksek': return 'bg-orange-100 text-orange-800';
                            case 'Yüksek': return 'bg-yellow-100 text-yellow-800';
                            case 'Orta': return 'bg-blue-100 text-blue-800';
                            case 'Düşük': return 'bg-green-100 text-green-800';
                            default: return 'bg-slate-100 text-slate-800';
                          }
                        };

                        return (
                          <tr key={risk.id}>
                            <td className="px-4 py-3 text-sm text-slate-900">{risk.code}</td>
                            <td className="px-4 py-3 text-sm text-slate-900">{risk.title}</td>
                            <td className="px-4 py-3 text-sm text-center">{risk.inherent_score}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium">{risk.residual_score}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(level)}`}>
                                {level}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                risk.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {risk.status === 'active' ? 'Aktif' : 'Kapalı'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {treatments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">FAALİYET DURUMU</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">FAALİYET</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">DURUM</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">TERMİN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {treatments.slice(0, 10).map(treatment => (
                        <tr key={treatment.id}>
                          <td className="px-4 py-3 text-sm text-slate-900">{treatment.action_plan}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              treatment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              treatment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {treatment.status === 'completed' ? 'Tamamlandı' :
                               treatment.status === 'in_progress' ? 'Devam' : 'Başlamadı'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            {new Date(treatment.due_date).toLocaleDateString('tr-TR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {indicators.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">GÖSTERGE DURUMU</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {indicators.slice(0, 6).map(indicator => (
                    <div key={indicator.id} className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-slate-900">{indicator.name}</div>
                      <div className="flex items-end justify-between mt-2">
                        <div className="text-2xl font-bold text-slate-900">{indicator.current_value || 0}</div>
                        <div className="text-xs text-slate-600">
                          Eşik: {indicator.threshold_red}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
