import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Download, Trash2, X, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Modal from '../ui/Modal';

interface ProjectFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  description: string | null;
  uploaded_at: string;
  progress_id: string | null;
}

interface FilesTabProps {
  projectId: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Tümü', icon: '📁' },
  { id: 'photo', label: 'Fotoğraflar', icon: '📷' },
  { id: 'contract', label: 'Sözleşmeler', icon: '📋' },
  { id: 'hakedis', label: 'Hakedişler', icon: '💰' },
  { id: 'report', label: 'Raporlar', icon: '📊' },
  { id: 'other', label: 'Diğer', icon: '📄' }
];

const CATEGORY_LABELS: Record<string, string> = {
  contract: 'Sözleşmeler',
  hakedis: 'Hakedişler',
  report: 'Raporlar',
  photo: 'Fotoğraflar',
  other: 'Diğer'
};

export default function FilesTab({ projectId }: FilesTabProps) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    category: 'other',
    description: ''
  });

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Dosyalar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('Dosya boyutu 10MB\'dan büyük olamaz');
        return;
      }
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.category) {
      alert('Lütfen dosya seçin ve kategori belirleyin');
      return;
    }

    try {
      setUploading(true);

      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile?.organization_id}/${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath);

      let fileType = 'other';
      if (uploadForm.file.type.startsWith('image/')) fileType = 'image';
      else if (uploadForm.file.type === 'application/pdf') fileType = 'pdf';
      else if (uploadForm.file.type.includes('excel') || uploadForm.file.type.includes('spreadsheet')) fileType = 'excel';
      else if (uploadForm.file.type.includes('word') || uploadForm.file.type.includes('document')) fileType = 'word';

      await supabase
        .from('project_files')
        .insert({
          organization_id: profile?.organization_id,
          project_id: projectId,
          progress_id: null,
          file_url: publicUrl,
          file_name: uploadForm.file.name,
          file_type: uploadForm.file.type,
          file_size: uploadForm.file.size,
          category: uploadForm.category,
          description: uploadForm.description || null
        });

      alert('Dosya yüklendi');
      setShowUploadModal(false);
      resetUploadForm();
      loadFiles();
    } catch (error: any) {
      console.error('Dosya yüklenirken hata:', error);
      alert('Hata: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;

    try {
      const filePath = file.file_url.split('/').slice(-3).join('/');

      await supabase.storage
        .from('project-files')
        .remove([filePath]);

      await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id);

      alert('Dosya silindi');
      loadFiles();
    } catch (error: any) {
      console.error('Dosya silinirken hata:', error);
      alert('Hata: ' + error.message);
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      file: null,
      category: 'other',
      description: ''
    });
  };

  const filteredFiles = activeCategory === 'all'
    ? files
    : files.filter(f => f.category === activeCategory);

  const photos = filteredFiles.filter(f => f.file_type.startsWith('image/'));
  const documents = filteredFiles.filter(f => !f.file_type.startsWith('image/'));

  const documentsByCategory = documents.reduce((acc, file) => {
    const category = file.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(file);
    return acc;
  }, {} as Record<string, ProjectFile[]>);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    return '📎';
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const nextPhoto = () => {
    setLightboxIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
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
        <h3 className="text-lg font-semibold text-gray-900">Dosyalar</h3>
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Dosya Yükle
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="mr-2">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            {activeCategory === 'all' ? 'Henüz dosya yüklenmemiş' : `Bu kategoride dosya bulunmuyor`}
          </p>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
          >
            İlk dosyayı yükleyin
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {(activeCategory === 'all' || activeCategory === 'photo') && photos.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                <span className="mr-2">📷</span>
                Fotoğraflar
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    onClick={() => openLightbox(index)}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={photo.file_url}
                        alt={photo.file_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-sm text-gray-600">{formatDate(photo.uploaded_at)}</div>
                      {photo.progress_id && (
                        <div className="text-xs text-blue-600 mt-1">İlerleme Kaydı</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeCategory === 'all' || activeCategory !== 'photo') && documents.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                <span className="mr-2">📄</span>
                Belgeler
              </h4>
              <div className="space-y-6">
                {Object.entries(documentsByCategory).map(([category, categoryFiles]) => (
                  <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h5 className="font-semibold text-gray-900">
                        <span className="mr-2">📋</span>
                        {CATEGORY_LABELS[category] || 'Diğer'}
                      </h5>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {categoryFiles.map((file) => (
                        <div key={file.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span>{getFileIcon(file.file_type)}</span>
                                <span className="font-medium text-gray-900">{file.file_name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                <span>{formatSize(file.file_size)}</span>
                                <span>{formatDate(file.uploaded_at)}</span>
                              </div>
                              {file.description && (
                                <div className="text-sm text-gray-600 mt-2">
                                  Açıklama: {file.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                İndir
                              </a>
                              <button
                                onClick={() => handleDelete(file)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showUploadModal && (
        <Modal onClose={() => { setShowUploadModal(false); resetUploadForm(); }} title="Dosya Yükle">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dosya Seç <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                  className="hidden"
                  id="file-upload-input"
                />
                <label htmlFor="file-upload-input" className="cursor-pointer">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-gray-600">Dosya sürükleyin veya tıklayın</p>
                  <p className="text-sm text-gray-500 mt-1">JPG, PNG, PDF, Excel, Word (max 10MB)</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Dosya Seç
                  </button>
                </label>
              </div>
              {uploadForm.file && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span>{getFileIcon(uploadForm.file.type)}</span>
                    <span className="text-sm font-medium">{uploadForm.file.name}</span>
                    <span className="text-xs text-gray-500">({formatSize(uploadForm.file.size)})</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="photo">Fotoğraf</option>
                <option value="contract">Sözleşme</option>
                <option value="hakedis">Hakediş</option>
                <option value="report">Rapor</option>
                <option value="other">Diğer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama (İsteğe Bağlı)
              </label>
              <textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Dosya açıklaması..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer"
                disabled={uploading}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadForm.file}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showLightbox && photos.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                className="absolute left-4 text-white hover:text-gray-300"
              >
                <ChevronLeft className="w-12 h-12" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                className="absolute right-4 text-white hover:text-gray-300"
              >
                <ChevronRight className="w-12 h-12" />
              </button>
            </>
          )}

          <div className="max-w-7xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightboxIndex].file_url}
              alt={photos[lightboxIndex].file_name}
              className="max-w-full max-h-full object-contain"
            />
            <div className="text-center mt-4 text-white">
              <div className="font-medium">{photos[lightboxIndex].file_name}</div>
              <div className="text-sm text-gray-300 mt-1">
                {formatDate(photos[lightboxIndex].uploaded_at)}
              </div>
              {photos.length > 1 && (
                <div className="text-sm text-gray-400 mt-2">
                  {lightboxIndex + 1} / {photos.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
