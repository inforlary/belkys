import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import {
  ShieldCheck,
  Plus,
  Calendar,
  Building,
  FileText,
  Download,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';

interface AssuranceStatement {
  id: string;
  year: number;
  type: string;
  unit_id: string | null;
  declarant_name: string;
  declarant_title: string;
  declaration_date: string;
  assurance_level: string;
  scope_statement: string;
  responsibility_statement: string;
  assessment_statement: string;
  limitations_statement: string | null;
  conclusion_statement: string;
  signature_url: string | null;
  status: string;
  unit?: {
    name: string;
  } | null;
}

const typeLabels: Record<string, string> = {
  unit: 'Birim Güvence Beyanı',
  institution: 'Üst Yönetici Güvence Beyanı',
};

const assuranceLevelLabels: Record<string, string> = {
  full: 'Tam Güvence',
  qualified: 'Şartlı/Sınırlı Güvence',
  adverse: 'Olumsuz Güvence',
};

const assuranceLevelColors: Record<string, string> = {
  full: 'green',
  qualified: 'yellow',
  adverse: 'red',
};

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Onay Bekliyor',
  approved: 'Onaylandı',
  published: 'Yayınlandı',
};

const statusColors: Record<string, string> = {
  draft: 'gray',
  submitted: 'yellow',
  approved: 'green',
  published: 'blue',
};

export default function ICAssuranceStatements() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [statements, setStatements] = useState<AssuranceStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [type, setType] = useState<'unit' | 'institution'>('institution');
  const [declarantName, setDeclarantName] = useState('');
  const [declarantTitle, setDeclarantTitle] = useState('');
  const [assuranceLevel, setAssuranceLevel] = useState<'full' | 'qualified' | 'adverse'>('full');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStatements();
  }, [profile]);

  const loadStatements = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('ic_assurance_statements')
        .select(`
          *,
          unit:departments(name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('year', { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (error) {
      console.error('Error loading statements:', error);
    } finally {
      setLoading(false);
    }
  };

  const createStatement = async () => {
    if (!profile?.organization_id || !profile?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ic_assurance_statements')
        .insert({
          organization_id: profile.organization_id,
          year: year,
          type: type,
          unit_id: type === 'unit' ? profile.department_id : null,
          declarant_name: declarantName,
          declarant_title: declarantTitle,
          declaration_date: new Date().toISOString().split('T')[0],
          assurance_level: assuranceLevel,
          scope_statement: 'Kapsam beyanı buraya girilecek.',
          responsibility_statement: 'Sorumluluk beyanı buraya girilecek.',
          assessment_statement: 'Değerlendirme beyanı buraya girilecek.',
          conclusion_statement: 'Sonuç beyanı buraya girilecek.',
          status: 'draft',
          created_by: profile.id
        });

      if (error) throw error;

      setShowNewModal(false);
      resetForm();
      await loadStatements();
    } catch (error: any) {
      console.error('Error creating statement:', error);
      if (error.code === '23505') {
        alert('Bu yıl için zaten bir beyan mevcut');
      } else {
        alert('Beyan oluşturulurken hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteStatement = async (id: string) => {
    if (!confirm('Bu beyanı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_assurance_statements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadStatements();
    } catch (error) {
      console.error('Error deleting statement:', error);
      alert('Beyan silinirken hata oluştu');
    }
  };

  const resetForm = () => {
    setYear(new Date().getFullYear());
    setType('institution');
    setDeclarantName('');
    setDeclarantTitle('');
    setAssuranceLevel('full');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'director';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Güvence Beyanları
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            İç kontrol sistemi güvence beyanlarının yönetimi
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Yeni Beyan
          </Button>
        )}
      </div>

      {statements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Henüz güvence beyanı yok
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Güvence beyanı oluşturarak başlayın
          </p>
          {isAdmin && (
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              İlk Beyanı Oluştur
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {statements.map((statement) => (
            <div
              key={statement.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {typeLabels[statement.type]} - {statement.year}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={statement.status}
                      label={statusLabels[statement.status]}
                      variant={statusColors[statement.status] as any}
                    />
                    <StatusBadge
                      status={statement.assurance_level}
                      label={assuranceLevelLabels[statement.assurance_level]}
                      variant={assuranceLevelColors[statement.assurance_level] as any}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>{statement.declarant_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building className="w-4 h-4" />
                  <span>{statement.declarant_title}</span>
                </div>
                {statement.unit && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building className="w-4 h-4" />
                    <span>Birim: {statement.unit.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Beyan Tarihi: {new Date(statement.declaration_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 line-clamp-3">
                  {statement.conclusion_statement}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/ic-assurance-statements/${statement.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Detaylar
                </Button>
                {isAdmin && statement.status === 'draft' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/ic-assurance-statements/${statement.id}/edit`)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Düzenle
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteStatement(statement.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Sil
                    </Button>
                  </>
                )}
                {statement.status === 'published' && (
                  <Button
                    variant="secondary"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF İndir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <Modal
          isOpen={showNewModal}
          onClose={() => {
            setShowNewModal(false);
            resetForm();
          }}
          title="Yeni Güvence Beyanı"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yıl
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beyan Türü
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'unit' | 'institution')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="institution">Üst Yönetici Güvence Beyanı</option>
                <option value="unit">Birim Güvence Beyanı</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beyan Veren Adı
              </label>
              <input
                type="text"
                value={declarantName}
                onChange={(e) => setDeclarantName(e.target.value)}
                placeholder="Ad Soyad"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unvan
              </label>
              <input
                type="text"
                value={declarantTitle}
                onChange={(e) => setDeclarantTitle(e.target.value)}
                placeholder="Unvan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Güvence Düzeyi
              </label>
              <select
                value={assuranceLevel}
                onChange={(e) => setAssuranceLevel(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="full">Tam Güvence</option>
                <option value="qualified">Şartlı/Sınırlı Güvence</option>
                <option value="adverse">Olumsuz Güvence</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                Beyan taslak olarak oluşturulacaktır. Detaylı içeriği daha sonra düzenleyebilirsiniz.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewModal(false);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button
                onClick={createStatement}
                disabled={!declarantName || !declarantTitle || saving}
              >
                {saving ? 'Oluşturuluyor...' : 'Oluştur'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
