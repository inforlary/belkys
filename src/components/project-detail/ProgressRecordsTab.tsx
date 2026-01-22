import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Calendar, TrendingUp, DollarSign, FileText, Download, X } from 'lucide-react';
import Modal from '../ui/Modal';

interface ProgressRecord {
  id: string;
  record_date: string;
  previous_physical: number;
  new_physical: number;
  previous_financial: number;
  new_financial: number;
  expense_amount: number;
  description: string;
  recorded_by: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
  files: ProgressFile[];
}

interface ProgressFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface ProgressRecordsTabProps {
  projectId: string;
  onUpdate: () => void;
}

export default function ProgressRecordsTab({ projectId, onUpdate }: ProgressRecordsTabProps) {
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<any>(null);

  const [formData, setFormData] = useState({
    record_date: new Date().toISOString().split('T')[0],
    new_physical: '',
    new_financial: '',
    expense_amount: '',
    description: ''
  });

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    loadRecords();
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('physical_progress, financial_progress')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Proje bilgileri yüklenemedi:', error);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);

      const { data: progressData, error: progressError } = await supabase
        .from('project_progress')
        .select(`
          *,
          profiles:recorded_by (
            full_name
          )
        `)
        .eq('project_id', projectId)
        .order('record_date', { ascending: false });

      if (progressError) throw progressError;

      const recordsWithFiles = await Promise.all(
        (progressData || []).map(async (record) => {
          const { data: filesData } = await supabase
            .from('project_files')
            .select('*')
            .eq('progress_id', record.id);

          return {
            ...record,
            files: filesData || []
          };
        })
      );

      setRecords(recordsWithFiles);
    } catch (error) {
      console.error('İlerleme kayıtları yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    setUploadedFiles([...uploadedFiles, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors: any = {};

    if (!formData.new_physical) {
      newErrors.new_physical = 'Yeni fiziki ilerleme giriniz';
    } else if (Number(formData.new_physical) < 0 || Number(formData.new_physical) > 100) {
      newErrors.new_physical = 'Değer 0-100 arasında olmalı';
    }

    if (formData.description.length < 50) {
      newErrors.description = 'Açıklama en az 50 karakter olmalı';
    }

    if (uploadedFiles.length === 0) {
      newErrors.files = 'En az 1 dosya yüklemelisiniz';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      const newPhysical = Number(formData.new_physical);
      const newFinancial = formData.new_financial ? Number(formData.new_financial) : newPhysical;
      const expenseAmount = formData.expense_amount ? Number(formData.expense_amount) : 0;

      const { data: progressRecord, error: progressError } = await supabase
        .from('project_progress')
        .insert({
          organization_id: profile?.organization_id,
          project_id: projectId,
          record_date: formData.record_date,
          previous_physical: project?.physical_progress || 0,
          new_physical: newPhysical,
          previous_financial: project?.financial_progress || 0,
          new_financial: newFinancial,
          expense_amount: expenseAmount,
          description: formData.description,
          recorded_by: profile?.id
        })
        .select()
        .single();

      if (progressError) throw progressError;

      for (const file of uploadedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile?.organization_id}/${projectId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Dosya yükleme hatası:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(filePath);

        await supabase
          .from('project_files')
          .insert({
            organization_id: profile?.organization_id,
            project_id: projectId,
            progress_id: progressRecord.id,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            category: 'photo',
            description: null
          });
      }

      await supabase
        .from('projects')
        .update({
          physical_progress: newPhysical,
          financial_progress: newFinancial,
          total_expense: expenseAmount,
          last_update_date: new Date().toISOString()
        })
        .eq('id', projectId);

      alert('İlerleme kaydı eklendi');
      setShowModal(false);
      resetForm();
      loadRecords();
      onUpdate();
    } catch (error: any) {
      console.error('Kayıt eklenirken hata:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      record_date: new Date().toISOString().split('T')[0],
      new_physical: '',
      new_financial: '',
      expense_amount: '',
      description: ''
    });
    setUploadedFiles([]);
    setErrors({});
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    return '📎';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">İlerleme Kayıtları</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          İlerleme Ekle
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Henüz ilerleme kaydı eklenmemiş</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            İlk kaydı ekleyin
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {formatDate(record.record_date)}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Kaydeden: {record.profiles?.full_name || 'Bilinmiyor'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 mb-2">Fiziki İlerleme</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500">%{record.previous_physical}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 font-bold">%{record.new_physical}</span>
                    <span className={`text-sm ${record.new_physical > record.previous_physical ? 'text-green-600' : 'text-gray-400'}`}>
                      ({record.new_physical > record.previous_physical ? '+' : ''}{(record.new_physical - record.previous_physical).toFixed(0)})
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${record.new_physical}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 mb-2">Nakdi İlerleme</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500">%{record.previous_financial}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600 font-bold">%{record.new_financial}</span>
                    <span className={`text-sm ${record.new_financial > record.previous_financial ? 'text-green-600' : 'text-gray-400'}`}>
                      ({record.new_financial > record.previous_financial ? '+' : ''}{(record.new_financial - record.previous_financial).toFixed(0)})
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${record.new_financial}%` }}
                    />
                  </div>
                </div>
              </div>

              {record.expense_amount > 0 && (
                <div className="flex items-center gap-2 mb-4 text-gray-700">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold">Harcama:</span>
                  <span>{formatCurrency(record.expense_amount)} ₺</span>
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-start gap-2 text-gray-700">
                  <FileText className="w-4 h-4 mt-1 flex-shrink-0" />
                  <p className="text-sm">{record.description}</p>
                </div>
              </div>

              {record.files.length > 0 && (
                <div>
                  <div className="text-sm text-gray-600 mb-2">Dosyalar:</div>
                  <div className="flex flex-wrap gap-2">
                    {record.files.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                      >
                        <span>{getFileIcon(file.file_type)}</span>
                        <span className="max-w-[150px] truncate">{file.file_name}</span>
                        <Download className="w-3 h-3 text-gray-500" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal onClose={() => { setShowModal(false); resetForm(); }} title="Yeni İlerleme Kaydı" size="large">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tarih</label>
              <input
                type="date"
                value={formData.record_date}
                onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fiziki İlerleme</label>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Mevcut:</div>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-center font-semibold">
                      %{project?.physical_progress || 0}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Yeni:</div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.new_physical}
                      onChange={(e) => setFormData({ ...formData, new_physical: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.new_physical ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="0-100"
                    />
                  </div>
                </div>
                {errors.new_physical && (
                  <p className="text-red-500 text-sm mt-1">{errors.new_physical}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nakdi İlerleme (İsteğe Bağlı)</label>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Mevcut:</div>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-center font-semibold">
                      %{project?.financial_progress || 0}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Yeni:</div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.new_financial}
                      onChange={(e) => setFormData({ ...formData, new_financial: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Harcama Miktarı (₺)</label>
              <input
                type="number"
                min="0"
                value={formData.expense_amount}
                onChange={(e) => setFormData({ ...formData, expense_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Min 50 karakter - {formData.description.length}/50)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Yapılan işleri detaylı açıklayın..."
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">{errors.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dosya Yükleme <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Min 1 dosya, max 10MB)</span>
              </label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center ${errors.files ? 'border-red-500' : 'border-gray-300'}`}>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-gray-600">Fotoğraf veya dosya sürükleyin</p>
                  <p className="text-sm text-gray-500 mt-1">JPG, PNG, PDF (max 10MB)</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Dosya Seç
                  </button>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{getFileIcon(file.type)}</span>
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errors.files && (
                <p className="text-red-500 text-sm mt-1">{errors.files}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
