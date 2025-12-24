import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { generateIndicatorCode, generateYearTargets } from '../utils/codeGenerator';
import { validateGoalImpactPercentages } from '../utils/progressCalculations';
import type { MeasurementFrequency } from '../types/database';

interface IndicatorFormProps {
  goalId: string;
  startYear: number;
  endYear: number;
  onSuccess: () => void;
  onCancel: () => void;
  editingIndicator?: any;
  organizationId: string;
}

export function IndicatorForm({
  goalId,
  startYear,
  endYear,
  onSuccess,
  onCancel,
  editingIndicator,
  organizationId,
}: IndicatorFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    baseline_value: 0,
    measurement_frequency: 'annual' as MeasurementFrequency,
    reporting_frequency: '',
    calculation_method: 'cumulative',
    description: '',
    calculation_notes: '',
    goal_impact_percentage: null as number | null,
  });
  const [code, setCode] = useState('');
  const [targets, setTargets] = useState<{ [year: number]: number }>({});
  const [submitting, setSubmitting] = useState(false);
  const [goalIndicators, setGoalIndicators] = useState<any[]>([]);
  const [impactValidation, setImpactValidation] = useState<{
    isValid: boolean;
    currentTotal: number;
    message: string;
    shouldBlock: boolean;
  }>({ isValid: true, currentTotal: 0, message: '', shouldBlock: false });

  useEffect(() => {
    if (editingIndicator) {
      setFormData({
        name: editingIndicator.name,
        unit: editingIndicator.unit,
        baseline_value: editingIndicator.baseline_value,
        measurement_frequency: editingIndicator.measurement_frequency || 'annual',
        reporting_frequency: editingIndicator.reporting_frequency || '',
        calculation_method: editingIndicator.calculation_method || 'cumulative',
        description: editingIndicator.description || '',
        calculation_notes: editingIndicator.calculation_notes || '',
        goal_impact_percentage: editingIndicator.goal_impact_percentage || null,
      });
      setCode(editingIndicator.code || '');

      loadExistingTargets();
    } else {
      const initialTargets: { [year: number]: number } = {};
      for (let year = startYear; year <= endYear; year++) {
        initialTargets[year] = 0;
      }
      setTargets(initialTargets);
    }
  }, [editingIndicator?.id]);

  useEffect(() => {
    loadGoalIndicators();
  }, [goalId]);

  useEffect(() => {
    if (formData.goal_impact_percentage !== null) {
      const validation = validateGoalImpactPercentages(
        goalId,
        goalIndicators,
        editingIndicator?.id,
        formData.goal_impact_percentage
      );
      setImpactValidation(validation);
    }
  }, [formData.goal_impact_percentage, goalIndicators, goalId, editingIndicator?.id]);

  async function loadGoalIndicators() {
    const { data } = await supabase
      .from('indicators')
      .select('id, goal_id, goal_impact_percentage')
      .eq('goal_id', goalId)
      .eq('organization_id', organizationId);

    if (data) {
      setGoalIndicators(data);
    }
  }

  async function loadExistingTargets() {
    if (!editingIndicator?.id) return;

    const { data } = await supabase
      .from('indicator_targets')
      .select('year, target_value')
      .eq('indicator_id', editingIndicator.id);

    if (data) {
      const targetsMap: { [year: number]: number } = {};
      data.forEach((t) => {
        targetsMap[t.year] = t.target_value || 0;
      });
      setTargets(targetsMap);
    }
  }

  async function handleGenerateCode() {
    try {
      const generatedCode = await generateIndicatorCode(supabase, {
        organizationId,
        goalId,
      });
      setCode(generatedCode);
    } catch (error) {
      console.error('Kod üretilirken hata:', error);
      alert('Kod üretilirken bir hata oluştu');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (formData.goal_impact_percentage !== null && impactValidation.shouldBlock) {
      alert(`Hata: ${impactValidation.message}\n\nHedefe etkisi toplamı %100'ü geçemez!`);
      return;
    }

    setSubmitting(true);

    try {
      if (editingIndicator) {
        const { error: updateError } = await supabase
          .from('indicators')
          .update({
            name: formData.name,
            unit: formData.unit,
            baseline_value: formData.baseline_value,
            measurement_frequency: formData.measurement_frequency,
            reporting_frequency: formData.reporting_frequency || null,
            calculation_method: formData.calculation_method,
            description: formData.description,
            calculation_notes: formData.calculation_notes,
            goal_impact_percentage: formData.goal_impact_percentage,
            code,
          })
          .eq('id', editingIndicator.id);

        if (updateError) throw updateError;

        for (const [year, targetValue] of Object.entries(targets)) {
          const { data: existing } = await supabase
            .from('indicator_targets')
            .select('id')
            .eq('indicator_id', editingIndicator.id)
            .eq('year', parseInt(year))
            .maybeSingle();

          if (existing) {
            await supabase
              .from('indicator_targets')
              .update({
                target_value: targetValue,
                baseline_value: formData.baseline_value
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('indicator_targets')
              .insert({
                indicator_id: editingIndicator.id,
                year: parseInt(year),
                target_value: targetValue,
                baseline_value: formData.baseline_value
              });
          }
        }
      } else {
        const { data: newIndicator, error: insertError } = await supabase
          .from('indicators')
          .insert({
            goal_id: goalId,
            organization_id: organizationId,
            name: formData.name,
            unit: formData.unit,
            baseline_value: formData.baseline_value,
            current_value: formData.baseline_value,
            measurement_frequency: formData.measurement_frequency,
            reporting_frequency: formData.reporting_frequency || null,
            calculation_method: formData.calculation_method,
            description: formData.description,
            calculation_notes: formData.calculation_notes,
            goal_impact_percentage: formData.goal_impact_percentage,
            code,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        for (const [year, targetValue] of Object.entries(targets)) {
          await supabase
            .from('indicator_targets')
            .insert({
              indicator_id: newIndicator.id,
              year: parseInt(year),
              target_value: targetValue,
              baseline_value: formData.baseline_value
            });
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Gösterge kaydedilirken hata:', error);
      alert(error.message || 'Gösterge kaydedilirken bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  }

  function handleTargetChange(year: number, value: number) {
    setTargets({ ...targets, [year]: value });
  }

  const years = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gösterge Kodu *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="örn: G1.1.1"
            required
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateCode}
            title="Otomatik kod üret"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gösterge Adı *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Birim *
          </label>
          <input
            type="text"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="örn: Adet, %, TL"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Başlangıç Değeri *
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.baseline_value}
            onChange={(e) => setFormData({ ...formData, baseline_value: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hedefe Etkisi (%)
            <span className="text-xs text-gray-500 ml-2">(Hedef altındaki tüm göstergelerin toplamı %100 olmalı)</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.goal_impact_percentage || ''}
            onChange={(e) => setFormData({ ...formData, goal_impact_percentage: e.target.value ? parseFloat(e.target.value) : null })}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              formData.goal_impact_percentage !== null && impactValidation.shouldBlock
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300'
            }`}
            placeholder="0-100"
          />
          {formData.goal_impact_percentage !== null && impactValidation.message && (
            <div className={`mt-2 text-xs flex items-center gap-1 ${
              impactValidation.isValid
                ? 'text-green-600'
                : impactValidation.shouldBlock
                ? 'text-red-600'
                : 'text-yellow-600'
            }`}>
              {impactValidation.isValid ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{impactValidation.message}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>{impactValidation.message}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ölçüm Sıklığı *
          </label>
          <select
            value={formData.measurement_frequency}
            onChange={(e) => setFormData({ ...formData, measurement_frequency: e.target.value as MeasurementFrequency })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="monthly">Aylık</option>
            <option value="quarterly">3 Aylık (Çeyrek Dönem)</option>
            <option value="semi_annual">6 Aylık (Yarı Yıl)</option>
            <option value="annual">Yıllık</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Raporlama Sıklığı
          </label>
          <select
            value={formData.reporting_frequency}
            onChange={(e) => setFormData({ ...formData, reporting_frequency: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Seçiniz</option>
            <option value="monthly">Aylık</option>
            <option value="quarterly">3 Aylık</option>
            <option value="semi_annual">6 Aylık</option>
            <option value="annual">Yıllık</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hesaplama Yöntemi *
          </label>
          <select
            value={formData.calculation_method}
            onChange={(e) => setFormData({ ...formData, calculation_method: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="cumulative">Artış Modeli (B {'>'} A)</option>
            <option value="cumulative_decreasing">Azalış Modeli (B {'<'} A)</option>
            <option value="maintenance">Koruma Modeli (B = A)</option>
            <option value="percentage">Yüzde (%) Değer</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Göstergeye İlişkin Açıklama
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Gösterge ile ilgili genel açıklamayı buraya giriniz..."
        />
      </div>

      {formData.calculation_method && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-blue-900 mb-1">
            Hesaplama Yöntemi Açıklaması
          </label>
          <textarea
            value={formData.calculation_notes}
            onChange={(e) => setFormData({ ...formData, calculation_notes: e.target.value })}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Bu gösterge için hesaplama yönteminin nasıl uygulanacağını açıklayın..."
          />

          <div className="mt-3 text-xs text-blue-800 space-y-3 bg-white bg-opacity-60 p-3 rounded">
            <div className="bg-blue-100 p-3 rounded">
              <p className="font-bold text-sm mb-2">Temel Formül (Tüm Yöntemler İçin):</p>
              <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                Performans (%) = ((C - A) / (B - A)) × 100
              </p>
              <div className="mt-2 space-y-1">
                <p><strong>A:</strong> Başlangıç Değeri (Plan başındaki mevcut değer)</p>
                <p><strong>B:</strong> Hedef Değeri (Yıl sonu ulaşılması planlanan değer)</p>
                <p><strong>C:</strong> Gerçekleşen Değer (İzleme sonunda ulaşılan değer)</p>
              </div>
            </div>

            {formData.calculation_method === 'cumulative' && (
              <div className="space-y-2">
                <p className="font-semibold">🟢 Artış Modeli (B {'>'} A)</p>
                <p><strong>C Hesabı:</strong> Başlangıç + (Ç1 + Ç2 + Ç3 + Ç4)</p>
                <div className="bg-green-50 p-2 rounded mt-2 border border-green-200">
                  <p className="font-semibold mb-1">Örnek: Eğitim Sayısı (Artış)</p>
                  <p>• A (Başlangıç): 1600 eğitim</p>
                  <p>• B (Hedef): 3000 eğitim</p>
                  <p>• Ç1-Ç4 Toplamı: 1200 eğitim</p>
                  <p>• C = 1600 + 1200 = 2800</p>
                  <p className="font-semibold mt-1 text-green-700">İlerleme = (2800-1600)/(3000-1600) × 100 = %85.7</p>
                </div>
                <p className="text-blue-700 italic mt-2">
                  ✓ Kullanım: Eğitim sayısı, ağaç sayısı, proje sayısı gibi artan göstergeler
                </p>
              </div>
            )}
            {formData.calculation_method === 'cumulative_decreasing' && (
              <div className="space-y-2">
                <p className="font-semibold">🔵 Azalış Modeli (B {'<'} A)</p>
                <p><strong>C Hesabı:</strong> Başlangıç - (Ç1 + Ç2 + Ç3 + Ç4)</p>
                <div className="bg-red-50 p-2 rounded mt-2 border border-red-200">
                  <p className="font-semibold mb-1">Örnek: Kaza Sayısı (Azalış)</p>
                  <p>• A (Başlangıç): 2400 kaza</p>
                  <p>• B (Hedef): 1600 kaza (azaltma)</p>
                  <p>• Ç1-Ç4 Toplamı: 600 azalma</p>
                  <p>• C = 2400 - 600 = 1800</p>
                  <p className="font-semibold mt-1 text-red-700">İlerleme = (1800-2400)/(1600-2400) × 100 = %75</p>
                </div>
                <p className="text-blue-700 italic mt-2">
                  ✓ Kullanım: Kaza sayısı, atık miktarı, maliyet gibi azalan göstergeler
                </p>
              </div>
            )}
            {formData.calculation_method === 'maintenance' && (
              <div className="space-y-2">
                <p className="font-semibold">🟡 Koruma Modeli (B = A)</p>
                <p><strong>C Hesabı:</strong> Çeyrek değerlerin toplamı</p>
                <div className="bg-amber-50 p-2 rounded mt-2 border border-amber-200">
                  <p className="font-semibold mb-1">Örnek: Kalite Oranı (Koruma)</p>
                  <p>• A (Başlangıç): 85%</p>
                  <p>• B (Hedef): 85% (koruma)</p>
                  <p>• Ç1-Ç4 Toplamı: 85%</p>
                  <p>• C = 85%</p>
                  <p className="font-semibold mt-1 text-amber-700">İlerleme = (C/B) × 100 = (85/85) × 100 = %100</p>
                  <p className="text-xs mt-1">Not: C {'>'} B ise aşan değer gösterilir (örn: %105.9), ama hedefte %100 alınır</p>
                </div>
                <p className="text-blue-700 italic mt-2">
                  ✓ Kullanım: Mevcut seviyenin korunması gereken göstergeler
                </p>
              </div>
            )}
            {formData.calculation_method === 'percentage' && (
              <div className="space-y-2">
                <p className="font-semibold">📊 Yüzde (%) Değer</p>
                <p><strong>C Hesabı:</strong> Çeyrek değerlerin toplamı (A=0)</p>
                <div className="bg-yellow-50 p-2 rounded mt-2 border border-yellow-200">
                  <p className="font-semibold mb-1">Örnek: Hedefe Ulaşma Oranı</p>
                  <p>• A (Başlangıç): 0</p>
                  <p>• B (Hedef): 100</p>
                  <p>• Ç1-Ç4 Toplamı: 80</p>
                  <p>• C = 80</p>
                  <p className="font-semibold mt-1 text-yellow-700">İlerleme = (80-0)/(100-0) × 100 = %80</p>
                </div>
                <p className="text-blue-700 italic mt-2">
                  ✓ Kullanım: Başlangıç değeri olmayan, doğrudan yüzde bazlı göstergeler
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Yıllık Hedef Değerler *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {years.map((year) => (
            <div key={year}>
              <label className="block text-xs text-gray-600 mb-1">{year}</label>
              <input
                type="number"
                step="0.01"
                value={targets[year] || 0}
                onChange={(e) => handleTargetChange(year, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" loading={submitting}>
          {editingIndicator ? 'Güncelle' : 'Kaydet'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          İptal
        </Button>
      </div>
    </form>
  );
}
