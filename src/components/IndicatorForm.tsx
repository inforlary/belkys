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
    calculation_method: 'cumulative_increasing',
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
            <option value="cumulative_increasing">1. Kümülatif Artan Değer</option>
            <option value="cumulative_decreasing">2. Kümülatif Azalan Değer</option>
            <option value="percentage_increasing">3. Yüzde Artan Değer</option>
            <option value="percentage_decreasing">4. Yüzde Azalan Değer</option>
            <option value="maintenance_increasing">5. Artan Koruma Modeli</option>
            <option value="maintenance_decreasing">6. Azalan Koruma Modeli</option>
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
            {formData.calculation_method === 'cumulative_increasing' && (
              <div className="space-y-2">
                <p className="font-semibold">1. Kümülatif Artan Değer</p>
                <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                  İlerleme = ((Başlangıç + Çeyrek Toplamı - Başlangıç) / (Hedef - Başlangıç)) × 100
                </p>
                <div className="bg-green-50 p-2 rounded mt-2 border border-green-200">
                  <p className="font-semibold mb-1">Örnek: Eğitim Sayısı</p>
                  <p>• Başlangıç: 100 eğitim</p>
                  <p>• Hedef: 500 eğitim</p>
                  <p>• Çeyrek Toplamı: 200 eğitim</p>
                  <p className="font-semibold mt-1 text-green-700">İlerleme = ((100+200-100)/(500-100)) × 100 = %50</p>
                </div>
              </div>
            )}

            {formData.calculation_method === 'cumulative_decreasing' && (
              <div className="space-y-2">
                <p className="font-semibold">2. Kümülatif Azalan Değer</p>
                <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                  İlerleme = ((Başlangıç - Çeyrek Toplamı - Başlangıç) / (Hedef - Başlangıç)) × 100
                </p>
                <div className="bg-red-50 p-2 rounded mt-2 border border-red-200">
                  <p className="font-semibold mb-1">Örnek: Kaza Sayısı</p>
                  <p>• Başlangıç: 100 kaza</p>
                  <p>• Hedef: 20 kaza</p>
                  <p>• Çeyrek Toplamı: 40 azalma</p>
                  <p className="font-semibold mt-1 text-red-700">İlerleme = ((100-40-100)/(20-100)) × 100 = %50</p>
                </div>
              </div>
            )}

            {formData.calculation_method === 'percentage_increasing' && (
              <div className="space-y-2">
                <p className="font-semibold">3. Yüzde Artan Değer</p>
                <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                  İlerleme = ((Çeyrek Toplamı / Ölçüm Sıklığı) / Hedef) × 100
                </p>
                <div className="bg-blue-50 p-2 rounded mt-2 border border-blue-200">
                  <p className="font-semibold mb-1">Örnek: Memnuniyet Oranı (Aylık Ölçüm)</p>
                  <p>• Hedef: 90%</p>
                  <p>• Çeyrek Toplamı: 360%</p>
                  <p>• Ölçüm Sıklığı: 12 (Aylık)</p>
                  <p className="font-semibold mt-1 text-blue-700">İlerleme = ((360/12)/90) × 100 = %33.3</p>
                </div>
                <p className="text-xs text-gray-600 italic">Not: Başlangıç değeri kullanılmaz</p>
              </div>
            )}

            {formData.calculation_method === 'percentage_decreasing' && (
              <div className="space-y-2">
                <p className="font-semibold">4. Yüzde Azalan Değer</p>
                <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                  İlerleme = (((Çeyrek Toplamı / Ölçüm Sıklığı) - Başlangıç) / (Hedef - Başlangıç)) × 100
                </p>
                <div className="bg-yellow-50 p-2 rounded mt-2 border border-yellow-200">
                  <p className="font-semibold mb-1">Örnek: Şikayet Oranı (3 Aylık Ölçüm)</p>
                  <p>• Başlangıç: 15%</p>
                  <p>• Hedef: 5%</p>
                  <p>• Çeyrek Toplamı: 40%</p>
                  <p>• Ölçüm Sıklığı: 4 (3 Aylık)</p>
                  <p className="font-semibold mt-1 text-yellow-700">İlerleme = (((40/4)-15)/(5-15)) × 100 = %50</p>
                </div>
              </div>
            )}

            {formData.calculation_method === 'maintenance_increasing' && (
              <div className="space-y-2">
                <p className="font-semibold">5. Artan Koruma Modeli</p>
                <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                  İlerleme = (Çeyrek Toplamı / Hedef) × 100
                </p>
                <div className="bg-purple-50 p-2 rounded mt-2 border border-purple-200">
                  <p className="font-semibold mb-1">Örnek: Kalite Puanı</p>
                  <p>• Hedef: 400</p>
                  <p>• Çeyrek Toplamı: 350</p>
                  <p className="font-semibold mt-1 text-purple-700">İlerleme = (350/400) × 100 = %87.5</p>
                </div>
                <p className="text-xs text-gray-600 italic">Not: Başlangıç değeri kullanılmaz</p>
              </div>
            )}

            {formData.calculation_method === 'maintenance_decreasing' && (
              <div className="space-y-2">
                <p className="font-semibold">6. Azalan Koruma Modeli</p>
                <p className="font-mono text-sm bg-white p-2 rounded border border-blue-300">
                  İlerleme = (Hedef / Çeyrek Toplamı) × 100
                </p>
                <div className="bg-orange-50 p-2 rounded mt-2 border border-orange-200">
                  <p className="font-semibold mb-1">Örnek: Hata Sayısı</p>
                  <p>• Hedef: 10</p>
                  <p>• Çeyrek Toplamı: 15</p>
                  <p className="font-semibold mt-1 text-orange-700">İlerleme = (10/15) × 100 = %66.7</p>
                </div>
                <p className="text-xs text-gray-600 italic">Not: Başlangıç değeri kullanılmaz</p>
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
