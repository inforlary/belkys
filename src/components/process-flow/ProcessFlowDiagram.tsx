import { useState, useRef, useEffect } from 'react';
import {
  Network, X, Save, Download, Eye, Grid3x3, Layers, GitBranch,
  Move, Maximize2, ZoomIn, ZoomOut, RotateCcw, Share2, Clock,
  MapPin, AlertCircle, Play, Square, Diamond, GitMerge, FileText,
  ChevronDown, ChevronUp, Workflow
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ProcessStep {
  id: string;
  process_id: string;
  step_number: number;
  step_name: string;
  step_description: string;
  responsible_role: string;
  responsible_user_id: string;
  responsible_user_name?: string;
  inputs: string;
  outputs: string;
  tools_used: string;
  estimated_duration: string;
  step_type: 'process' | 'decision' | 'parallel_start' | 'parallel_end' | 'subprocess' | 'start' | 'end';
  is_critical_control_point: boolean;
  parallel_group?: number;
  next_step_condition?: string;
  subprocess_id?: string;
  position_x?: number;
  position_y?: number;
  swim_lane?: string;
}

interface Process {
  id: string;
  code: string;
  name: string;
  description: string;
  department_name?: string;
}

interface FlowDiagramVersion {
  id: string;
  version: number;
  diagram_data: any;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

interface ProcessFlowDiagramProps {
  process: Process;
  steps: ProcessStep[];
  onClose: () => void;
  onStepsUpdate: () => void;
}

type ViewMode = 'vertical' | 'swimlane' | 'horizontal';

export default function ProcessFlowDiagram({ process, steps, onClose, onStepsUpdate }: ProcessFlowDiagramProps) {
  const { profile } = useAuth();
  const diagramRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('vertical');
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [versions, setVersions] = useState<FlowDiagramVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadVersions();
  }, [process.id]);

  const loadVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_process_flow_diagrams')
        .select('*')
        .eq('process_id', process.id)
        .order('version', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Versiyonlar yüklenirken hata:', error);
    }
  };

  const saveVersion = async () => {
    if (!profile?.organization_id) return;

    try {
      const diagramData = {
        nodes: steps.map(step => ({
          id: step.id,
          step_number: step.step_number,
          step_name: step.step_name,
          step_type: step.step_type,
          position_x: step.position_x,
          position_y: step.position_y,
          swim_lane: step.swim_lane,
          parallel_group: step.parallel_group
        })),
        viewMode,
        metadata: {
          saved_at: new Date().toISOString(),
          step_count: steps.length
        }
      };

      const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0;

      await supabase
        .from('ic_process_flow_diagrams')
        .update({ is_current: false })
        .eq('process_id', process.id);

      const { error } = await supabase
        .from('ic_process_flow_diagrams')
        .insert({
          organization_id: profile.organization_id,
          ic_plan_id: steps[0]?.ic_plan_id,
          process_id: process.id,
          diagram_name: `${process.name} - Versiyon ${maxVersion + 1}`,
          diagram_type: 'flowchart',
          diagram_data: diagramData,
          version: maxVersion + 1,
          is_current: true,
          created_by: profile.id
        });

      if (error) throw error;

      alert('Diyagram versiyonu kaydedildi!');
      loadVersions();
    } catch (error) {
      console.error('Versiyon kaydedilirken hata:', error);
      alert('Versiyon kaydedilemedi');
    }
  };

  const exportAsPNG = async () => {
    if (!diagramRef.current) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      const link = document.createElement('a');
      link.download = `${process.code}-akis-diyagrami.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('PNG dışa aktarma hatası:', error);
      alert('PNG oluşturulamadı');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!diagramRef.current) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${process.code}-akis-diyagrami.pdf`);
    } catch (error) {
      console.error('PDF dışa aktarma hatası:', error);
      alert('PDF oluşturulamadı');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDragStart = (stepId: string) => {
    if (!isEditMode) return;
    setDraggedStep(stepId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStepId: string) => {
    if (!draggedStep || draggedStep === targetStepId) return;

    const draggedIndex = steps.findIndex(s => s.id === draggedStep);
    const targetIndex = steps.findIndex(s => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    try {
      const draggedStepNumber = steps[draggedIndex].step_number;
      const targetStepNumber = steps[targetIndex].step_number;

      await supabase
        .from('ic_process_steps')
        .update({ step_number: targetStepNumber })
        .eq('id', draggedStep);

      await supabase
        .from('ic_process_steps')
        .update({ step_number: draggedStepNumber })
        .eq('id', targetStepId);

      onStepsUpdate();
    } catch (error) {
      console.error('Adım sırası güncellenemedi:', error);
    }

    setDraggedStep(null);
  };

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'start': return <Play className="w-5 h-5" />;
      case 'end': return <Square className="w-5 h-5" />;
      case 'decision': return <Diamond className="w-5 h-5" />;
      case 'parallel_start': return <GitBranch className="w-5 h-5" />;
      case 'parallel_end': return <GitMerge className="w-5 h-5" />;
      case 'subprocess': return <FileText className="w-5 h-5" />;
      default: return <Workflow className="w-5 h-5" />;
    }
  };

  const getStepShape = (stepType: string) => {
    switch (stepType) {
      case 'decision':
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'start':
      case 'end':
        return 'circle(50%)';
      case 'subprocess':
        return 'inset(0% 0% 0% 0% round 12px)';
      default:
        return 'inset(0% 0% 0% 0% round 8px)';
    }
  };

  const getStepColor = (step: ProcessStep) => {
    if (step.is_critical_control_point) return 'bg-red-50 border-red-500 text-red-900';
    switch (step.step_type) {
      case 'start': return 'bg-green-50 border-green-500 text-green-900';
      case 'end': return 'bg-gray-700 border-gray-800 text-white';
      case 'decision': return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      case 'parallel_start':
      case 'parallel_end': return 'bg-purple-50 border-purple-500 text-purple-900';
      case 'subprocess': return 'bg-indigo-50 border-indigo-500 text-indigo-900';
      default: return 'bg-blue-50 border-blue-500 text-blue-900';
    }
  };

  const swimLanes = Array.from(new Set(steps.map(s => s.swim_lane || s.responsible_role || 'Tanımsız').filter(Boolean)));

  const parallelGroups = steps
    .filter(s => s.parallel_group)
    .reduce((acc, step) => {
      const group = step.parallel_group!;
      if (!acc[group]) acc[group] = [];
      acc[group].push(step);
      return acc;
    }, {} as Record<number, ProcessStep[]>);

  const toggleLane = (lane: string) => {
    const newCollapsed = new Set(collapsedLanes);
    if (newCollapsed.has(lane)) {
      newCollapsed.delete(lane);
    } else {
      newCollapsed.add(lane);
    }
    setCollapsedLanes(newCollapsed);
  };

  const renderVerticalFlow = () => (
    <div className="space-y-4">
      <div className="flex justify-center mb-6">
        <div className={`${getStepColor({ step_type: 'start' } as ProcessStep)} px-8 py-4 rounded-full font-bold text-lg shadow-lg border-2 animate-pulse`}>
          BAŞLANGIÇ
        </div>
      </div>

      {steps.map((step, index) => {
        const isParallel = step.parallel_group !== null && step.parallel_group !== undefined;
        const parallelSiblings = isParallel ? parallelGroups[step.parallel_group!] : [];
        const isFirstInGroup = isParallel && parallelSiblings[0]?.id === step.id;
        const isLastInGroup = isParallel && parallelSiblings[parallelSiblings.length - 1]?.id === step.id;

        return (
          <div key={step.id}>
            {isFirstInGroup && (
              <div className="flex justify-center mb-4">
                <div className="bg-purple-100 border-2 border-purple-500 px-4 py-2 rounded-lg text-purple-900 font-medium flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Paralel İşlemler Başlangıcı
                </div>
              </div>
            )}

            <div className="flex flex-col items-center">
              {index > 0 && !isFirstInGroup && (
                <div className="w-1 h-8 bg-gray-400 relative">
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-gray-400">▼</div>
                </div>
              )}

              <div
                draggable={isEditMode}
                onDragStart={() => handleDragStart(step.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(step.id)}
                className={`
                  w-full max-w-3xl border-2 p-5 shadow-lg transition-all duration-300
                  ${getStepColor(step)}
                  ${isEditMode ? 'cursor-move hover:scale-105' : ''}
                  ${step.step_type === 'decision' ? 'transform rotate-45' : 'rounded-xl'}
                  ${isParallel ? 'mx-4' : ''}
                  hover:shadow-2xl
                `}
                style={{
                  clipPath: step.step_type === 'decision' ? getStepShape(step.step_type) : undefined,
                  transform: step.step_type === 'decision' ? 'rotate(0deg)' : undefined
                }}
              >
                <div className={step.step_type === 'decision' ? 'transform -rotate-45' : ''}>
                  <div className="flex items-start gap-4">
                    <div className={`
                      flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md
                      ${step.is_critical_control_point ? 'bg-red-600' : 'bg-blue-600'}
                    `}>
                      {step.step_number}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStepIcon(step.step_type)}
                        <h4 className="font-bold text-lg">{step.step_name}</h4>
                        {step.is_critical_control_point && (
                          <span className="px-3 py-1 bg-red-600 text-white text-xs rounded-full flex items-center gap-1 shadow">
                            <MapPin className="w-3 h-3" />
                            KKN
                          </span>
                        )}
                        {step.step_type !== 'process' && (
                          <span className="px-2 py-1 bg-white bg-opacity-50 text-xs rounded font-medium">
                            {step.step_type === 'decision' && 'Karar'}
                            {step.step_type === 'subprocess' && 'Alt Süreç'}
                            {step.step_type === 'parallel_start' && 'Paralel Başlangıç'}
                            {step.step_type === 'parallel_end' && 'Paralel Bitiş'}
                          </span>
                        )}
                      </div>

                      {step.step_description && (
                        <p className="text-sm mb-3 opacity-90">{step.step_description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {step.responsible_user_name && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Sorumlu:</span>
                            <span className="opacity-90">{step.responsible_user_name}</span>
                          </div>
                        )}
                        {step.responsible_role && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Rol:</span>
                            <span className="opacity-90">{step.responsible_role}</span>
                          </div>
                        )}
                        {step.inputs && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Girdiler:</span>
                            <span className="opacity-90">{step.inputs}</span>
                          </div>
                        )}
                        {step.outputs && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Çıktılar:</span>
                            <span className="opacity-90">{step.outputs}</span>
                          </div>
                        )}
                        {step.tools_used && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Araçlar:</span>
                            <span className="opacity-90">{step.tools_used}</span>
                          </div>
                        )}
                        {step.estimated_duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className="opacity-90">{step.estimated_duration}</span>
                          </div>
                        )}
                      </div>

                      {step.next_step_condition && (
                        <div className="mt-3 text-xs bg-white bg-opacity-30 rounded p-2">
                          <span className="font-semibold">Koşul:</span> {step.next_step_condition}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isLastInGroup && (
              <div className="flex justify-center my-4">
                <div className="bg-purple-100 border-2 border-purple-500 px-4 py-2 rounded-lg text-purple-900 font-medium flex items-center gap-2">
                  <GitMerge className="w-5 h-5" />
                  Paralel İşlemler Birleşimi
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-center mt-6">
        <div className={`${getStepColor({ step_type: 'end' } as ProcessStep)} px-8 py-4 rounded-full font-bold text-lg shadow-lg border-2`}>
          BİTİŞ
        </div>
      </div>
    </div>
  );

  const renderSwimlaneFlow = () => (
    <div className="space-y-4">
      {swimLanes.map((lane) => {
        const laneSteps = steps.filter(s => (s.swim_lane || s.responsible_role || 'Tanımsız') === lane);
        const isCollapsed = collapsedLanes.has(lane);

        return (
          <div key={lane} className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-md">
            <div
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 font-bold flex items-center justify-between cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all"
              onClick={() => toggleLane(lane)}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5" />
                <span>{lane}</span>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                  {laneSteps.length} adım
                </span>
              </div>
              {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </div>

            {!isCollapsed && (
              <div className="p-6 bg-gray-50">
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {laneSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-4 flex-shrink-0">
                      <div
                        draggable={isEditMode}
                        onDragStart={() => handleDragStart(step.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(step.id)}
                        className={`
                          w-64 border-2 p-4 shadow-lg transition-all duration-300 rounded-xl
                          ${getStepColor(step)}
                          ${isEditMode ? 'cursor-move hover:scale-105' : ''}
                          hover:shadow-2xl
                        `}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white
                            ${step.is_critical_control_point ? 'bg-red-600' : 'bg-blue-600'}
                          `}>
                            {step.step_number}
                          </div>
                          {getStepIcon(step.step_type)}
                        </div>

                        <h4 className="font-bold mb-2">{step.step_name}</h4>

                        {step.step_description && (
                          <p className="text-xs mb-2 opacity-90 line-clamp-2">{step.step_description}</p>
                        )}

                        {step.estimated_duration && (
                          <div className="flex items-center gap-1 text-xs mt-2">
                            <Clock className="w-3 h-3" />
                            <span>{step.estimated_duration}</span>
                          </div>
                        )}

                        {step.is_critical_control_point && (
                          <div className="mt-2 px-2 py-1 bg-red-600 text-white text-xs rounded flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            KKN
                          </div>
                        )}
                      </div>

                      {index < laneSteps.length - 1 && (
                        <div className="flex items-center text-gray-400">
                          <div className="text-2xl">→</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderHorizontalFlow = () => (
    <div className="flex gap-6 overflow-x-auto pb-6 items-center">
      <div className={`${getStepColor({ step_type: 'start' } as ProcessStep)} px-6 py-8 rounded-full font-bold shadow-lg border-2 flex-shrink-0 animate-pulse`}>
        <div className="transform -rotate-90">BAŞLANGIÇ</div>
      </div>

      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-6 flex-shrink-0">
          <div
            draggable={isEditMode}
            onDragStart={() => handleDragStart(step.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(step.id)}
            className={`
              w-72 border-2 p-4 shadow-lg transition-all duration-300 rounded-xl
              ${getStepColor(step)}
              ${isEditMode ? 'cursor-move hover:scale-105' : ''}
              hover:shadow-2xl
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
                ${step.is_critical_control_point ? 'bg-red-600' : 'bg-blue-600'}
              `}>
                {step.step_number}
              </div>
              {getStepIcon(step.step_type)}
              <h4 className="font-bold flex-1">{step.step_name}</h4>
            </div>

            {step.step_description && (
              <p className="text-sm mb-2 opacity-90">{step.step_description}</p>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {step.responsible_user_name && (
                <span className="px-2 py-1 bg-white bg-opacity-30 rounded">
                  {step.responsible_user_name}
                </span>
              )}
              {step.estimated_duration && (
                <span className="px-2 py-1 bg-white bg-opacity-30 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {step.estimated_duration}
                </span>
              )}
              {step.is_critical_control_point && (
                <span className="px-2 py-1 bg-red-600 text-white rounded flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  KKN
                </span>
              )}
            </div>
          </div>

          {index < steps.length - 1 && (
            <div className="text-gray-400 text-3xl flex-shrink-0">→</div>
          )}
        </div>
      ))}

      <div className={`${getStepColor({ step_type: 'end' } as ProcessStep)} px-6 py-8 rounded-full font-bold shadow-lg border-2 flex-shrink-0`}>
        <div className="transform -rotate-90">BİTİŞ</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[95vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Network className="w-8 h-8" />
                Gelişmiş İş Akış Diyagramı
              </h2>
              <p className="text-blue-100 mt-1">{process.code} - {process.name}</p>
              <p className="text-blue-200 text-sm mt-1">{steps.length} adım</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('vertical')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  viewMode === 'vertical'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Workflow className="w-4 h-4" />
                Dikey Akış
              </button>
              <button
                onClick={() => setViewMode('swimlane')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  viewMode === 'swimlane'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                Swim Lane
              </button>
              <button
                onClick={() => setViewMode('horizontal')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  viewMode === 'horizontal'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Move className="w-4 h-4" />
                Yatay Akış
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  showGrid ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                title="Izgara Göster/Gizle"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  isEditMode ? 'bg-yellow-100 text-yellow-700' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                title="Düzenleme Modu"
              >
                <Move className="w-4 h-4" />
                {isEditMode && 'Düzenleme'}
              </button>

              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="text-gray-700 hover:text-blue-600"
                  title="Uzaklaştır"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-700 w-12 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className="text-gray-700 hover:text-blue-600"
                  title="Yakınlaştır"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(100)}
                  className="text-gray-700 hover:text-blue-600"
                  title="Sıfırla"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={saveVersion}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-md transition-all"
                title="Versiyonu Kaydet"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </button>

              <div className="relative">
                <button
                  onClick={exportAsPNG}
                  disabled={isExporting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                  title="PNG olarak İndir"
                >
                  <Download className="w-4 h-4" />
                  PNG
                </button>
              </div>

              <button
                onClick={exportAsPDF}
                disabled={isExporting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                title="PDF olarak İndir"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>

              <button
                onClick={() => setShowVersions(!showVersions)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 shadow-md transition-all"
                title="Versiyon Geçmişi"
              >
                <Clock className="w-4 h-4" />
                {versions.length > 0 && (
                  <span className="bg-white text-gray-700 rounded-full px-2 py-0.5 text-xs font-bold">
                    {versions.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {isEditMode && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span><strong>Düzenleme Modu Aktif:</strong> Adımları sürükleyerek sıralarını değiştirebilirsiniz.</span>
              </p>
            </div>
          )}
        </div>

        {showVersions && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Versiyon Geçmişi
            </h3>
            <div className="flex gap-2 overflow-x-auto">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => setSelectedVersion(version.version)}
                  className={`
                    px-4 py-2 rounded-lg border-2 flex-shrink-0 transition-all
                    ${selectedVersion === version.version
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }
                  `}
                >
                  <div className="text-sm font-bold">v{version.version}</div>
                  <div className="text-xs opacity-75">
                    {new Date(version.created_at).toLocaleDateString('tr-TR')}
                  </div>
                  {version.is_current && (
                    <div className="text-xs mt-1 bg-green-500 text-white rounded px-2 py-0.5">
                      Güncel
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          {steps.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Bu süreç için henüz adım eklenmemiş.</p>
                <p className="text-sm">Akış diyagramını görüntülemek için önce süreç adımlarını ekleyin.</p>
              </div>
            </div>
          ) : (
            <div
              ref={diagramRef}
              className={`transition-all duration-300 ${showGrid ? 'bg-grid-pattern' : ''}`}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                minHeight: '100%'
              }}
            >
              {viewMode === 'vertical' && renderVerticalFlow()}
              {viewMode === 'swimlane' && renderSwimlaneFlow()}
              {viewMode === 'horizontal' && renderHorizontalFlow()}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded"></div>
              <span className="text-gray-700">Normal Adım</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600 rounded"></div>
              <span className="text-gray-700">Kritik Kontrol Noktası (KKN)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-400 rounded" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}></div>
              <span className="text-gray-700">Karar Noktası</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-500 rounded"></div>
              <span className="text-gray-700">Paralel İşlem</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-500 rounded"></div>
              <span className="text-gray-700">Alt Süreç</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded-full"></div>
              <span className="text-gray-700">Başlangıç</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-700 rounded-full"></div>
              <span className="text-gray-700">Bitiş</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bg-grid-pattern {
          background-image:
            linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
