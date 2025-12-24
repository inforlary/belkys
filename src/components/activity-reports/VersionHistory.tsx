import { useState, useEffect } from 'react';
import { History, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface Version {
  id: string;
  version_number: number;
  title: string;
  content: any;
  change_description: string;
  created_at: string;
  changed_by_profile: {
    full_name: string;
  };
}

interface VersionHistoryProps {
  reportId: string;
}

export default function VersionHistory({ reportId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (showModal) {
      loadVersions();
    }
  }, [showModal, reportId]);

  const loadVersions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_report_versions')
      .select(`
        id,
        version_number,
        title,
        content,
        change_description,
        created_at,
        changed_by_profile:profiles!changed_by(full_name)
      `)
      .eq('report_id', reportId)
      .order('version_number', { ascending: false });

    if (!error && data) {
      setVersions(data as any);
    }
    setLoading(false);
  };

  const handleViewVersion = (version: Version) => {
    setSelectedVersion(version);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setShowModal(true)} size="sm">
        <History className="h-4 w-4 mr-2" />
        Versiyon Geçmişi
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVersion(null);
        }}
        title="Versiyon Geçmişi"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedVersion ? (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setSelectedVersion(null)}
              size="sm"
            >
              ← Geri
            </Button>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Versiyon {selectedVersion.version_number}</h3>
                <p className="text-sm text-gray-600">{selectedVersion.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(selectedVersion.created_at).toLocaleString('tr-TR')} - {selectedVersion.changed_by_profile.full_name}
                </p>
                {selectedVersion.change_description && (
                  <p className="text-sm text-gray-700 mt-2 italic">"{selectedVersion.change_description}"</p>
                )}
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">İçerik:</h4>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{selectedVersion.content.description}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {versions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Henüz versiyon kaydı yok</p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm">v{version.version_number}</span>
                      <span className="text-sm text-gray-700">{version.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(version.created_at).toLocaleString('tr-TR')} - {version.changed_by_profile.full_name}
                    </p>
                    {version.change_description && (
                      <p className="text-xs text-gray-600 mt-1 italic">"{version.change_description}"</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewVersion(version)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
