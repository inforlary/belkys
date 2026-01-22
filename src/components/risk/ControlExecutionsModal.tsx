import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, CheckCircle, XCircle, AlertCircle, Calendar, User, FileText, X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface ControlExecution {
  id: string;
  control_id: string;
  execution_date: string;
  executed_by: string;
  status: string;
  effectiveness_rating: number | null;
  evidence_description: string;
  notes: string;
  issues_found: boolean;
  issues_description: string;
  corrective_actions_needed: string;
  corrective_action_deadline: string | null;
  executor?: {
    full_name: string;
  };
}

interface Props {
  controlId: string;
  controlName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const statusLabels: Record<string, { label: string; icon: any; color: string }> = {
  PLANNED: { label: 'Planlandı', icon: Calendar, color: 'text-gray-600 bg-gray-100' },
  IN_PROGRESS: { label: 'Devam Ediyor', icon: AlertCircle, color: 'text-blue-600 bg-blue-100' },
  COMPLETED: { label: 'Tamamlandı', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  FAILED: { label: 'Başarısız', icon: XCircle, color: 'text-red-600 bg-red-100' },
  PARTIAL: { label: 'Kısmi', icon: AlertCircle, color: 'text-yellow-600 bg-yellow-100' },
  NOT_APPLICABLE: { label: 'Uygulanamadı', icon: XCircle, color: 'text-gray-600 bg-gray-100' }
};

export default function ControlExecutionsModal({ controlId, controlName, isOpen, onClose, onUpdate }: Props) {
  const { profile } = useAuth();
  const [executions, setExecutions] = useState<ControlExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    execution_date: new Date().toISOString().split('T')[0],
    status: 'COMPLETED',
    effectiveness_rating: 4,
    evidence_description: '',
    notes: '',
    issues_found: false,
    issues_description: '',
    corrective_actions_needed: '',
    corrective_action_deadline: ''
  });

  useEffect(() => {
    if (isOpen && controlId) {
      loadExecutions();
    }
  }, [isOpen, controlId]);

  async function loadExecutions() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('control_executions')
        .select(`
          *,
          executor:profiles!executed_by(full_name)
        `)
        .eq('control_id', controlId)
        .order('execution_date', { ascending: false });

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Kontrol uygulamaları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const executionData = {
        control_id: controlId,
        organization_id: profile?.organization_id,
        executed_by: profile?.id,
        execution_date: formData.execution_date,
        status: formData.status,
        effectiveness_rating: formData.effectiveness_rating,
        evidence_description: formData.evidence_description,
        notes: formData.notes,
        issues_found: formData.issues_found,
        issues_description: formData.issues_description || null,
        corrective_actions_needed: formData.corrective_actions_needed || null,
        corrective_action_deadline: formData.corrective_action_deadline || null,
        created_by: profile?.id
      };

      const { error } = await supabase
        .from('control_executions')
        .insert(executionData);

      if (error) throw error;

      setFormData({
        execution_date: new Date().toISOString().split('T')[0],
        status: 'COMPLETED',
        effectiveness_rating: 4,
        evidence_description: '',
        notes: '',
        issues_found: false,
        issues_description: '',
        corrective_actions_needed: '',
        corrective_action_deadline: ''
      });

      setShowForm(false);
      loadExecutions();
      onUpdate();
    } catch (error) {
      console.error('Kontrol uygulaması kaydedilirken hata:', error);
      alert('Kontrol uygulaması kaydedilemedi');
    }
  }

  function getEffectivenessStars(value: number | null) {
    if (!value) return <span className="text-gray-400">-</span>;
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < value ? 'text-yellow-500' : 'text-gray-300'}>★</span>
    ));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Kontrol Uygulamaları: ${controlName}`} size="xl">
      <div className="space-y-4">
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Yeni Uygulama Kaydı Ekle
          </button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Yeni Kontrol Uygulaması</h4>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uygulama Tarihi <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.execution_date}
                  onChange={(e) => setFormData({ ...formData, execution_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durum <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  {Object.entries(statusLabels).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Etkinlik Değerlendirmesi
              </label>
              <div className="flex items-center gap-6">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <label key={rating} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="effectiveness_rating"
                      value={rating}
                      checked={formData.effectiveness_rating === rating}
                      onChange={(e) => setFormData({ ...formData, effectiveness_rating: parseInt(e.target.value) })}
                      className="text-blue-600"
                    />
                    <span className="text-yellow-500 text-lg">
                      {Array.from({ length: rating }, () => '★').join('')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kanıt/Belge Açıklaması
              </label>
              <input
                type="text"
                value={formData.evidence_description}
                onChange={(e) => setFormData({ ...formData, evidence_description: e.target.value })}
                placeholder="Örn: Ocak_imza_formu.pdf, İşlem kayıt defteri"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Uygulama detayları, gözlemler"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="issues_found"
                checked={formData.issues_found}
                onChange={(e) => setFormData({ ...formData, issues_found: e.target.checked })}
                className="rounded text-blue-600"
              />
              <label htmlFor="issues_found" className="text-sm font-medium text-gray-700">
                Sorun/Uygunsuzluk Tespit Edildi
              </label>
            </div>

            {formData.issues_found && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tespit Edilen Sorunlar
                  </label>
                  <textarea
                    value={formData.issues_description}
                    onChange={(e) => setFormData({ ...formData, issues_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Düzeltici Faaliyetler
                  </label>
                  <textarea
                    value={formData.corrective_actions_needed}
                    onChange={(e) => setFormData({ ...formData, corrective_actions_needed: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Düzeltme Termin Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.corrective_action_deadline}
                    onChange={(e) => setFormData({ ...formData, corrective_action_deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>Henüz kontrol uygulaması kaydı yok</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {executions.map((execution) => {
              const statusInfo = statusLabels[execution.status];
              const StatusIcon = statusInfo?.icon;

              return (
                <div
                  key={execution.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(execution.execution_date).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                        {execution.executor && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                            <User className="w-3 h-3" />
                            {execution.executor.full_name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo?.color}`}>
                        {StatusIcon && <StatusIcon className="w-3 h-3" />}
                        {statusInfo?.label}
                      </span>
                      <div className="flex items-center gap-1">
                        {getEffectivenessStars(execution.effectiveness_rating)}
                      </div>
                    </div>
                  </div>

                  {execution.evidence_description && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Kanıt:</span> {execution.evidence_description}
                    </div>
                  )}

                  {execution.notes && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Not:</span> {execution.notes}
                    </div>
                  )}

                  {execution.issues_found && (
                    <div className="mt-3 pt-3 border-t border-red-200 bg-red-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                      <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                        <AlertCircle className="w-4 h-4" />
                        Sorun Tespit Edildi
                      </div>
                      {execution.issues_description && (
                        <p className="text-sm text-red-700 mb-2">{execution.issues_description}</p>
                      )}
                      {execution.corrective_actions_needed && (
                        <div className="text-sm text-red-700">
                          <span className="font-medium">Düzeltici Faaliyet:</span> {execution.corrective_actions_needed}
                          {execution.corrective_action_deadline && (
                            <span className="ml-2">
                              (Termin: {new Date(execution.corrective_action_deadline).toLocaleDateString('tr-TR')})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
