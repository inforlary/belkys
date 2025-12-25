import { supabase } from '../lib/supabase';

export type ActionType =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'approve'
  | 'reject'
  | 'export'
  | 'upload'
  | 'submit'
  | 'cancel'
  | 'archive'
  | 'restore';

export type EntityType =
  | 'user'
  | 'department'
  | 'goal'
  | 'objective'
  | 'indicator'
  | 'activity'
  | 'budget_entry'
  | 'expense_entry'
  | 'revenue_entry'
  | 'program'
  | 'sub_program'
  | 'mapping'
  | 'report'
  | 'document'
  | 'approval'
  | 'session'
  | 'organization'
  | 'strategic_plan'
  | 'ic_plan'
  | 'risk'
  | 'control'
  | 'collaboration'
  | 'data_entry';

export type SeverityLevel = 'info' | 'warning' | 'critical';
export type StatusType = 'success' | 'failed' | 'partial';

interface AuditLogParams {
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  oldValue?: any;
  newValue?: any;
  changesSummary?: string;
  severity?: SeverityLevel;
  status?: StatusType;
  errorMessage?: string;
  departmentId?: string;
  metadata?: Record<string, any>;
}

interface SessionParams {
  userId: string;
  organizationId?: string;
  userEmail?: string;
  userName?: string;
  departmentId?: string;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const {
      organizationId,
      userId,
      userEmail,
      userName,
      actionType,
      entityType,
      entityId,
      entityName,
      oldValue,
      newValue,
      changesSummary,
      severity = 'info',
      status = 'success',
      errorMessage,
      departmentId,
      metadata,
    } = params;

    const { error } = await supabase.from('system_audit_logs').insert({
      organization_id: organizationId,
      user_id: userId,
      user_email: userEmail,
      user_name: userName,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_value: oldValue,
      new_value: newValue,
      changes_summary: changesSummary,
      severity,
      status,
      error_message: errorMessage,
      department_id: departmentId,
      metadata,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log audit:', error);
    }
  } catch (error) {
    console.error('Exception in logAudit:', error);
  }
}

export async function logUserSession(
  action: 'login' | 'logout',
  params: SessionParams
): Promise<string | null> {
  try {
    const { userId, organizationId, userEmail, userName, departmentId } = params;

    if (action === 'login') {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          user_email: userEmail,
          user_name: userName,
          department_id: departmentId,
          login_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to log login session:', error);
        return null;
      }

      await logAudit({
        organizationId,
        userId,
        userEmail,
        userName,
        actionType: 'login',
        entityType: 'session',
        entityName: `${userName} oturum açtı`,
        changesSummary: 'Kullanıcı sisteme giriş yaptı',
        severity: 'info',
        status: 'success',
        departmentId,
      });

      return data.id;
    } else if (action === 'logout') {
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('login_at', { ascending: false })
        .limit(1);

      if (sessions && sessions.length > 0) {
        const sessionId = sessions[0].id;
        const logoutTime = new Date().toISOString();

        const { error } = await supabase
          .from('user_sessions')
          .update({
            logout_at: logoutTime,
            is_active: false,
            updated_at: logoutTime,
          })
          .eq('id', sessionId);

        if (error) {
          console.error('Failed to log logout session:', error);
        }

        await logAudit({
          organizationId,
          userId,
          userEmail,
          userName,
          actionType: 'logout',
          entityType: 'session',
          entityName: `${userName} oturum kapattı`,
          changesSummary: 'Kullanıcı sistemden çıkış yaptı',
          severity: 'info',
          status: 'success',
          departmentId,
        });

        return sessionId;
      }
    }

    return null;
  } catch (error) {
    console.error('Exception in logUserSession:', error);
    return null;
  }
}

export async function updateSessionActivity(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        last_activity_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to update session activity:', error);
    }
  } catch (error) {
    console.error('Exception in updateSessionActivity:', error);
  }
}

export function getChangesSummary(
  action: ActionType,
  entityType: EntityType,
  entityName?: string,
  oldValue?: any,
  newValue?: any
): string {
  const entity = entityName || entityType;

  switch (action) {
    case 'create':
      return `Yeni ${entity} oluşturuldu`;
    case 'update':
      if (oldValue && newValue) {
        const changes = Object.keys(newValue)
          .filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
          .map((key) => key)
          .join(', ');
        return `${entity} güncellendi. Değişen alanlar: ${changes}`;
      }
      return `${entity} güncellendi`;
    case 'delete':
      return `${entity} silindi`;
    case 'approve':
      return `${entity} onaylandı`;
    case 'reject':
      return `${entity} reddedildi`;
    case 'submit':
      return `${entity} gönderildi`;
    case 'export':
      return `${entity} dışa aktarıldı`;
    case 'upload':
      return `${entity} yüklendi`;
    case 'view':
      return `${entity} görüntülendi`;
    default:
      return `${entity} üzerinde ${action} işlemi yapıldı`;
  }
}

export async function logCRUDOperation(
  action: 'create' | 'update' | 'delete',
  entityType: EntityType,
  entityData: {
    id?: string;
    name?: string;
    title?: string;
    code?: string;
  },
  options: {
    organizationId?: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    departmentId?: string;
    oldValue?: any;
    newValue?: any;
    severity?: SeverityLevel;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const entityName =
    entityData.name || entityData.title || entityData.code || entityData.id;

  const changesSummary = getChangesSummary(
    action,
    entityType,
    entityName,
    options.oldValue,
    options.newValue
  );

  await logAudit({
    organizationId: options.organizationId,
    userId: options.userId,
    userEmail: options.userEmail,
    userName: options.userName,
    actionType: action,
    entityType,
    entityId: entityData.id,
    entityName,
    oldValue: options.oldValue,
    newValue: options.newValue,
    changesSummary,
    severity: options.severity || (action === 'delete' ? 'warning' : 'info'),
    status: 'success',
    departmentId: options.departmentId,
    metadata: options.metadata,
  });
}
