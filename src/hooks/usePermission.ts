import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function usePermission() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPermissions();
    }
  }, [user]);

  const loadPermissions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role:roles(
            role_permissions(
              permission:permissions(code)
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const userPermissions = data?.flatMap(ur =>
        ur.role?.role_permissions?.map(rp => rp.permission?.code).filter(Boolean) || []
      ) || [];

      setPermissions(userPermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true;
    }
    return permissions.includes(permissionCode);
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true;
    }
    return permissionCodes.some(code => permissions.includes(code));
  };

  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true;
    }
    return permissionCodes.every(code => permissions.includes(code));
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refresh: loadPermissions,
  };
}
