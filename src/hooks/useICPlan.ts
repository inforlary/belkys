import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ICPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  description: string | null;
  status: 'active' | 'completed';
  organization_id: string;
  created_at: string;
  created_by: string;
}

export function useICPlan() {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ICPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivePlan();
  }, []);

  const fetchActivePlan = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!profileData?.organization_id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('ic_plans')
        .select('*')
        .eq('organization_id', profileData.organization_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSelectedPlan(data);
        setSelectedPlanId(data.id);
      }
    } catch (error) {
      console.error('Error fetching active plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPlan = () => {
    fetchActivePlan();
  };

  return {
    selectedPlanId,
    selectedPlan,
    loading,
    refreshPlan,
    hasPlan: !!selectedPlanId
  };
}
