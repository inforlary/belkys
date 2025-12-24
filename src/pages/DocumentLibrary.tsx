import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Folder,
  FolderPlus,
  Search,
  Filter,
  Share2,
  Clock,
  User,
  Tag,
  ChevronRight,
  X,
  Edit,
  Lock,
  Globe,
  Shield,
} from 'lucide-react';

interface DocumentCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  parent_id: string | null;
}

interface Document {
  id: string;
  category_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_extension: string;
  storage_path: string;
  title: string;
  description: string | null;
  tags: string[];
  version: number;
  access_level: string;
  download_count: number;
  created_at: string;
  updated_at: string;
  uploader?: {
    full_name: string;
    email: string;
  };
}

interface UploadFormData {
  title: string;
  description: string;
  category_id: string;
  tags: string;
  access_level: string;
  file: File | null;
}

export default function DocumentLibrary() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [uploadForm, setUploadForm] = useState<UploadFormData>({
    title: '',
    description: '',
    category_id: '',
    tags: '',
    access_level: 'restricted',
    file: null,
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    icon: 'folder',
    color: 'blue',
  });

  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalSize: 0,
    myDocuments: 0,
    recentUploads: 0,
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile, selectedCategory, searchTerm]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadDocuments(), loadStats()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('document_categories')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name');

    if (error) {
      console.error('Error loading categories:', error);
      return;
    }

    setCategories(data || []);
  };

  const loadDocuments = async () => {
    if (!profile?.organization_id) return;

    let query = supabase
      .from('documents')
      .select(`
        *,
        uploader:uploaded_by(full_name, email)
      `)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    if (searchTerm) {
      query = query.or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,file_name.ilike.%${searchTerm}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading documents:', error);
      return;
    }

    setDocuments(data || []);
  };

  const loadStats = async () => {
    if (!profile?.organization_id) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalCount, myCount, recentCount, sizeResult] = await Promise.all([
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id),
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('uploaded_by', profile.id),
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('documents')
        .select('file_size')
        .eq('organization_id', profile.organization_id),
    ]);

    const totalSize = sizeResult.data?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0;

    setStats({
      totalDocuments: totalCount.count || 0,
      totalSize,
      myDocuments: myCount.count || 0,
      recentUploads: recentCount.count || 0,
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !profile?.organization_id) return;

    setUploading(true);
    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.organization_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      const tags = uploadForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error: dbError } = await supabase.from('documents').insert({
        organization_id: profile.organization_id,
        category_id: uploadForm.category_id || null,
        uploaded_by: profile.id,
        file_name: uploadForm.file.name,
        file_size: uploadForm.file.size,
        file_type: uploadForm.file.type,
        file_extension: fileExt || '',
        storage_path: filePath,
        title: uploadForm.title,
        description: uploadForm.description || null,
        tags,
        access_level: uploadForm.access_level,
      });

      if (dbError) throw dbError;

      await supabase.rpc('create_notification', {
        p_user_id: profile.id,
        p_organization_id: profile.organization_id,
        p_type: 'info',
        p_title: 'Doküman Yüklendi',
        p_message: `"${uploadForm.title}" dokümanı başarıyla yüklendi.`,
        p_priority: 'low',
        p_category: 'general',
      });

      setShowUploadModal(false);
      setUploadForm({
        title: '',
        description: '',
        category_id: '',
        tags: '',
        access_level: 'restricted',
        file: null,
      });
      loadData();
      alert('Doküman başarıyla yüklendi!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Doküman yüklenirken bir hata oluştu.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await supabase.rpc('log_document_access', {
        p_document_id: doc.id,
        p_action: 'download',
      });

      loadDocuments();
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Doküman indirilirken bir hata oluştu.');
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`"${doc.title}" dokümanını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      loadData();
      alert('Doküman başarıyla silindi.');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Doküman silinirken bir hata oluştu.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const { error } = await supabase.from('document_categories').insert({
        organization_id: profile.organization_id,
        name: newCategory.name,
        description: newCategory.description || null,
        icon: newCategory.icon,
        color: newCategory.color,
        created_by: profile.id,
      });

      if (error) throw error;

      setShowCategoryModal(false);
      setNewCategory({ name: '', description: '', icon: 'folder', color: 'blue' });
      loadCategories();
      alert('Kategori başarıyla oluşturuldu!');
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Kategori oluşturulurken bir hata oluştu.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getAccessLevelIcon = (level: string) => {
    switch (level) {
      case 'public':
        return <Globe className="w-4 h-4" />;
      case 'restricted':
        return <Shield className="w-4 h-4" />;
      case 'private':
        return <Lock className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getAccessLevelText = (level: string) => {
    switch (level) {
      case 'public':
        return 'Herkese Açık';
      case 'restricted':
        return 'Kısıtlı';
      case 'private':
        return 'Özel';
      default:
        return 'Kısıtlı';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            Doküman Kütüphanesi
          </h1>
          <p className="text-gray-600 mt-1">Dokümanlarınızı yönetin ve paylaşın</p>
        </div>
        <div className="flex gap-3">
          {profile?.role === 'admin' && (
            <Button
              variant="outline"
              onClick={() => setShowCategoryModal(true)}
              icon={FolderPlus}
            >
              Kategori Oluştur
            </Button>
          )}
          <Button onClick={() => setShowUploadModal(true)} icon={Upload}>
            Doküman Yükle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Doküman</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Boyut</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatFileSize(stats.totalSize)}
                </p>
              </div>
              <Upload className="w-10 h-10 text-green-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dokümanlarım</p>
                <p className="text-2xl font-bold text-gray-900">{stats.myDocuments}</p>
              </div>
              <User className="w-10 h-10 text-purple-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Son 30 Gün</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recentUploads}</p>
              </div>
              <Clock className="w-10 h-10 text-orange-500" />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Kategoriler</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedCategory === null
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span>Tüm Dokümanlar</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span className="truncate">{category.name}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Doküman ara..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Yükleniyor...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm
                    ? 'Arama kriterinize uygun doküman bulunamadı.'
                    : 'Henüz doküman yüklenmemiş.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 mb-1 truncate">
                              {doc.title}
                            </h4>
                            {doc.description && (
                              <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {doc.uploader?.full_name || 'Bilinmiyor'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(doc.created_at).toLocaleDateString('tr-TR')}
                              </span>
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span className="flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                {doc.download_count}
                              </span>
                              <span className="flex items-center gap-1">
                                {getAccessLevelIcon(doc.access_level)}
                                {getAccessLevelText(doc.access_level)}
                              </span>
                            </div>
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                <Tag className="w-3 h-3 text-gray-400" />
                                <div className="flex gap-2 flex-wrap">
                                  {doc.tags.map((tag, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="İndir"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        {(doc.uploaded_by === profile?.id || profile?.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {showUploadModal && (
        <Modal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          title="Doküman Yükle"
        >
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dosya <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Başlık <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama
              </label>
              <textarea
                value={uploadForm.description}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori
              </label>
              <select
                value={uploadForm.category_id}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, category_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Kategori Seçin</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Etiketler (virgülle ayırın)
              </label>
              <input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                placeholder="örn: bütçe, 2024, stratejik"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Erişim Seviyesi
              </label>
              <select
                value={uploadForm.access_level}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, access_level: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="public">Herkese Açık</option>
                <option value="restricted">Kısıtlı (Yetkililer)</option>
                <option value="private">Özel (Sadece Ben)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={uploading} className="flex-1">
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUploadModal(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showCategoryModal && (
        <Modal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Kategori Oluştur"
        >
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama
              </label>
              <textarea
                value={newCategory.description}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                Oluştur
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCategoryModal(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
