import { useState, useEffect } from 'react';
import { FileText, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Template {
  id: string;
  name: string;
  description: string;
  sections: any[];
}

interface TemplateSelectorProps {
  onSelect: (template: Template | null) => void;
  selectedTemplateId?: string;
}

export default function TemplateSelector({ onSelect, selectedTemplateId }: TemplateSelectorProps) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [profile]);

  const loadTemplates = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('activity_report_templates')
      .select('id, name, description, sections')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTemplates(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Şablon Seç (Opsiyonel)
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => onSelect(null)}
          className={`p-3 border-2 rounded-lg text-left transition-all ${
            !selectedTemplateId
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-gray-500 mr-2" />
              <span className="font-medium text-sm">Şablonsuz</span>
            </div>
            {!selectedTemplateId && <Check className="h-5 w-5 text-blue-600" />}
          </div>
          <p className="text-xs text-gray-500 mt-1">Serbest format rapor</p>
        </button>

        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`p-3 border-2 rounded-lg text-left transition-all ${
              selectedTemplateId === template.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-medium text-sm">{template.name}</span>
              </div>
              {selectedTemplateId === template.id && (
                <Check className="h-5 w-5 text-blue-600" />
              )}
            </div>
            {template.description && (
              <p className="text-xs text-gray-500 mt-1">{template.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
