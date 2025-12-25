import React, { useState, useEffect } from 'react';
import { Building2, Users, Shield, AlertTriangle, Plus, Edit2, Trash2, X, Search, Filter, AlertCircle, List, Grid3x3, Columns } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Card } from '../components/ui/Card';

interface RACIEntry {
  id: string;
  activity_name: string;
  process_id?: string;
  responsible_role?: string;
  responsible_user_id?: string;
  accountable_role?: string;
  accountable_user_id?: string;
  consulted_roles?: string[];
  consulted_user_ids?: string[];
  informed_roles?: string[];
  informed_user_ids?: string[];
  process_name?: string;
  responsible_user?: string;
  accountable_user?: string;
}

interface SoDRule {
  id: string;
  rule_code: string;
  rule_name: string;
  rule_description?: string;
  conflicting_function_1: string;
  conflicting_function_2: string;
  risk_if_combined?: string;
  mitigation_control?: string;
  status: 'active' | 'inactive' | 'under_review';
}

interface Process {
  id: string;
  name: string;
  code: string;
}

interface ProcessStep {
  id: string;
  step_name: string;
  process_id: string;
}

interface User {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

export default function InstitutionalFramework() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [activeTab, setActiveTab] = useState<'raci' | 'sod'>('raci');
  const [raciEntries, setRaciEntries] = useState<RACIEntry[]>([]);
  const [sodRules, setSodRules] = useState<SoDRule[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRaciModal, setShowRaciModal] = useState(false);
  const [showSodModal, setShowSodModal] = useState(false);
  const [editingRaci, setEditingRaci] = useState<RACIEntry | null>(null);
  const [editingSod, setEditingSod] = useState<SoDRule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [raciView, setRaciView] = useState<'list' | 'horizontal' | 'vertical'>('list');

  const [raciForm, setRaciForm] = useState({
    activity_name: '',
    process_id: '',
    responsible_role: '',
    responsible_user_id: '',
    accountable_role: '',
    accountable_user_id: '',
    consulted_roles: [] as string[],
    consulted_user_ids: [] as string[],
    informed_roles: [] as string[],
    informed_user_ids: [] as string[]
  });

  const [sodForm, setSodForm] = useState({
    rule_code: '',
    rule_name: '',
    rule_description: '',
    conflicting_function_1: '',
    conflicting_function_2: '',
    risk_if_combined: '',
    mitigation_control: '',
    status: 'active' as 'active' | 'inactive' | 'under_review'
  });

  useEffect(() => {
    if (profile?.organization_id && selectedPlanId) {
      loadData();
    }
  }, [profile, activeTab, selectedPlanId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProcesses(),
        loadProcessSteps(),
        loadUsers(),
        loadDepartments()
      ]);

      if (activeTab === 'raci') {
        await loadRaciEntries();
      } else {
        await loadSodRules();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProcesses = async () => {
    if (!selectedPlanId) return;

    const { data, error } = await supabase
      .from('ic_processes')
      .select('id, name, code')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId)
      .order('code');

    if (!error && data) setProcesses(data);
  };

  const loadProcessSteps = async () => {
    if (!selectedPlanId) return;

    const { data, error } = await supabase
      .from('ic_process_steps')
      .select('id, step_name, process_id')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId)
      .order('step_number');

    if (!error && data) setProcessSteps(data);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', profile!.organization_id)
      .order('full_name');

    if (!error && data) setUsers(data);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile!.organization_id)
      .order('name');

    if (!error && data) setDepartments(data);
  };

  const loadRaciEntries = async () => {
    if (!selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_raci_matrix')
        .select(`
          *,
          ic_processes(name),
          responsible_profile:profiles!ic_raci_matrix_responsible_user_id_fkey(full_name),
          accountable_profile:profiles!ic_raci_matrix_accountable_user_id_fkey(full_name)
        `)
        .eq('organization_id', profile!.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('RACI yükleme hatası:', error);
        return;
      }

      console.log('RACI verileri yüklendi:', data?.length, 'kayıt');

      if (data) {
        const formatted = data.map((entry: any) => ({
          id: entry.id,
          activity_name: entry.activity_name,
          process_id: entry.process_id,
          responsible_role: entry.responsible_role,
          responsible_user_id: entry.responsible_user_id,
          accountable_role: entry.accountable_role,
          accountable_user_id: entry.accountable_user_id,
          consulted_roles: entry.consulted_roles || [],
          consulted_user_ids: entry.consulted_user_ids || [],
          informed_roles: entry.informed_roles || [],
          informed_user_ids: entry.informed_user_ids || [],
          process_name: entry.ic_processes?.name,
          responsible_user: entry.responsible_profile?.full_name,
          accountable_user: entry.accountable_profile?.full_name
        }));
        setRaciEntries(formatted);
      }
    } catch (err) {
      console.error('RACI yükleme exception:', err);
    }
  };

  const loadSodRules = async () => {
    if (!selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_sod_rules')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('rule_code');

      if (error) {
        console.error('SoD yükleme hatası:', error);
        return;
      }

      console.log('SoD kuralları yüklendi:', data?.length, 'kayıt');

      if (data) {
        setSodRules(data as any);
      }
    } catch (err) {
      console.error('SoD yükleme exception:', err);
    }
  };

  const handleSaveRaci = async () => {
    if (!selectedPlanId) return;

    try {
      const payload = {
        ...raciForm,
        organization_id: profile!.organization_id,
        ic_plan_id: selectedPlanId,
        consulted_roles: raciForm.consulted_roles.length > 0 ? raciForm.consulted_roles : null,
        consulted_user_ids: raciForm.consulted_user_ids.length > 0 ? raciForm.consulted_user_ids : null,
        informed_roles: raciForm.informed_roles.length > 0 ? raciForm.informed_roles : null,
        informed_user_ids: raciForm.informed_user_ids.length > 0 ? raciForm.informed_user_ids : null
      };

      if (editingRaci) {
        await supabase
          .from('ic_raci_matrix')
          .update(payload)
          .eq('id', editingRaci.id);
      } else {
        await supabase
          .from('ic_raci_matrix')
          .insert(payload);
      }

      setShowRaciModal(false);
      resetRaciForm();
      loadRaciEntries();
    } catch (error) {
      console.error('Error saving RACI entry:', error);
      alert('RACI girişi kaydedilirken bir hata oluştu');
    }
  };

  const handleSaveSod = async () => {
    if (!selectedPlanId) return;

    try {
      const payload = {
        ...sodForm,
        organization_id: profile!.organization_id,
        ic_plan_id: selectedPlanId
      };

      if (editingSod) {
        await supabase
          .from('ic_sod_rules')
          .update(payload)
          .eq('id', editingSod.id);
      } else {
        await supabase
          .from('ic_sod_rules')
          .insert(payload);
      }

      setShowSodModal(false);
      resetSodForm();
      loadSodRules();
    } catch (error) {
      console.error('Error saving SoD rule:', error);
      alert('SoD kuralı kaydedilirken bir hata oluştu');
    }
  };

  const handleDeleteRaci = async (id: string) => {
    if (!confirm('Bu RACI girişini silmek istediğinizden emin misiniz?')) return;

    try {
      await supabase
        .from('ic_raci_matrix')
        .delete()
        .eq('id', id);
      loadRaciEntries();
    } catch (error) {
      console.error('Error deleting RACI entry:', error);
    }
  };

  const handleDeleteSod = async (id: string) => {
    if (!confirm('Bu SoD kuralını silmek istediğinizden emin misiniz?')) return;

    try {
      await supabase
        .from('ic_sod_rules')
        .delete()
        .eq('id', id);
      loadSodRules();
    } catch (error) {
      console.error('Error deleting SoD rule:', error);
    }
  };

  const openEditRaci = (entry: RACIEntry) => {
    setEditingRaci(entry);
    setRaciForm({
      activity_name: entry.activity_name,
      process_id: entry.process_id || '',
      responsible_role: entry.responsible_role || '',
      responsible_user_id: entry.responsible_user_id || '',
      accountable_role: entry.accountable_role || '',
      accountable_user_id: entry.accountable_user_id || '',
      consulted_roles: entry.consulted_roles || [],
      consulted_user_ids: entry.consulted_user_ids || [],
      informed_roles: entry.informed_roles || [],
      informed_user_ids: entry.informed_user_ids || []
    });
    setShowRaciModal(true);
  };

  const openEditSod = (rule: SoDRule) => {
    setEditingSod(rule);
    setSodForm({
      rule_code: rule.rule_code,
      rule_name: rule.rule_name,
      rule_description: rule.rule_description || '',
      conflicting_function_1: rule.conflicting_function_1,
      conflicting_function_2: rule.conflicting_function_2,
      risk_if_combined: rule.risk_if_combined || '',
      mitigation_control: rule.mitigation_control || '',
      status: rule.status
    });
    setShowSodModal(true);
  };

  const resetRaciForm = () => {
    setEditingRaci(null);
    setRaciForm({
      activity_name: '',
      process_id: '',
      responsible_role: '',
      responsible_user_id: '',
      accountable_role: '',
      accountable_user_id: '',
      consulted_roles: [],
      consulted_user_ids: [],
      informed_roles: [],
      informed_user_ids: []
    });
  };

  const resetSodForm = () => {
    setEditingSod(null);
    setSodForm({
      rule_code: '',
      rule_name: '',
      rule_description: '',
      conflicting_function_1: '',
      conflicting_function_2: '',
      risk_if_combined: '',
      mitigation_control: '',
      status: 'active'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'under_review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Aktif',
      inactive: 'Pasif',
      under_review: 'İnceleme Altında'
    };
    return labels[status] || status;
  };

  const filteredRaciEntries = raciEntries.filter(entry =>
    entry.activity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.process_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSodRules = sodRules.filter(rule => {
    const matchesSearch = rule.rule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.rule_description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterSeverity === 'all' || rule.status === filterSeverity;
    return matchesSearch && matchesStatus;
  });

  const getStepsForProcess = (processId: string) => {
    return processSteps.filter(step => step.process_id === processId);
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  const getAllPersons = () => {
    const personsMap = new Map<string, { name: string; type: 'user' | 'role' }>();

    filteredRaciEntries.forEach(entry => {
      if (entry.responsible_user) {
        personsMap.set(`user_${entry.responsible_user_id}`, { name: entry.responsible_user, type: 'user' });
      }
      if (entry.responsible_role) {
        personsMap.set(`role_${entry.responsible_role}`, { name: entry.responsible_role, type: 'role' });
      }
      if (entry.accountable_user) {
        personsMap.set(`user_${entry.accountable_user_id}`, { name: entry.accountable_user, type: 'user' });
      }
      if (entry.accountable_role) {
        personsMap.set(`role_${entry.accountable_role}`, { name: entry.accountable_role, type: 'role' });
      }
      entry.consulted_roles?.forEach(role => {
        personsMap.set(`role_${role}`, { name: role, type: 'role' });
      });
      entry.consulted_user_ids?.forEach((userId, idx) => {
        const user = users.find(u => u.id === userId);
        if (user) personsMap.set(`user_${userId}`, { name: user.full_name, type: 'user' });
      });
      entry.informed_roles?.forEach(role => {
        personsMap.set(`role_${role}`, { name: role, type: 'role' });
      });
      entry.informed_user_ids?.forEach((userId, idx) => {
        const user = users.find(u => u.id === userId);
        if (user) personsMap.set(`user_${userId}`, { name: user.full_name, type: 'user' });
      });
    });

    return Array.from(personsMap.entries()).map(([key, value]) => ({ key, ...value }));
  };

  const getRACIForCell = (entry: RACIEntry, personKey: string): string[] => {
    const roles: string[] = [];
    const [type, id] = personKey.split('_');

    if (type === 'user') {
      if (entry.responsible_user_id === id) roles.push('R');
      if (entry.accountable_user_id === id) roles.push('A');
      if (entry.consulted_user_ids?.includes(id)) roles.push('C');
      if (entry.informed_user_ids?.includes(id)) roles.push('I');
    } else if (type === 'role') {
      const roleName = personKey.substring(5);
      if (entry.responsible_role === roleName) roles.push('R');
      if (entry.accountable_role === roleName) roles.push('A');
      if (entry.consulted_roles?.includes(roleName)) roles.push('C');
      if (entry.informed_roles?.includes(roleName)) roles.push('I');
    }

    return roles;
  };

  const renderHorizontalMatrix = () => {
    const persons = getAllPersons();

    if (filteredRaciEntries.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500">Henüz RACI girişi bulunmuyor</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-b-2 border-gray-300 min-w-[200px] sticky left-0 bg-gray-100 z-10">
                  Aktivite / Süreç
                </th>
                {persons.map(person => (
                  <th
                    key={person.key}
                    className="px-3 py-3 text-center text-xs font-medium text-gray-700 border-b-2 border-gray-300 min-w-[80px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{person.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded mt-1 ${
                        person.type === 'user'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {person.type === 'user' ? 'Kişi' : 'Rol'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRaciEntries.map((entry, idx) => (
                <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 border-r-2 border-gray-200 sticky left-0 bg-inherit z-10">
                    <div className="font-medium text-sm text-gray-900">{entry.activity_name}</div>
                    {entry.process_name && (
                      <div className="text-xs text-gray-500 mt-1">{entry.process_name}</div>
                    )}
                  </td>
                  {persons.map(person => {
                    const roles = getRACIForCell(entry, person.key);
                    return (
                      <td
                        key={`${entry.id}-${person.key}`}
                        className="px-3 py-3 text-center border-l border-gray-200"
                      >
                        {roles.length > 0 && (
                          <div className="flex items-center justify-center gap-1">
                            {roles.map(role => (
                              <span
                                key={role}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                  role === 'R' ? 'bg-blue-500 text-white' :
                                  role === 'A' ? 'bg-green-500 text-white' :
                                  role === 'C' ? 'bg-yellow-500 text-white' :
                                  'bg-purple-500 text-white'
                                }`}
                                title={
                                  role === 'R' ? 'Sorumlu' :
                                  role === 'A' ? 'Yetkili' :
                                  role === 'C' ? 'Danışılan' :
                                  'Bilgilendirilen'
                                }
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="font-semibold">Açıklama:</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white font-bold">S</span>
              <span>Sorumlu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold">Y</span>
              <span>Yetkili</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-white font-bold">D</span>
              <span>Danışılan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white font-bold">B</span>
              <span>Bilgilendirilen</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVerticalMatrix = () => {
    const persons = getAllPersons();

    if (filteredRaciEntries.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500">Henüz RACI girişi bulunmuyor</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-b-2 border-gray-300 min-w-[200px] sticky left-0 bg-gray-100 z-10">
                  Kişi / Rol
                </th>
                {filteredRaciEntries.map(entry => (
                  <th
                    key={entry.id}
                    className="px-3 py-3 text-center text-xs font-medium text-gray-700 border-b-2 border-gray-300 min-w-[120px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{entry.activity_name}</span>
                      {entry.process_name && (
                        <span className="text-[10px] text-gray-500 mt-1">{entry.process_name}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {persons.map((person, idx) => (
                <tr key={person.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 border-r-2 border-gray-200 sticky left-0 bg-inherit z-10">
                    <div className="font-medium text-sm text-gray-900">{person.name}</div>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded mt-1 ${
                      person.type === 'user'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {person.type === 'user' ? 'Kişi' : 'Rol'}
                    </span>
                  </td>
                  {filteredRaciEntries.map(entry => {
                    const roles = getRACIForCell(entry, person.key);
                    return (
                      <td
                        key={`${person.key}-${entry.id}`}
                        className="px-3 py-3 text-center border-l border-gray-200"
                      >
                        {roles.length > 0 && (
                          <div className="flex items-center justify-center gap-1">
                            {roles.map(role => (
                              <span
                                key={role}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                  role === 'S' ? 'bg-blue-500 text-white' :
                                  role === 'Y' ? 'bg-green-500 text-white' :
                                  role === 'D' ? 'bg-yellow-500 text-white' :
                                  'bg-purple-500 text-white'
                                }`}
                                title={
                                  role === 'S' ? 'Sorumlu' :
                                  role === 'Y' ? 'Yetkili' :
                                  role === 'D' ? 'Danışılan' :
                                  'Bilgilendirilen'
                                }
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="font-semibold">Açıklama:</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white font-bold">R</span>
              <span>Sorumlu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold">A</span>
              <span>Yetkili</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-white font-bold">C</span>
              <span>Danışılan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white font-bold">I</span>
              <span>Bilgilendirilen</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                Kurumsal Çerçeve modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kurumsal Çerçeve</h1>
            <p className="text-sm text-gray-600">RACI Matrisi ve Görevler Ayrılığı Yönetimi</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('raci')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'raci'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>RACI Matrisi</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('sod')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'sod'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>SoD Kuralları</span>
            </div>
          </button>
        </div>

        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {activeTab === 'raci' && (
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setRaciView('list')}
              className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                raciView === 'list'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="Liste Görünümü"
            >
              <List className="w-4 h-4" />
              <span className="text-sm">Liste</span>
            </button>
            <button
              onClick={() => setRaciView('horizontal')}
              className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                raciView === 'horizontal'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="Yatay Matris: Aktiviteler x Kişiler"
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="text-sm">Yatay</span>
            </button>
            <button
              onClick={() => setRaciView('vertical')}
              className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                raciView === 'vertical'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="Dikey Matris: Kişiler x Aktiviteler"
            >
              <Columns className="w-4 h-4" />
              <span className="text-sm">Dikey</span>
            </button>
          </div>
        )}

        {activeTab === 'sod' && (
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="under_review">İnceleme Altında</option>
            </select>
          </div>
        )}

        {isAdmin && (
          <Button
            onClick={() => {
              if (activeTab === 'raci') {
                resetRaciForm();
                setShowRaciModal(true);
              } else {
                resetSodForm();
                setShowSodModal(true);
              }
            }}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {activeTab === 'raci' ? 'Yeni RACI Girişi' : 'Yeni SoD Kuralı'}
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Yükleniyor...</p>
          </div>
        </Card>
      ) : (
        <>
          {activeTab === 'raci' ? (
            raciView === 'list' ? (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Aktivite
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Süreç
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Sorumlu
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Yetkili
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Danışılan / Bilgilendirilen
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                          İşlemler
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRaciEntries.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                          Henüz RACI girişi bulunmuyor
                        </td>
                      </tr>
                    ) : (
                      filteredRaciEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{entry.activity_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              {entry.process_name && (
                                <div className="text-gray-900">{entry.process_name}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              {entry.responsible_user && (
                                <div className="text-gray-900">{entry.responsible_user}</div>
                              )}
                              {entry.responsible_role && (
                                <div className="text-gray-500 text-xs mt-1">{entry.responsible_role}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              {entry.accountable_user && (
                                <div className="text-gray-900">{entry.accountable_user}</div>
                              )}
                              {entry.accountable_role && (
                                <div className="text-gray-500 text-xs mt-1">{entry.accountable_role}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 max-w-xs">
                              {entry.consulted_roles?.length > 0 && (
                                <div><span className="font-medium">C:</span> {entry.consulted_roles.join(', ')}</div>
                              )}
                              {entry.informed_roles?.length > 0 && (
                                <div><span className="font-medium">I:</span> {entry.informed_roles.join(', ')}</div>
                              )}
                              {!entry.consulted_roles?.length && !entry.informed_roles?.length && '-'}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditRaci(entry)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRaci(entry.id)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : raciView === 'horizontal' ? (
              renderHorizontalMatrix()
            ) : (
              renderVerticalMatrix()
            )
          ) : (
            <div className="grid gap-4">
              {filteredSodRules.length === 0 ? (
                <Card>
                  <div className="text-center py-12 text-gray-500">
                    Henüz SoD kuralı bulunmuyor
                  </div>
                </Card>
              ) : (
                filteredSodRules.map((rule) => (
                  <Card key={rule.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Shield className="w-5 h-5 text-purple-600" />
                          <h3 className="text-lg font-semibold text-gray-900">{rule.rule_name}</h3>
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">
                            {rule.rule_code}
                          </span>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(rule.status)}`}>
                            {getStatusLabel(rule.status)}
                          </span>
                        </div>
                        {rule.rule_description && (
                          <p className="text-gray-600 mb-3">{rule.rule_description}</p>
                        )}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-gray-700 min-w-[140px]">Çakışan Fonksiyon 1:</span>
                            <span className="text-gray-900">{rule.conflicting_function_1}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-gray-700 min-w-[140px]">Çakışan Fonksiyon 2:</span>
                            <span className="text-gray-900">{rule.conflicting_function_2}</span>
                          </div>
                          {rule.risk_if_combined && (
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-red-700 min-w-[140px]">Risk:</span>
                              <span className="text-red-900">{rule.risk_if_combined}</span>
                            </div>
                          )}
                          {rule.mitigation_control && (
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-green-700 min-w-[140px]">Azaltıcı Kontrol:</span>
                              <span className="text-green-900">{rule.mitigation_control}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => openEditSod(rule)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSod(rule.id)}
                            className="text-red-600 hover:text-red-800 p-2"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      <Modal isOpen={showRaciModal} onClose={() => setShowRaciModal(false)} title={editingRaci ? 'RACI Girişini Düzenle' : 'Yeni RACI Girişi'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aktivite Adı *</label>
            <input
              type="text"
              value={raciForm.activity_name}
              onChange={(e) => setRaciForm({ ...raciForm, activity_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Aktivite adını girin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Süreç</label>
            <select
              value={raciForm.process_id}
              onChange={(e) => setRaciForm({ ...raciForm, process_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.code} - {process.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Rol</label>
              <input
                type="text"
                value={raciForm.responsible_role}
                onChange={(e) => setRaciForm({ ...raciForm, responsible_role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Örn: Satın Alma Uzmanı"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
              <select
                value={raciForm.responsible_user_id}
                onChange={(e) => setRaciForm({ ...raciForm, responsible_user_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yetkili Rol</label>
              <input
                type="text"
                value={raciForm.accountable_role}
                onChange={(e) => setRaciForm({ ...raciForm, accountable_role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Örn: Birim Müdürü"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yetkili Kişi</label>
              <select
                value={raciForm.accountable_user_id}
                onChange={(e) => setRaciForm({ ...raciForm, accountable_user_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Danışılan</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roller</label>
                <input
                  type="text"
                  value={raciForm.consulted_roles.join(', ')}
                  onChange={(e) => setRaciForm({
                    ...raciForm,
                    consulted_roles: e.target.value.split(',').map(r => r.trim()).filter(r => r)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Rolleri virgülle ayırın"
                />
                <p className="text-xs text-gray-500 mt-1">Örn: Hukuk Müşaviri, Mali İşler Müdürü</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kişiler</label>
                <select
                  multiple
                  value={raciForm.consulted_user_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setRaciForm({ ...raciForm, consulted_user_ids: selected });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[100px]"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd tuşuyla birden fazla seçim yapın</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Bilgilendirilen</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roller</label>
                <input
                  type="text"
                  value={raciForm.informed_roles.join(', ')}
                  onChange={(e) => setRaciForm({
                    ...raciForm,
                    informed_roles: e.target.value.split(',').map(r => r.trim()).filter(r => r)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Rolleri virgülle ayırın"
                />
                <p className="text-xs text-gray-500 mt-1">Örn: Başkan, İç Kontrol Birimi</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kişiler</label>
                <select
                  multiple
                  value={raciForm.informed_user_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setRaciForm({ ...raciForm, informed_user_ids: selected });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[100px]"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd tuşuyla birden fazla seçim yapın</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSaveRaci}
              disabled={!raciForm.activity_name}
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
            >
              Kaydet
            </Button>
            <Button
              onClick={() => setShowRaciModal(false)}
              variant="secondary"
              className="flex-1"
            >
              İptal
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showSodModal} onClose={() => setShowSodModal(false)} title={editingSod ? 'SoD Kuralını Düzenle' : 'Yeni SoD Kuralı'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kural Kodu *</label>
              <input
                type="text"
                value={sodForm.rule_code}
                onChange={(e) => setSodForm({ ...sodForm, rule_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="SOD-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kural Adı *</label>
              <input
                type="text"
                value={sodForm.rule_name}
                onChange={(e) => setSodForm({ ...sodForm, rule_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Kural adını girin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={sodForm.rule_description}
              onChange={(e) => setSodForm({ ...sodForm, rule_description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={2}
              placeholder="Kural açıklaması..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Çakışan Fonksiyon 1 *</label>
              <input
                type="text"
                value={sodForm.conflicting_function_1}
                onChange={(e) => setSodForm({ ...sodForm, conflicting_function_1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Satın alma siparişi oluşturma"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Çakışan Fonksiyon 2 *</label>
              <input
                type="text"
                value={sodForm.conflicting_function_2}
                onChange={(e) => setSodForm({ ...sodForm, conflicting_function_2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Fatura kaydı ve ödeme onayı"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birleştirildiğinde Risk</label>
            <input
              type="text"
              value={sodForm.risk_if_combined}
              onChange={(e) => setSodForm({ ...sodForm, risk_if_combined: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Yetkisiz harcama ve zimmet riski"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Azaltıcı Kontrol</label>
            <input
              type="text"
              value={sodForm.mitigation_control}
              onChange={(e) => setSodForm({ ...sodForm, mitigation_control: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Muayene komisyonu kontrolü ve çift imza"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              value={sodForm.status}
              onChange={(e) => setSodForm({ ...sodForm, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="under_review">İnceleme Altında</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSaveSod}
              disabled={!sodForm.rule_name || !sodForm.rule_code || !sodForm.conflicting_function_1 || !sodForm.conflicting_function_2}
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
            >
              Kaydet
            </Button>
            <Button
              onClick={() => setShowSodModal(false)}
              variant="secondary"
              className="flex-1"
            >
              İptal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
