export type WorkflowStatus = 'draft' | 'pending_approval' | 'approved';

export type StepType = 'process' | 'decision' | 'document' | 'system';

export interface WorkflowProcess {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  owner_department_id?: string;
  qm_process_id?: string;
  trigger_event?: string;
  outputs?: string;
  software_used?: string;
  legal_basis?: string;
  version: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowActor {
  id: string;
  workflow_id: string;
  order_index: number;
  title: string;
  department: string;
  role: string;
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  order_index: number;
  step_type: StepType;
  description: string;
  actor_id?: string;
  is_sensitive: boolean;
  yes_target_step?: string;
  no_target_step?: string;
  created_at: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  template_data: {
    actors: TemplateActor[];
    steps: TemplateStep[];
  };
  created_at: string;
}

export interface TemplateActor {
  title: string;
  department: string;
  role: string;
}

export interface TemplateStep {
  type: StepType;
  description: string;
  actorIndex: number;
  sensitive: boolean;
  yesTarget?: number;
  noTarget?: number;
}

export interface WorkflowFormData {
  code: string;
  name: string;
  description: string;
  owner_department_id: string;
  qm_process_id: string;
  trigger_event: string;
  outputs: string;
  software_used: string;
  legal_basis: string;
  actors: Omit<WorkflowActor, 'id' | 'workflow_id' | 'created_at'>[];
  steps: Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at'>[];
}

export interface WorkflowStatistics {
  total: number;
  approved: number;
  pending_approval: number;
  draft: number;
}

export const STEP_TYPE_CONFIG: Record<StepType, { label: string; color: string; icon: string; description: string; example: string }> = {
  process: {
    label: 'İşlem Adımı',
    color: '#3b82f6',
    icon: 'square',
    description: 'Normal bir işlem veya faaliyet adımı',
    example: 'Formu doldur, belgeyi incele'
  },
  decision: {
    label: 'Karar Noktası',
    color: '#f59e0b',
    icon: 'diamond',
    description: 'EVET/HAYIR kararı gerektiren adım',
    example: 'Onaylandı mı?, Tutar yeterli mi?'
  },
  document: {
    label: 'Belge/Doküman',
    color: '#10b981',
    icon: 'file-text',
    description: 'Belge, form veya doküman çıktısı',
    example: 'Onay belgesi, rapor, form'
  },
  system: {
    label: 'Sistem İşlemi',
    color: '#8b5cf6',
    icon: 'cpu',
    description: 'Otomatik sistem işlemi',
    example: 'E-posta gönder, bildirim at'
  }
};

export const ACTOR_TITLES = [
  'Başkan',
  'Başkan Yardımcısı',
  'Genel Sekreter',
  'Genel Sekreter Yardımcısı',
  'Müdür',
  'Müdür Yardımcısı',
  'Şef',
  'Uzman',
  'Memur',
  'Teknisyen',
  'İşçi',
  'Personel',
  'Vatandaş',
  'Sistem'
];

export const ACTOR_ROLES = [
  'Talep eden',
  'İnceleyen',
  'Değerlendiren',
  'Onaylayan',
  'Kontrol eden',
  'Uygulayan',
  'Kayıt eden',
  'Bilgilendiren',
  'Yönlendiren',
  'Son onaylayan'
];

export const DEPARTMENTS = [
  'Başkanlık',
  'Başkan Yardımcılığı',
  'Genel Sekreterlik',
  'Özel Kalem Müdürlüğü',
  'Strateji Geliştirme Müdürlüğü',
  'İnsan Kaynakları Müdürlüğü',
  'Mali Hizmetler Müdürlüğü',
  'Satın Alma Müdürlüğü',
  'Bilgi İşlem Müdürlüğü',
  'Hukuk İşleri Müdürlüğü',
  'Basın Yayın ve Halkla İlişkiler Müdürlüğü',
  'İmar ve Şehircilik Müdürlüğü',
  'Fen İşleri Müdürlüğü',
  'Park ve Bahçeler Müdürlüğü',
  'Temizlik İşleri Müdürlüğü',
  'Zabıta Müdürlüğü',
  'İtfaiye Müdürlüğü',
  'Kültür ve Sosyal İşler Müdürlüğü',
  'Destek Hizmetleri Müdürlüğü',
  'Yazı İşleri Müdürlüğü',
  'Diğer',
  'Tüm Birimler',
  'Harici'
];

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: 'Taslak',
  pending_approval: 'Onay Bekliyor',
  approved: 'Onaylandı'
};

export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800'
};
