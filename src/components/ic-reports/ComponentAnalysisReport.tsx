import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, FileText } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';

interface ComponentAnalysisReportProps {
  planId: string;
  onClose: () => void;
}

export default function ComponentAnalysisReport({ planId, onClose }: ComponentAnalysisReportProps) {
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, [planId]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('ic_components')
        .select('*')
        .is('organization_id', null)
        .order('order_index');

      if (error) throw error;

      setComponents(data || []);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bileşen Analiz Raporu</h2>
          <p className="text-sm text-gray-600">Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
        </div>
      </div>

      <div className="text-center py-12 text-gray-600">
        Bu rapor içeriği yakında eklenecektir
      </div>
    </div>
  );
}
