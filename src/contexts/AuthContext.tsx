import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  role: string;
  is_super_admin?: boolean;
  department_id?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  organization?: {
    module_strategic_planning: boolean;
    module_activity_reports: boolean;
    module_budget_performance: boolean;
    module_internal_control: boolean;
  } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, organizationId: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    const sessionCheckInterval = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession?.user) {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('is_super_admin, organization_id')
          .eq('id', currentSession.user.id)
          .maybeSingle();

        if (currentProfile && !currentProfile.is_super_admin && currentProfile.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('is_active')
            .eq('id', currentProfile.organization_id)
            .maybeSingle();

          if (orgData && !orgData.is_active) {
            await supabase.auth.signOut();
            alert('Belediyeniz devre dışı bırakılmıştır. Lütfen sistem yöneticisi ile iletişime geçin.');
          }
        }
      }
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData && !profileData.is_super_admin && profileData.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('is_active, module_strategic_planning, module_activity_reports, module_budget_performance, module_internal_control')
          .eq('id', profileData.organization_id)
          .maybeSingle();

        if (orgError) throw orgError;

        if (orgData && !orgData.is_active) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          alert('Belediyeniz devre dışı bırakılmıştır. Lütfen sistem yöneticisi ile iletişime geçin.');
          return;
        }

        if (profileData.department_id) {
          const { data: deptData } = await supabase
            .from('departments')
            .select('id, name, budget_institutional_code_id')
            .eq('id', profileData.department_id)
            .maybeSingle();

          setProfile({
            ...profileData,
            department: deptData || null,
            organization: orgData ? {
              module_strategic_planning: orgData.module_strategic_planning,
              module_activity_reports: orgData.module_activity_reports,
              module_budget_performance: orgData.module_budget_performance,
              module_internal_control: orgData.module_internal_control,
            } : null
          });
        } else {
          setProfile({
            ...profileData,
            organization: orgData ? {
              module_strategic_planning: orgData.module_strategic_planning,
              module_activity_reports: orgData.module_activity_reports,
              module_budget_performance: orgData.module_budget_performance,
              module_internal_control: orgData.module_internal_control,
            } : null
          });
        }
      } else if (profileData && profileData.department_id) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('id, name, budget_institutional_code_id')
          .eq('id', profileData.department_id)
          .maybeSingle();

        setProfile({
          ...profileData,
          department: deptData || null
        });
      } else {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Profil yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        await supabase.rpc('start_user_session', {
          p_ip_address: null,
          p_user_agent: navigator.userAgent,
        });
      }

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, organizationId: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Kullanıcı oluşturulamadı');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          organization_id: organizationId,
          role: 'user',
        });

      if (profileError) throw profileError;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.rpc('end_user_session');
    } catch (error) {
      console.error('Session end error:', error);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth hook, AuthProvider içinde kullanılmalıdır');
  }
  return context;
};
