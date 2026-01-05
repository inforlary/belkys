import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ICPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  description: string | null;
  status: 'active' | 'draft' | 'completed';
  organization_id: string;
  created_at: string;
  created_by: string;
}

export function useICPlan() {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ICPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const planId = localStorage.getItem('selectedICPlan');
    setSelectedPlanId(planId);

    if (planId) {
      fetchPlanDetails(planId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchPlanDetails = async (planId: string) => {
    try {
      const { data, error } = await supabase
        .from('ic_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      if (error) throw error;
      setSelectedPlan(data);
    } catch (error) {
      console.error('Error fetching plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPlan = () => {
    const planId = localStorage.getItem('selectedICPlan');
    setSelectedPlanId(planId);
    if (planId) {
      fetchPlanDetails(planId);
    }
  };

  const clearPlan = () => {
    localStorage.removeItem('selectedICPlan');
    setSelectedPlanId(null);
    setSelectedPlan(null);
  };

  return {
    selectedPlanId,
    selectedPlan,
    loading,
    refreshPlan,
    clearPlan,
    hasPlan: !!selectedPlanId
  };
}
