import { useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface Indicator {
  id: string;
  code: string;
  name: string;
  current_value: number;
  threshold_yellow: number;
  threshold_red: number;
  direction: string;
  risk: { code: string; };
}

export default function IndicatorStatusReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('risk_indicators')
        .select(`
          *,
          risk:risks(code)
        `)
        .eq('organization_id', profile.organization_id);

      if (data) setIndicators(data);
    } catch (error) {
      console.error('Error loading indicators:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIndicatorStatus = (indicator: Indicator) => {
    const value = indicator.current_value || 0;
    const yellow = indicator.threshold_yellow || 0;
    const red = indicator.threshold_red || 0;

    if (indicator.direction === 'decrease') {
      if (value <= yellow) return { status: 'green', icon: '🟢', label: 'Normal' };
      if (value <= red) return { status: 'yellow', icon: '🟡', label: 'Dikkat' };
      return { status: 'red', icon: '🔴', label: 'Alarm' };
    } else {
      if (value >= yellow) return { status: 'green', icon: '🟢', label: 'Normal' };
      if (value >= red) return { status: 'yellow', icon: '🟡', label: 'Dikkat' };
      return { status: 'red', icon: '🔴', label: 'Alarm' };
    }
  };

  const greenIndicators = indicators.filter(i => getIndicatorStatus(i).status === 'green');
  const yellowIndicators = indicators.filter(i => getIndicatorStatus(i).status === 'yellow');
  const redIndicators = indicators.filter(i => getIndicatorStatus(i).status === 'red');

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('GÖSTERGE DURUM RAPORU', 14, 20);
    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    doc.save('gosterge-durum-raporu.pdf');
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['GÖSTERGE DURUM RAPORU'],
      ['Rapor Tarihi:', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['ÖZET'],
      ['Toplam Gösterge', indicators.length],
      ['Yeşil (Normal)', greenIndicators.length],
      ['Sarı (Dikkat)', yellowIndicators.length],
      ['Kırmızı (Alarm)', redIndicators.length]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const indicatorData = indicators.map(ind => ({
      'KOD': ind.code,
      'GÖSTERGE': ind.name,
      'DEĞER': ind.current_value || 0,
      'DURUM': getIndicatorStatus(ind).label,
      'İLİŞKİLİ RİSK': ind.risk?.code || '-'
    }));

    const ws2 = XLSX.utils.json_to_sheet(indicatorData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Göstergeler');

    XLSX.writeFile(wb, 'gosterge-durum-raporu.xlsx');
  };

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
          <h1 className="text-2xl font-bold text-slate-900">Gösterge Durum Raporu</h1>
          <p className="text-sm text-slate-600 mt-1">KRI göstergelerinin dönemsel değerleri</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">1. ÖZET</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-slate-900">{indicators.length}</div>
              <div className="text-sm text-slate-600 mt-2">TOPLAM</div>
            </div>
            <div className="bg-green-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600">{greenIndicators.length}</div>
              <div className="text-sm text-slate-600 mt-2">YEŞİL</div>
              <div className="text-xs text-slate-500 mt-1">
                {indicators.length > 0 ? Math.round((greenIndicators.length / indicators.length) * 100) : 0}%
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">{yellowIndicators.length}</div>
              <div className="text-sm text-slate-600 mt-2">SARI</div>
              <div className="text-xs text-slate-500 mt-1">
                {indicators.length > 0 ? Math.round((yellowIndicators.length / indicators.length) * 100) : 0}%
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-red-600">{redIndicators.length}</div>
              <div className="text-sm text-slate-600 mt-2">KIRMIZI</div>
              <div className="text-xs text-slate-500 mt-1">
                {indicators.length > 0 ? Math.round((redIndicators.length / indicators.length) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        {redIndicators.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">2. ALARM DURUMUNDA GÖSTERGELER</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">KOD</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">GÖSTERGE</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">DEĞER</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">EŞİK</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">İLİŞKİLİ RİSK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {redIndicators.map(indicator => {
                    const status = getIndicatorStatus(indicator);
                    return (
                      <tr key={indicator.id}>
                        <td className="px-4 py-3 text-sm text-slate-900">{indicator.code}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{indicator.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{indicator.current_value || 0}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="text-red-600">&gt; {indicator.threshold_red} {status.icon}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{indicator.risk?.code || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">3. TÜM GÖSTERGELER</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">KOD</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">GÖSTERGE</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">DEĞER</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">DURUM</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">İLİŞKİLİ RİSK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {indicators.map(indicator => {
                  const status = getIndicatorStatus(indicator);
                  return (
                    <tr key={indicator.id}>
                      <td className="px-4 py-3 text-sm text-slate-900">{indicator.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{indicator.name}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{indicator.current_value || 0}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status.status === 'green' ? 'bg-green-100 text-green-800' :
                          status.status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{indicator.risk?.code || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
