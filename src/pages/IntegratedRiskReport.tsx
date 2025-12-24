import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertTriangle, TrendingUp, BarChart3, Download, FileSpreadsheet, Users, Target } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RiskSummary {
  collaboration_risks: number;
  ic_risks: number;
  linked_risks: number;
  unlinked_collab_risks: number;
  critical_ic: number;
  high_ic: number;
}

interface CollaborationRisk {
  id: string;
  content: string;
  ic_risk_id: string | null;
  plan_id: string;
  collaboration_plan?: {
    title: string;
    goal?: {
      code: string;
      title: string;
      objective?: {
        code: string;
        title: string;
      };
    };
  };
  ic_risk?: {
    risk_code: string;
    risk_title: string;
  };
}


export default function IntegratedRiskReport() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<RiskSummary>({
    collaboration_risks: 0,
    ic_risks: 0,
    linked_risks: 0,
    unlinked_collab_risks: 0,
    critical_ic: 0,
    high_ic: 0
  });
  const [collabRisks, setCollabRisks] = useState<CollaborationRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const { data: planData, error: planError } = await supabase
        .from('collaboration_plans')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (planError) throw planError;

      const planIds = planData?.map(p => p.id) || [];

      let collabData: CollaborationRisk[] = [];

      if (planIds.length > 0) {
        const { data, error } = await supabase
          .from('collaboration_plan_items')
          .select(`
            *,
            collaboration_plan:collaboration_plans(
              title,
              goal:goals(
                code,
                title,
                objective:objectives(code, title)
              )
            ),
            ic_risk:ic_risks(risk_code, risk_title)
          `)
          .eq('category', 'risk')
          .in('plan_id', planIds);

        if (error) throw error;
        collabData = data || [];
      }

      const { data: icData, error: icError } = await supabase
        .from('ic_risks')
        .select('id, residual_score')
        .eq('organization_id', profile.organization_id);

      if (icError) throw icError;

      const linked = collabData.filter(r => r.ic_risk_id !== null).length;
      const criticalIC = icData?.filter(r => r.residual_score >= 20).length || 0;
      const highIC = icData?.filter(r => r.residual_score >= 15 && r.residual_score < 20).length || 0;

      setSummary({
        collaboration_risks: collabData.length,
        ic_risks: icData?.length || 0,
        linked_risks: linked,
        unlinked_collab_risks: collabData.length - linked,
        critical_ic: criticalIC,
        high_ic: highIC
      });

      setCollabRisks(collabData);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const filteredRisks = collabRisks.filter(risk => {
    if (filter === 'linked') return risk.ic_risk_id !== null;
    if (filter === 'unlinked') return risk.ic_risk_id === null;
    return true;
  });

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['ENTEGRE RİSK RAPORU'],
      ['Tarih:', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['ÖZET İSTATİSTİKLER'],
      ['İşbirliği Planı Riskleri', summary.collaboration_risks],
      ['İç Kontrol Riskleri', summary.ic_risks],
      ['Bağlantılı Riskler', summary.linked_risks],
      ['Bağlantısız Riskler', summary.unlinked_collab_risks],
      [''],
      ['İşbirliği - Kritik', summary.critical_collab],
      ['İşbirliği - Yüksek', summary.high_collab],
      ['İç Kontrol - Kritik', summary.critical_ic],
      ['İç Kontrol - Yüksek', summary.high_ic]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Özet');

    const riskData = filteredRisks.map(risk => ({
      'Amaç': risk.collaboration_plan?.goal?.objective?.code || '',
      'Hedef': risk.collaboration_plan?.goal?.code || '',
      'İşbirliği Planı': risk.collaboration_plan?.title || '',
      'Risk Tanımı': risk.content,
      'İç Kontrole Bağlı': risk.ic_risk_id ? 'Evet' : 'Hayır',
      'İç Kontrol Risk Kodu': risk.ic_risk?.risk_code || ''
    }));
    const wsRisks = XLSX.utils.json_to_sheet(riskData);
    XLSX.utils.book_append_sheet(wb, wsRisks, 'Riskler');

    XLSX.writeFile(wb, `entegre-risk-raporu-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Entegre Risk Raporu', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);

    const summaryTable = [
      ['Metrik', 'Deger'],
      ['Isbirligi Plani Riskleri', summary.collaboration_risks.toString()],
      ['Ic Kontrol Riskleri', summary.ic_risks.toString()],
      ['Baglantili Riskler', summary.linked_risks.toString()],
      ['Baglantisiz Riskler', summary.unlinked_collab_risks.toString()]
    ];

    autoTable(doc, {
      head: [summaryTable[0]],
      body: summaryTable.slice(1),
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9 }
    });

    doc.save(`entegre-risk-raporu-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              Entegre Risk Raporu
            </h1>
            <p className="text-gray-600 mt-1">Stratejik Planlama ve İç Kontrol Risk Analizi</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel İndir
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <Download className="w-4 h-4" />
              PDF İndir
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{summary.collaboration_risks}</span>
          </div>
          <div className="text-sm opacity-90">İşbirliği Riskleri</div>
          <div className="text-xs opacity-75 mt-1">Stratejik Planlama</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{summary.ic_risks}</span>
          </div>
          <div className="text-sm opacity-90">İç Kontrol Riskleri</div>
          <div className="text-xs opacity-75 mt-1">
            {summary.critical_ic} Kritik, {summary.high_ic} Yüksek
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{summary.linked_risks}</span>
          </div>
          <div className="text-sm opacity-90">Bağlantılı Riskler</div>
          <div className="text-xs opacity-75 mt-1">
            {summary.collaboration_risks > 0
              ? `${Math.round((summary.linked_risks / summary.collaboration_risks) * 100)}% Entegrasyon`
              : '0% Entegrasyon'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{summary.unlinked_collab_risks}</span>
          </div>
          <div className="text-sm opacity-90">Bağlantısız Riskler</div>
          <div className="text-xs opacity-75 mt-1">İç kontrole entegre edilmeli</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Detaylı Risk Listesi</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tümü ({collabRisks.length})
              </button>
              <button
                onClick={() => setFilter('linked')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  filter === 'linked' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bağlantılı ({summary.linked_risks})
              </button>
              <button
                onClick={() => setFilter('unlinked')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  filter === 'unlinked' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bağlantısız ({summary.unlinked_collab_risks})
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredRisks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p>Seçilen filtreye uygun risk bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRisks.map((risk) => (
                <div key={risk.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {risk.ic_risk_id ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            Bağlantılı
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Bağlantısız
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 mb-2">{risk.content}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        {risk.collaboration_plan?.goal?.objective && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {risk.collaboration_plan.goal.objective.code} →{' '}
                            {risk.collaboration_plan.goal.code}
                          </span>
                        )}
                        {risk.ic_risk && (
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            <Shield className="w-3 h-3" />
                            {risk.ic_risk.risk_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
