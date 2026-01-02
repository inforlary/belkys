import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, FileText, Shield, AlertCircle, MessageSquare, Paperclip, Calendar, User, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Line } from 'recharts';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RiskDetails {
  id: string;
  risk_code: string;
  risk_title: string;
  risk_description: string;
  risk_category: string;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  status: string;
  risk_owner_id: string;
  risk_owner_name?: string;
  process_id?: string;
  process_name?: string;
  last_assessment_date: string;
  last_reviewed_by?: string;
  reviewer_name?: string;
  review_frequency_days: number;
  assessment_count: number;
  created_at: string;
  updated_at: string;
  metadata: any;
}

interface Assessment {
  id: string;
  assessment_date: string;
  assessment_type: string;
  inherent_score: number;
  residual_score: number;
  assessed_by_name: string;
  assessment_notes: string;
}

interface Control {
  id: string;
  control_code: string;
  control_title: string;
  control_type: string;
  operating_effectiveness: string;
  coverage_percentage: number;
  effectiveness_rating: string;
}

interface Finding {
  id: string;
  finding_code: string;
  finding_title: string;
  severity: string;
  status: string;
  identified_date: string;
}

interface Note {
  id: string;
  note_text: string;
  note_type: string;
  is_important: boolean;
  created_by_name: string;
  created_at: string;
}

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  description: string;
  uploaded_by_name: string;
  upload_date: string;
  file_size: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  strategic: 'Stratejik',
  operational: 'Operasyonel',
  financial: 'Finansal',
  compliance: 'Uyumluluk',
  reputational: 'İtibar'
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Tanımlanmış',
  assessed: 'Değerlendirilmiş',
  mitigating: 'Azaltma Çalışması',
  monitored: 'İzleniyor',
  accepted: 'Kabul Edildi',
  closed: 'Kapatıldı'
};

export default function RiskProfile() {
  const { profile } = useAuth();
  const { currentPath, navigate } = useLocation();
  const riskId = currentPath.split('/')[1];

  const [risk, setRisk] = useState<RiskDetails | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [appetiteViolation, setAppetiteViolation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'controls' | 'findings' | 'notes' | 'documents'>('overview');

  useEffect(() => {
    if (riskId && profile?.organization_id) {
      loadRiskData();
    }
  }, [riskId, profile?.organization_id]);

  const loadRiskData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRiskDetails(),
        loadAssessments(),
        loadControls(),
        loadFindings(),
        loadNotes(),
        loadDocuments(),
        loadAppetiteViolation()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadRiskDetails = async () => {
    const { data, error } = await supabase
      .from('ic_risks')
      .select(`
        *,
        risk_owner:risk_owner_id(full_name),
        reviewer:last_reviewed_by(full_name),
        ic_processes(name)
      `)
      .eq('id', riskId)
      .single();

    if (error) throw error;

    setRisk({
      ...data,
      risk_owner_name: data.risk_owner?.full_name,
      reviewer_name: data.reviewer?.full_name,
      process_name: data.ic_processes?.name
    });
  };

  const loadAssessments = async () => {
    const { data, error } = await supabase
      .from('ic_risk_assessments')
      .select(`
        *,
        assessed_by_profile:assessed_by(full_name)
      `)
      .eq('risk_id', riskId)
      .order('assessment_date', { ascending: false })
      .limit(20);

    if (error) throw error;

    setAssessments((data || []).map(a => ({
      ...a,
      assessed_by_name: a.assessed_by_profile?.full_name || 'Sistem'
    })));
  };

  const loadControls = async () => {
    const { data, error } = await supabase
      .from('ic_risk_control_links')
      .select(`
        *,
        ic_controls(
          id,
          control_code,
          control_title,
          control_type,
          operating_effectiveness
        )
      `)
      .eq('risk_id', riskId);

    if (error) throw error;

    setControls((data || []).map(link => ({
      ...link.ic_controls,
      coverage_percentage: link.coverage_percentage,
      effectiveness_rating: link.effectiveness_rating
    })));
  };

  const loadFindings = async () => {
    const { data, error } = await supabase
      .from('ic_findings')
      .select('*')
      .eq('risk_id', riskId)
      .order('identified_date', { ascending: false });

    if (error) throw error;
    setFindings(data || []);
  };

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from('ic_risk_notes')
      .select(`
        *,
        created_by_profile:created_by(full_name)
      `)
      .eq('risk_id', riskId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setNotes((data || []).map(n => ({
      ...n,
      created_by_name: n.created_by_profile?.full_name || 'Bilinmeyen'
    })));
  };

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('ic_risk_documents')
      .select(`
        *,
        uploaded_by_profile:uploaded_by(full_name)
      `)
      .eq('risk_id', riskId)
      .order('upload_date', { ascending: false });

    if (error) throw error;

    setDocuments((data || []).map(d => ({
      ...d,
      uploaded_by_name: d.uploaded_by_profile?.full_name || 'Bilinmeyen'
    })));
  };

  const loadAppetiteViolation = async () => {
    const { data, error } = await supabase
      .from('risk_appetite_violations')
      .select('*')
      .eq('risk_id', riskId)
      .eq('status', 'active')
      .single();

    if (data) {
      setAppetiteViolation(data);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 20) return { label: 'Kritik', color: 'text-red-600 bg-red-50' };
    if (score >= 15) return { label: 'Yüksek', color: 'text-orange-600 bg-orange-50' };
    if (score >= 10) return { label: 'Orta', color: 'text-yellow-600 bg-yellow-50' };
    if (score >= 5) return { label: 'Düşük', color: 'text-green-600 bg-green-50' };
    return { label: 'Çok Düşük', color: 'text-gray-600 bg-gray-50' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Risk bulunamadı</p>
        </div>
      </div>
    );
  }

  const inherentLevel = getRiskLevel(risk.inherent_score);
  const residualLevel = getRiskLevel(risk.residual_score);
  const riskReduction = ((risk.inherent_score - risk.residual_score) / risk.inherent_score * 100).toFixed(1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('risk-management')}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{risk.risk_code}</h1>
            <p className="text-gray-500">{risk.risk_title}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            risk.risk_category === 'strategic' ? 'bg-purple-100 text-purple-800' :
            risk.risk_category === 'operational' ? 'bg-blue-100 text-blue-800' :
            risk.risk_category === 'financial' ? 'bg-green-100 text-green-800' :
            risk.risk_category === 'compliance' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {CATEGORY_LABELS[risk.risk_category]}
          </span>
        </div>
      </div>

      {appetiteViolation && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Risk İştahı İhlali</h4>
              <p className="text-sm text-red-800 mt-1">
                Bu risk tanımlı iştah limitlerini aşmaktadır. Artık Skor: {appetiteViolation.residual_score},
                Limit: {appetiteViolation.appetite_limit}, Aşım: +{appetiteViolation.excess_amount}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Doğal Risk</span>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <div className={`text-3xl font-bold ${inherentLevel.color.split(' ')[0]} mb-2`}>
            {risk.inherent_score}
          </div>
          <div className="text-xs text-gray-600">
            {risk.inherent_likelihood} × {risk.inherent_impact}
          </div>
          <div className={`text-xs mt-2 px-2 py-1 rounded ${inherentLevel.color}`}>
            {inherentLevel.label}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Artık Risk</span>
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div className={`text-3xl font-bold ${residualLevel.color.split(' ')[0]} mb-2`}>
            {risk.residual_score}
          </div>
          <div className="text-xs text-gray-600">
            {risk.residual_likelihood} × {risk.residual_impact}
          </div>
          <div className={`text-xs mt-2 px-2 py-1 rounded ${residualLevel.color}`}>
            {residualLevel.label}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Risk Azalması</span>
            <TrendingDown className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-600 mb-2">
            {riskReduction}%
          </div>
          <div className="text-xs text-gray-600">
            {risk.inherent_score} → {risk.residual_score}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Durum</span>
            <Activity className="w-5 h-5 text-gray-500" />
          </div>
          <div className="text-sm font-medium text-gray-900 mb-2">
            {STATUS_LABELS[risk.status]}
          </div>
          <div className="text-xs text-gray-600">
            {risk.assessment_count} Değerlendirme
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Genel Bakış', icon: FileText },
              { id: 'history', label: 'Değerlendirme Geçmişi', icon: Calendar },
              { id: 'controls', label: 'Kontroller', icon: Shield },
              { id: 'findings', label: 'Bulgular', icon: AlertCircle },
              { id: 'notes', label: 'Notlar', icon: MessageSquare },
              { id: 'documents', label: 'Dökümanlar', icon: Paperclip }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.id === 'controls' && controls.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    {controls.length}
                  </span>
                )}
                {tab.id === 'findings' && findings.length > 0 && (
                  <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
                    {findings.length}
                  </span>
                )}
                {tab.id === 'notes' && notes.length > 0 && (
                  <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                    {notes.length}
                  </span>
                )}
                {tab.id === 'documents' && documents.length > 0 && (
                  <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                    {documents.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Risk Açıklaması</h3>
                <p className="text-gray-700">{risk.risk_description || 'Açıklama girilmemiş'}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Risk Sahibi</h4>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{risk.risk_owner_name || 'Atanmamış'}</span>
                  </div>
                </div>

                {risk.process_name && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">İlgili Süreç</h4>
                    <span className="text-gray-900">{risk.process_name}</span>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Son Değerlendirme</h4>
                  <span className="text-gray-900">
                    {risk.last_assessment_date ? new Date(risk.last_assessment_date).toLocaleDateString('tr-TR') : 'Yapılmamış'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Gözden Geçirme Sıklığı</h4>
                  <span className="text-gray-900">{risk.review_frequency_days} gün</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {assessments.length > 0 && (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Risk Skoru Trendi</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={[...assessments].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="assessment_date"
                          tickFormatter={(date) => new Date(date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis domain={[0, 25]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="inherent_score" name="Doğal Risk" stroke="#f97316" />
                        <Line type="monotone" dataKey="residual_score" name="Artık Risk" stroke="#3b82f6" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Değerlendirme Kayıtları</h3>
                    <div className="space-y-3">
                      {assessments.map(assessment => (
                        <div key={assessment.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(assessment.assessment_date).toLocaleDateString('tr-TR')}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {assessment.assessment_type === 'initial' ? 'İlk Değerlendirme' :
                               assessment.assessment_type === 'periodic' ? 'Periyodik' :
                               assessment.assessment_type === 'event_driven' ? 'Olay Bazlı' : 'Kontrol Sonrası'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span>Doğal: {assessment.inherent_score}</span>
                            <span>Artık: {assessment.residual_score}</span>
                            <span>•</span>
                            <span>{assessment.assessed_by_name}</span>
                          </div>
                          {assessment.assessment_notes && (
                            <p className="text-sm text-gray-700 mt-2">{assessment.assessment_notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {assessments.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Henüz değerlendirme kaydı bulunmuyor</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'controls' && (
            <div>
              {controls.length > 0 ? (
                <div className="space-y-3">
                  {controls.map(control => (
                    <div key={control.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{control.control_code}</h4>
                          <p className="text-sm text-gray-700">{control.control_title}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          control.operating_effectiveness === 'effective' ? 'bg-green-100 text-green-800' :
                          control.operating_effectiveness === 'partially_effective' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {control.operating_effectiveness === 'effective' ? 'Etkin' :
                           control.operating_effectiveness === 'partially_effective' ? 'Kısmen Etkin' : 'Etkisiz'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>Kapsam: %{control.coverage_percentage}</span>
                        {control.effectiveness_rating && (
                          <span>Etkinlik: {control.effectiveness_rating}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Bu riske bağlı kontrol bulunmuyor</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'findings' && (
            <div>
              {findings.length > 0 ? (
                <div className="space-y-3">
                  {findings.map(finding => (
                    <div key={finding.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{finding.finding_code}</h4>
                          <p className="text-sm text-gray-700">{finding.finding_title}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          finding.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          finding.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {finding.severity === 'critical' ? 'Kritik' :
                           finding.severity === 'high' ? 'Yüksek' :
                           finding.severity === 'medium' ? 'Orta' : 'Düşük'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(finding.identified_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Bu riske bağlı bulgu bulunmuyor</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className={`border rounded-lg p-4 ${note.is_important ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{note.created_by_name}</span>
                          {note.is_important && (
                            <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">Önemli</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{note.note_text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Henüz not bulunmuyor</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Paperclip className="w-5 h-5 text-gray-400" />
                          <div>
                            <h4 className="font-medium text-gray-900">{doc.document_name}</h4>
                            {doc.description && (
                              <p className="text-sm text-gray-600">{doc.description}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {doc.document_type}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>{doc.uploaded_by_name}</span>
                        <span>•</span>
                        <span>{new Date(doc.upload_date).toLocaleDateString('tr-TR')}</span>
                        <span>•</span>
                        <span>{(doc.file_size / 1024).toFixed(2)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Paperclip className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Henüz döküman bulunmuyor</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
