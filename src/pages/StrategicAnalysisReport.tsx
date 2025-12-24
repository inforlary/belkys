import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileText, TrendingUp, AlertTriangle, Target, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface StrategicPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
}

interface PESTLEItem {
  id: string;
  category: string;
  title: string;
  description: string;
  impact_level: string;
  priority: number;
}

interface SWOTItem {
  id: string;
  category: string;
  title: string;
  description: string;
  impact_weight: number;
  priority: number;
}

interface TOWSStrategy {
  type: string;
  title: string;
  description: string;
  actions: string[];
}

interface PriorityItem {
  source: string;
  category: string;
  title: string;
  score: number;
  impact: string | number;
  priority: number;
}

interface ActionItem {
  title: string;
  responsible: string;
  duration: string;
  priority: number;
}

const impactToScore = (impact: string): number => {
  switch (impact?.toLowerCase()) {
    case 'düşük':
    case 'low':
      return 30;
    case 'orta':
    case 'medium':
      return 60;
    case 'yüksek':
    case 'high':
      return 90;
    default:
      return 50;
  }
};

const translateCategory = (category: string): string => {
  const categoryMap: { [key: string]: string } = {
    'political': 'Politik',
    'economic': 'Ekonomik',
    'social': 'Sosyal',
    'technological': 'Teknolojik',
    'legal': 'Yasal',
    'environmental': 'Çevresel',
    'strength': 'Güçlü Yön',
    'weakness': 'Zayıf Yön',
    'opportunity': 'Fırsat',
    'threat': 'Tehdit'
  };
  return categoryMap[category?.toLowerCase()] || category;
};

export default function StrategicAnalysisReport() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [strategicPlans, setStrategicPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [pestleData, setPestleData] = useState<PESTLEItem[]>([]);
  const [swotData, setSwotData] = useState<SWOTItem[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user && profile) {
      loadStrategicPlans();
    }
  }, [user, profile]);

  useEffect(() => {
    if (selectedPlanId) {
      loadAnalysisData();
    }
  }, [selectedPlanId]);

  async function loadStrategicPlans() {
    try {
      const { data, error } = await supabase
        .from('strategic_plans')
        .select('id, name, start_year, end_year')
        .eq('organization_id', profile.organization_id)
        .order('start_year', { ascending: false });

      if (error) throw error;
      setStrategicPlans(data || []);
      if (data && data.length > 0) {
        setSelectedPlanId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalysisData() {
    try {
      setLoading(true);

      const [pestleRes, swotRes] = await Promise.all([
        supabase
          .from('pestle_analyses')
          .select('*')
          .eq('strategic_plan_id', selectedPlanId)
          .order('priority', { ascending: false }),
        supabase
          .from('swot_analyses')
          .select('*')
          .eq('strategic_plan_id', selectedPlanId)
          .order('priority', { ascending: false }),
      ]);

      if (pestleRes.error) throw pestleRes.error;
      if (swotRes.error) throw swotRes.error;

      setPestleData(pestleRes.data || []);
      setSwotData(swotRes.data || []);
    } catch (error) {
      console.error('Error loading analysis data:', error);
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = strategicPlans.find(p => p.id === selectedPlanId);

  const pestleByCategory = {
    politik: pestleData.filter(p => p.category.toLowerCase() === 'politik'),
    ekonomik: pestleData.filter(p => p.category.toLowerCase() === 'ekonomik'),
    sosyal: pestleData.filter(p => p.category.toLowerCase() === 'sosyal'),
    teknolojik: pestleData.filter(p => p.category.toLowerCase() === 'teknolojik'),
    yasal: pestleData.filter(p => p.category.toLowerCase() === 'yasal'),
    çevresel: pestleData.filter(p => p.category.toLowerCase() === 'çevresel'),
  };

  const swotByCategory = {
    strengths: swotData.filter(s => s.category.toLowerCase() === 'strength'),
    weaknesses: swotData.filter(s => s.category.toLowerCase() === 'weakness'),
    opportunities: swotData.filter(s => s.category.toLowerCase() === 'opportunity'),
    threats: swotData.filter(s => s.category.toLowerCase() === 'threat'),
  };

  const generateTOWSStrategies = (): TOWSStrategy[] => {
    const strategies: TOWSStrategy[] = [];

    const topStrengths = swotByCategory.strengths.slice(0, 2);
    const topWeaknesses = swotByCategory.weaknesses.slice(0, 2);
    const topOpportunities = swotByCategory.opportunities.slice(0, 2);
    const topThreats = swotByCategory.threats.slice(0, 2);

    if (topStrengths.length > 0 && topOpportunities.length > 0) {
      strategies.push({
        type: 'SO (Güçlü-Fırsat)',
        title: 'Güçlü yönleri kullanarak fırsatları değerlendirme',
        description: `${topStrengths[0]?.title} gücünü kullanarak ${topOpportunities[0]?.title} fırsatından yararlanılabilir.`,
        actions: [
          'Mevcut güçlü yönlerin fırsat alanlarına yönlendirilmesi',
          'Kaynak tahsisinin fırsat odaklı yapılandırılması',
        ],
      });
    }

    if (topWeaknesses.length > 0 && topOpportunities.length > 0) {
      strategies.push({
        type: 'WO (Zayıf-Fırsat)',
        title: 'Fırsatları kullanarak zayıflıkları giderme',
        description: `${topOpportunities[0]?.title} fırsatı, ${topWeaknesses[0]?.title} zayıflığını gidermek için kullanılabilir.`,
        actions: [
          'Dış kaynak ve ortaklıklarla zayıf alanların güçlendirilmesi',
          'Fırsat bazlı kapasite geliştirme programlarının uygulanması',
        ],
      });
    }

    if (topStrengths.length > 0 && topThreats.length > 0) {
      strategies.push({
        type: 'ST (Güçlü-Tehdit)',
        title: 'Güçlü yönlerle tehditleri minimize etme',
        description: `${topStrengths[0]?.title} gücü, ${topThreats[0]?.title} tehdidine karşı savunma oluşturabilir.`,
        actions: [
          'Risk yönetim sistemlerinin güçlü yönlerle entegrasyonu',
          'Proaktif tehdit izleme ve erken uyarı mekanizmalarının kurulması',
        ],
      });
    }

    if (topWeaknesses.length > 0 && topThreats.length > 0) {
      strategies.push({
        type: 'WT (Zayıf-Tehdit)',
        title: 'Zayıflıkları giderip tehditlere karşı savunma oluşturma',
        description: `${topWeaknesses[0]?.title} zayıflığının ${topThreats[0]?.title} tehdidiyle birleşmesi önlenmelidir.`,
        actions: [
          'Acil iyileştirme planlarının devreye alınması',
          'Alternatif senaryo planlaması ve dayanıklılık stratejilerinin geliştirilmesi',
        ],
      });
    }

    return strategies;
  };

  const calculatePriorities = (): PriorityItem[] => {
    const items: PriorityItem[] = [];

    pestleData.forEach(p => {
      const impactScore = impactToScore(p.impact_level);
      const score = (impactScore + p.priority) / 2;
      items.push({
        source: 'PESTLE',
        category: p.category,
        title: p.title,
        score,
        impact: p.impact_level,
        priority: p.priority,
      });
    });

    swotData.forEach(s => {
      const score = (s.impact_weight + s.priority) / 2;
      items.push({
        source: 'SWOT',
        category: s.category,
        title: s.title,
        score,
        impact: s.impact_weight,
        priority: s.priority,
      });
    });

    return items.sort((a, b) => b.score - a.score).slice(0, 10);
  };

  const generate90DayActions = (): ActionItem[] => {
    const priorities = calculatePriorities().slice(0, 6);

    return priorities.map((p, idx) => ({
      title: `${p.title} - İyileştirme`,
      responsible: p.source === 'PESTLE' ? 'Strateji Geliştirme Birimi' : 'İlgili Müdürlük',
      duration: idx < 2 ? '30 gün' : idx < 4 ? '60 gün' : '90 gün',
      priority: Math.ceil(p.score),
    }));
  };

  const generateExecutiveSummary = (): string => {
    const topPestle = pestleData.slice(0, 3);
    const topSwot = swotData.slice(0, 2);
    const highImpactPestle = pestleData.filter(p => p.impact_level.toLowerCase() === 'yüksek');

    let summary = `${selectedPlan?.name} (${selectedPlan?.start_year}-${selectedPlan?.end_year}) için yapılan stratejik durum analizi sonucunda `;
    summary += `${pestleData.length} dış faktör ve ${swotData.length} iç faktör değerlendirilmiştir.\n\n`;

    if (highImpactPestle.length > 0) {
      const categories = [...new Set(highImpactPestle.map(p => p.category))];
      summary += `**Kritik Dış Faktörler:** ${categories.join(', ')} kategorileri stratejik hedefler üzerinde yüksek etkiye sahiptir.\n\n`;
    }

    if (swotByCategory.weaknesses.length > 0) {
      summary += `**Temel Zayıf Yönler:** ${swotByCategory.weaknesses[0]?.title} öncelikli iyileştirme alanıdır.\n\n`;
    }

    if (swotByCategory.opportunities.length > 0) {
      summary += `**Önemli Fırsatlar:** ${swotByCategory.opportunities[0]?.title} değerlendirilmelidir.\n\n`;
    }

    summary += `**Önerilen Stratejik Öncelikler:**\n`;
    const priorities = calculatePriorities().slice(0, 3);
    priorities.forEach((p, idx) => {
      summary += `${idx + 1}. ${p.title}\n`;
    });

    return summary;
  };

  const exportToPDF = () => {
    const plan = selectedPlan;
    if (!plan) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up engelleyici nedeniyle PDF oluşturulamadı. Lütfen pop-up engelleyiciyi devre dışı bırakın.');
      return;
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Stratejik Durum Analizi Raporu</title>
        <style>
          @media print {
            @page { margin: 2cm; }
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #1e40af;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 24px;
          }
          h2 {
            color: #1e40af;
            border-bottom: 2px solid #93c5fd;
            padding-bottom: 8px;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 20px;
          }
          h3 {
            color: #3b82f6;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 16px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            border: none;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .summary {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 14px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #3b82f6;
            color: white;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
          }
          .badge-high {
            background-color: #fee2e2;
            color: #991b1b;
          }
          .badge-medium {
            background-color: #fef3c7;
            color: #92400e;
          }
          .badge-low {
            background-color: #dcfce7;
            color: #166534;
          }
          .strategy-box {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            background: #f9fafb;
          }
          .strategy-box h4 {
            margin: 0 0 10px 0;
            color: #1f2937;
          }
          .action-list {
            list-style-type: none;
            padding-left: 0;
          }
          .action-list li {
            padding: 5px 0 5px 20px;
            position: relative;
          }
          .action-list li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #3b82f6;
          }
          .methodology {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 15px;
            margin-top: 30px;
            font-size: 14px;
          }
          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${plan.name}</h1>
          <h2 style="border:none; margin: 10px 0;">Stratejik Durum Analizi Raporu</h2>
          <p><strong>Dönem:</strong> ${plan.start_year} - ${plan.end_year}</p>
          <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
        </div>

        <div class="summary">
          <h2 style="margin-top: 0; border:none;">Yönetici Özeti</h2>
          <div style="white-space: pre-line;">${generateExecutiveSummary()}</div>
        </div>

        <div class="page-break"></div>

        <h2>PESTLE Analizi</h2>
    `;

    Object.entries(pestleByCategory).forEach(([category, items]) => {
      if (items.length > 0) {
        html += `
          <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Faktörler (${items.length})</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Faktör</th>
                <th style="width: 40%">Açıklama</th>
                <th style="width: 15%">Etki</th>
                <th style="width: 20%">Öncelik</th>
              </tr>
            </thead>
            <tbody>
        `;
        items.forEach(item => {
          const badgeClass =
            item.impact_level.toLowerCase() === 'yüksek' ? 'badge-high' :
            item.impact_level.toLowerCase() === 'orta' ? 'badge-medium' : 'badge-low';
          html += `
              <tr>
                <td><strong>${item.title}</strong></td>
                <td>${item.description}</td>
                <td><span class="badge ${badgeClass}">${item.impact_level}</span></td>
                <td>${item.priority}</td>
              </tr>
          `;
        });
        html += `
            </tbody>
          </table>
        `;
      }
    });

    const topPestle = calculatePriorities().filter(p => p.source === 'PESTLE').slice(0, 3);
    html += `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0;">En Kritik 3 Dış Faktör</h3>
        <ol>
    `;
    topPestle.forEach(p => {
      html += `<li><strong>${p.title}</strong> (${translateCategory(p.category)}) - Skor: ${p.score.toFixed(1)}</li>`;
    });
    html += `
        </ol>
      </div>
      <div class="page-break"></div>
    `;

    html += `<h2>SWOT Analizi (GZFT)</h2>`;

    const swotSections = [
      { key: 'strengths', title: 'Güçlü Yönler', color: '#dcfce7', borderColor: '#16a34a' },
      { key: 'weaknesses', title: 'Zayıf Yönler', color: '#fee2e2', borderColor: '#dc2626' },
      { key: 'opportunities', title: 'Fırsatlar', color: '#dbeafe', borderColor: '#2563eb' },
      { key: 'threats', title: 'Tehditler', color: '#fed7aa', borderColor: '#ea580c' }
    ];

    swotSections.forEach(section => {
      const items = swotByCategory[section.key as keyof typeof swotByCategory];
      html += `
        <div style="background: ${section.color}; border-left: 4px solid ${section.borderColor}; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${section.title} (${items.length})</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 30%">Başlık</th>
                <th style="width: 45%">Açıklama</th>
                <th style="width: 12.5%">Etki</th>
                <th style="width: 12.5%">Öncelik</th>
              </tr>
            </thead>
            <tbody>
      `;
      items.forEach(item => {
        html += `
              <tr>
                <td><strong>${item.title}</strong></td>
                <td>${item.description}</td>
                <td>${item.impact_weight}</td>
                <td>${item.priority}</td>
              </tr>
        `;
      });
      html += `
            </tbody>
          </table>
        </div>
      `;
    });

    html += `<div class="page-break"></div><h2>TOWS Stratejileri</h2>`;

    const towsStrategies = generateTOWSStrategies();
    towsStrategies.forEach((strategy, idx) => {
      html += `
        <div class="strategy-box">
          <h4>${idx + 1}. ${strategy.type}</h4>
          <p><strong>${strategy.title}</strong></p>
          <p>${strategy.description}</p>
          <p><strong>Uygulanabilir Adımlar:</strong></p>
          <ul class="action-list">
      `;
      strategy.actions.forEach(action => {
        html += `<li>${action}</li>`;
      });
      html += `
          </ul>
        </div>
      `;
    });

    html += `<div class="page-break"></div><h2>Önceliklendirme ve Skorlama</h2>`;
    html += `
      <table>
        <thead>
          <tr>
            <th style="width: 8%">Sıra</th>
            <th style="width: 15%">Kaynak</th>
            <th style="width: 17%">Kategori</th>
            <th style="width: 45%">Faktör</th>
            <th style="width: 15%">Skor</th>
          </tr>
        </thead>
        <tbody>
    `;

    const priorities = calculatePriorities();
    priorities.forEach((p, idx) => {
      const rowStyle = idx < 3 ? 'background-color: #fef3c7;' : '';
      html += `
          <tr style="${rowStyle}">
            <td><strong>${idx + 1}</strong></td>
            <td><span class="badge ${p.source === 'PESTLE' ? 'badge-high' : 'badge-medium'}">${p.source}</span></td>
            <td>${translateCategory(p.category)}</td>
            <td>${p.title}</td>
            <td><strong>${p.score.toFixed(1)}</strong></td>
          </tr>
      `;
    });

    html += `
        </tbody>
      </table>

      <h2>90 Günlük Hızlı Aksiyon Planı</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 8%">#</th>
            <th style="width: 42%">Hedef</th>
            <th style="width: 25%">Sorumlu Birim</th>
            <th style="width: 12.5%">Süre</th>
            <th style="width: 12.5%">Öncelik</th>
          </tr>
        </thead>
        <tbody>
    `;

    const actions = generate90DayActions();
    actions.forEach((action, idx) => {
      const badgeClass =
        action.duration === '30 gün' ? 'badge-high' :
        action.duration === '60 gün' ? 'badge-medium' : 'badge-low';
      html += `
          <tr>
            <td><strong>${idx + 1}</strong></td>
            <td>${action.title}</td>
            <td>${action.responsible}</td>
            <td><span class="badge ${badgeClass}">${action.duration}</span></td>
            <td>${action.priority}</td>
          </tr>
      `;
    });

    html += `
        </tbody>
      </table>

      <div class="methodology">
        <h2 style="margin-top: 0;">Metodoloji ve Notlar</h2>
        <p><strong>Veri Toplama:</strong> Bu rapor, ${pestleData.length} PESTLE faktörü ve ${swotData.length} SWOT faktörü analiz edilerek hazırlanmıştır.</p>
        <p><strong>Skorlama Yöntemi:</strong> Etki düzeyleri (Düşük=30, Orta=60, Yüksek=90) ve öncelik puanları ortalaması alınarak önem skoru hesaplanmıştır.</p>
        <p><strong>Varsayımlar:</strong> Tüm faktörlerin güncel olduğu ve stratejik planlama döneminde geçerli olacağı varsayılmıştır.</p>
        <p><strong>Sınırlılıklar:</strong> Analiz mevcut veri seti ile sınırlıdır. Dış çevre değişikliklerine göre güncellenmelidir.</p>
      </div>

      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const exportToExcel = () => {
    const plan = selectedPlan;
    if (!plan) return;

    const workbook = XLSX.utils.book_new();

    const headerData = [
      ['Stratejik Durum Analizi Raporu'],
      [`${plan.name} (${plan.start_year}-${plan.end_year})`],
      [`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`],
      []
    ];

    const executiveSummaryData = [
      ['YÖNETİCİ ÖZETİ'],
      [generateExecutiveSummary()],
      []
    ];

    const pestleData = [
      ['PESTLE ANALİZİ'],
      ['Kategori', 'Faktör', 'Açıklama', 'Etki', 'Öncelik']
    ];

    Object.entries(pestleByCategory).forEach(([category, items]) => {
      items.forEach(item => {
        pestleData.push([
          translateCategory(category),
          item.title,
          item.description,
          item.impact_level,
          item.priority
        ]);
      });
    });

    pestleData.push([]);

    const swotData = [
      ['SWOT ANALİZİ'],
      ['Kategori', 'Başlık', 'Açıklama', 'Etki', 'Öncelik']
    ];

    swotByCategory.strengths.forEach(item => {
      swotData.push(['Güçlü Yön', item.title, item.description, item.impact_weight, item.priority]);
    });

    swotByCategory.weaknesses.forEach(item => {
      swotData.push(['Zayıf Yön', item.title, item.description, item.impact_weight, item.priority]);
    });

    swotByCategory.opportunities.forEach(item => {
      swotData.push(['Fırsat', item.title, item.description, item.impact_weight, item.priority]);
    });

    swotByCategory.threats.forEach(item => {
      swotData.push(['Tehdit', item.title, item.description, item.impact_weight, item.priority]);
    });

    swotData.push([]);

    const towsData = [
      ['TOWS STRATEJİLERİ'],
      ['Tip', 'Başlık', 'Açıklama', 'Adımlar']
    ];

    const towsStrategies = generateTOWSStrategies();
    towsStrategies.forEach(strategy => {
      towsData.push([
        strategy.type,
        strategy.title,
        strategy.description,
        strategy.actions.join(', ')
      ]);
    });

    towsData.push([]);

    const priorityData = [
      ['ÖNCELİKLENDİRME'],
      ['Sıra', 'Kaynak', 'Kategori', 'Faktör', 'Skor']
    ];

    const priorities = calculatePriorities();
    priorities.forEach((p, idx) => {
      priorityData.push([
        idx + 1,
        p.source,
        translateCategory(p.category),
        p.title,
        p.score.toFixed(1)
      ]);
    });

    priorityData.push([]);

    const actionData = [
      ['90 GÜNLÜK AKSİYON PLANI'],
      ['Sıra', 'Hedef', 'Sorumlu Birim', 'Süre', 'Öncelik']
    ];

    const actions = generate90DayActions();
    actions.forEach((action, idx) => {
      actionData.push([
        idx + 1,
        action.title,
        action.responsible,
        action.duration,
        action.priority
      ]);
    });

    const allData = [
      ...headerData,
      ...executiveSummaryData,
      ...pestleData,
      ...swotData,
      ...towsData,
      ...priorityData,
      ...actionData
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(allData);

    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 50 },
      { wch: 15 },
      { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stratejik Durum Analizi');

    XLSX.writeFile(workbook, `Stratejik-Durum-Analizi-${plan.start_year}-${plan.end_year}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (strategicPlans.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Stratejik Plan Bulunamadı</h3>
        <p className="mt-2 text-sm text-gray-600">
          Rapor oluşturmak için önce bir stratejik plan oluşturmalısınız.
        </p>
      </div>
    );
  }

  if (!selectedPlanId || !selectedPlan) {
    return null;
  }

  const towsStrategies = generateTOWSStrategies();
  const priorities = calculatePriorities();
  const actions = generate90DayActions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stratejik Durum Analizi Raporu</h1>
          <p className="mt-1 text-sm text-gray-600">PESTLE & SWOT Entegre Değerlendirme</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToExcel}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-5 w-5 mr-2" />
            Excel İndir
          </button>
          <button
            onClick={exportToPDF}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Download className="h-5 w-5 mr-2" />
            PDF İndir
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Stratejik Plan Seçin</label>
        <select
          value={selectedPlanId}
          onChange={(e) => setSelectedPlanId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {strategicPlans.map(plan => (
            <option key={plan.id} value={plan.id}>
              {plan.name} ({plan.start_year}-{plan.end_year})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Yönetici Özeti
        </h2>
        <div className="text-sm text-blue-800 whitespace-pre-line">
          {generateExecutiveSummary()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">PESTLE Faktörleri</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{pestleData.length}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SWOT Faktörleri</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{swotData.length}</p>
            </div>
            <Target className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">TOWS Stratejileri</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{towsStrategies.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Yüksek Öncelik</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {priorities.filter(p => p.score > 70).length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">PESTLE Analizi - Kategori Bazlı</h2>
        </div>
        <div className="p-6 space-y-6">
          {Object.entries(pestleByCategory).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3 capitalize">
                  {category} Faktörler ({items.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Faktör</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Açıklama</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Etki</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Öncelik</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.description}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              item.impact_level.toLowerCase() === 'yüksek' ? 'bg-red-100 text-red-800' :
                              item.impact_level.toLowerCase() === 'orta' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {item.impact_level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">SWOT Analizi (GZFT)</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <h3 className="text-md font-semibold text-green-900 mb-3">
                Güçlü Yönler ({swotByCategory.strengths.length})
              </h3>
              <div className="space-y-2">
                {swotByCategory.strengths.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded border border-green-100">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-gray-500">Etki: {item.impact_weight}</span>
                      <span className="text-xs text-gray-500">Öncelik: {item.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h3 className="text-md font-semibold text-red-900 mb-3">
                Zayıf Yönler ({swotByCategory.weaknesses.length})
              </h3>
              <div className="space-y-2">
                {swotByCategory.weaknesses.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded border border-red-100">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-gray-500">Etki: {item.impact_weight}</span>
                      <span className="text-xs text-gray-500">Öncelik: {item.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h3 className="text-md font-semibold text-blue-900 mb-3">
                Fırsatlar ({swotByCategory.opportunities.length})
              </h3>
              <div className="space-y-2">
                {swotByCategory.opportunities.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded border border-blue-100">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-gray-500">Etki: {item.impact_weight}</span>
                      <span className="text-xs text-gray-500">Öncelik: {item.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <h3 className="text-md font-semibold text-orange-900 mb-3">
                Tehditler ({swotByCategory.threats.length})
              </h3>
              <div className="space-y-2">
                {swotByCategory.threats.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded border border-orange-100">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-gray-500">Etki: {item.impact_weight}</span>
                      <span className="text-xs text-gray-500">Öncelik: {item.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">TOWS Stratejileri</h2>
        </div>
        <div className="p-6 space-y-4">
          {towsStrategies.map((strategy, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-md font-semibold text-gray-900">{strategy.type}</h3>
                  <p className="text-sm font-medium text-gray-700 mt-1">{strategy.title}</p>
                  <p className="text-sm text-gray-600 mt-2">{strategy.description}</p>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Uygulanabilir Adımlar:</p>
                    <ul className="space-y-1">
                      {strategy.actions.map((action, aidx) => (
                        <li key={aidx} className="text-xs text-gray-600 flex items-start">
                          <span className="mr-2">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Önceliklendirme ve Skorlama (Top 10)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sıra</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaynak</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faktör</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skor</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {priorities.map((p, idx) => (
                <tr key={idx} className={idx < 3 ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      p.source === 'PESTLE' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {p.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{translateCategory(p.category)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.title}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900">{p.score.toFixed(1)}</span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            p.score > 70 ? 'bg-red-500' : p.score > 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${p.score}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">90 Günlük Hızlı Aksiyon Planı</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hedef</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Birim</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Süre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Öncelik</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {actions.map((action, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{action.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{action.responsible}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      action.duration === '30 gün' ? 'bg-red-100 text-red-800' :
                      action.duration === '60 gün' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {action.duration}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{action.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Metodoloji ve Notlar</h2>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <span className="font-medium">Veri Toplama:</span> Bu rapor, {pestleData.length} PESTLE faktörü ve {swotData.length} SWOT faktörü analiz edilerek hazırlanmıştır.
          </p>
          <p>
            <span className="font-medium">Skorlama Yöntemi:</span> Etki düzeyleri (Düşük=30, Orta=60, Yüksek=90) ve öncelik puanları ortalaması alınarak önem skoru hesaplanmıştır.
          </p>
          <p>
            <span className="font-medium">Varsayımlar:</span> Tüm faktörlerin güncel olduğu ve stratejik planlama döneminde geçerli olacağı varsayılmıştır.
          </p>
          <p>
            <span className="font-medium">Sınırlılıklar:</span> Analiz mevcut veri seti ile sınırlıdır. Dış çevre değişikliklerine göre güncellenmelidir.
          </p>
        </div>
      </div>
    </div>
  );
}
