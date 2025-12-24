import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../ui/Card';
import LineChart from '../charts/LineChart';

interface TrendData {
  period: string;
  hedef: number;
  gerçekleşen: number;
}

export default function PerformanceTrendChart() {
  const { profile } = useAuth();
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const currentYear = new Date().getFullYear();

      const [targetsRes, entriesRes] = await Promise.all([
        supabase
          .from('indicator_targets')
          .select('indicator_id, target_value')
          .eq('year', currentYear),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, period_quarter, value')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .order('period_quarter')
      ]);

      if (targetsRes.error || entriesRes.error) throw targetsRes.error || entriesRes.error;

      const quarterData: { [key: number]: { target: number[]; actual: number[] } } = {
        1: { target: [], actual: [] },
        2: { target: [], actual: [] },
        3: { target: [], actual: [] },
        4: { target: [], actual: [] }
      };

      (entriesRes.data || []).forEach(entry => {
        const target = (targetsRes.data || []).find(t => t.indicator_id === entry.indicator_id);
        if (target && entry.value !== null) {
          quarterData[entry.period_quarter].target.push(target.target_value);
          quarterData[entry.period_quarter].actual.push(entry.value);
        }
      });

      const chartData: TrendData[] = [1, 2, 3, 4].map(q => {
        const qData = quarterData[q];
        const avgTarget = qData.target.length > 0
          ? qData.target.reduce((sum, val) => sum + val, 0) / qData.target.length
          : 0;
        const avgActual = qData.actual.length > 0
          ? qData.actual.reduce((sum, val) => sum + val, 0) / qData.actual.length
          : 0;

        return {
          period: `Ç${q}`,
          hedef: Math.round(avgTarget * 100) / 100,
          gerçekleşen: Math.round(avgActual * 100) / 100
        };
      });

      setData(chartData);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Performans Trendi</h3>
        </CardHeader>
        <CardBody>
          <div className="text-center py-4 text-gray-500">Yükleniyor...</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-900">Çeyreklik Performans Trendi</h3>
      </CardHeader>
      <CardBody>
        {data.length > 0 ? (
          <LineChart
            data={data}
            xKey="period"
            lines={[
              { key: 'hedef', name: 'Hedef', color: '#3b82f6' },
              { key: 'gerçekleşen', name: 'Gerçekleşen', color: '#10b981' }
            ]}
            height={250}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            Henüz veri bulunmuyor
          </div>
        )}
      </CardBody>
    </Card>
  );
}
