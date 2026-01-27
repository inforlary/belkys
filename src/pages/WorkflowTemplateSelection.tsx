import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, ShoppingCart, MessageCircle, Folder, Users, GitBranch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { WorkflowTemplate } from '../types/workflow';

const ICON_MAP: Record<string, any> = {
  calendar: Calendar,
  'shopping-cart': ShoppingCart,
  'message-circle': MessageCircle,
  folder: Folder
};

export default function WorkflowTemplateSelection() {
  const { navigate } = useLocation();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const { data, error } = await supabase
        .from('workflow_process_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/workflows')}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Şablon Seçin</h1>
          <p className="text-gray-600 mt-1">Hazır bir şablon seçerek hızlı başlayın veya sıfırdan oluşturun</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => {
          const Icon = ICON_MAP[template.icon] || Folder;
          const actorCount = template.template_data.actors?.length || 0;
          const stepCount = template.template_data.steps?.length || 0;

          return (
            <div
              key={template.id}
              onClick={() => navigate(`/workflows/create/${template.id}`)}
              className="bg-white rounded-lg shadow-md p-6 border-2 border-transparent hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Icon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {template.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{actorCount} görevli</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-4 h-4" />
                      <span>{stepCount} adım</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div
          onClick={() => navigate('/workflows/create/blank')}
          className="bg-white rounded-lg shadow-md p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
        >
          <div className="flex flex-col items-center justify-center text-center h-full py-8">
            <div className="p-3 bg-gray-100 text-gray-400 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors mb-4">
              <Folder className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Boş Süreç</h3>
            <p className="text-sm text-gray-600">Sıfırdan kendi iş akış şemanızı oluşturun</p>
          </div>
        </div>
      </div>
    </div>
  );
}
