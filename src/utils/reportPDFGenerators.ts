import { exportToPDF, generateTableHTML } from './exportHelpers';

export function generateStrategicPlanPDF(plans: any[]) {
  if (!plans || plans.length === 0) {
    const content = `
      <h2>Stratejik Plan Özet Raporu - ${new Date().getFullYear()}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Henüz stratejik plan bulunmamaktadır.
      </p>
    `;
    exportToPDF('Stratejik Plan Özet Raporu', content);
    return;
  }

  const headers = ['Stratejik Plan', 'Başlangıç Tarihi', 'Bitiş Tarihi', 'Amaç Sayısı', 'Hedef Sayısı', 'Gösterge Sayısı'];
  const rows = plans.map(plan => [
    plan.name,
    new Date(plan.start_date).toLocaleDateString('tr-TR'),
    new Date(plan.end_date).toLocaleDateString('tr-TR'),
    plan.objectives_count,
    plan.goals_count,
    plan.indicators_count,
  ]);

  const content = `
    <h2>Stratejik Plan Özet Raporu - ${new Date().getFullYear()}</h2>
    <p><strong>Toplam Plan Sayısı:</strong> ${plans.length}</p>
    ${generateTableHTML(headers, rows)}
  `;

  exportToPDF('Stratejik Plan Özet Raporu', content);
}

export function generatePerformanceDashboardPDF(departments: any[], overallProgress: number) {
  if (!departments || departments.length === 0) {
    const content = `
      <h2>Performans Gösterge Paneli - ${new Date().getFullYear()}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Henüz birim bulunmamaktadır.
      </p>
    `;
    exportToPDF('Performans Gösterge Paneli', content);
    return;
  }

  const headers = ['Birim', 'Gösterge Sayısı', 'Ortalama İlerleme', 'Hedefte', 'Risk Altında', 'Geride'];
  const rows = departments.map(dept => [
    dept.department_name,
    dept.total_indicators,
    `${Math.round(dept.avg_progress)}%`,
    dept.on_track,
    dept.at_risk,
    dept.behind,
  ]);

  const content = `
    <h2>Performans Gösterge Paneli - ${new Date().getFullYear()}</h2>
    <div style="background: linear-gradient(to right, #2563eb, #1e40af); color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14pt;"><strong>Kurum Genel İlerleme:</strong> ${Math.round(overallProgress)}%</p>
    </div>
    ${generateTableHTML(headers, rows)}
  `;

  exportToPDF('Performans Gösterge Paneli', content);
}

export function generateDepartmentPerformancePDF(departments: any[]) {
  if (!departments || departments.length === 0) {
    const content = `
      <h2>Birim Performans Karşılaştırma Raporu - ${new Date().getFullYear()}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Henüz birim bulunmamaktadır.
      </p>
    `;
    exportToPDF('Birim Performans Raporu', content);
    return;
  }

  const headers = ['Sıra', 'Birim', 'Hedef Sayısı', 'Gösterge Sayısı', 'Ortalama İlerleme', 'Hedefte', 'Risk Altında', 'Geride'];
  const rows = departments.map(dept => [
    dept.rank || '-',
    dept.name,
    dept.goals_count,
    dept.indicators_count,
    `${Math.round(dept.avg_progress)}%`,
    dept.on_track_indicators,
    dept.at_risk_indicators,
    dept.behind_indicators,
  ]);

  const content = `
    <h2>Birim Performans Karşılaştırma Raporu - ${new Date().getFullYear()}</h2>
    <p><strong>Toplam Birim:</strong> ${departments.length}</p>
    ${generateTableHTML(headers, rows)}

    ${departments.map((dept, idx) => `
      <div style="margin: 15px 0; padding: 12px; border: 1px solid ${dept.avg_progress < 50 ? '#fecaca' : '#e2e8f0'}; border-radius: 6px; background: ${dept.rank === 1 ? '#fef3c7' : '#f8fafc'};">
        <h3>${dept.rank > 0 ? `#${dept.rank} - ` : ''}${dept.name}</h3>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value" style="color: ${dept.avg_progress >= 70 ? '#16a34a' : dept.avg_progress >= 50 ? '#ca8a04' : '#dc2626'};">${Math.round(dept.avg_progress)}%</div>
            <div class="stat-label">Ortalama İlerleme</div>
          </div>
          <div class="stat-box"><div class="stat-value">${dept.goals_count}</div><div class="stat-label">Hedef</div></div>
          <div class="stat-box"><div class="stat-value">${dept.indicators_count}</div><div class="stat-label">Gösterge</div></div>
          <div class="stat-box"><div class="stat-value">${dept.on_track_indicators}</div><div class="stat-label">Hedefte</div></div>
        </div>
        <p><strong>En İyi:</strong> ${dept.top_indicator} | <strong>Geliştirilmeli:</strong> ${dept.bottom_indicator}</p>
      </div>
    `).join('')}
  `;

  exportToPDF('Birim Performans Raporu', content);
}

export function generateActivityStatusPDF(activities: any[], stats: any) {
  if (!activities || activities.length === 0) {
    const content = `
      <h2>Faaliyet Durum Raporu - ${new Date().getFullYear()}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Henüz faaliyet bulunmamaktadır.
      </p>
    `;
    exportToPDF('Faaliyet Durum Raporu', content);
    return;
  }

  const headers = ['Faaliyet', 'Hedef', 'Birim', 'Sorumlu', 'Başlangıç', 'Bitiş', 'Durum'];
  const rows = activities.map(act => [
    act.title,
    act.goal_title,
    act.department_name,
    act.responsible_person,
    new Date(act.start_date).toLocaleDateString('tr-TR'),
    new Date(act.end_date).toLocaleDateString('tr-TR'),
    act.is_overdue ? 'GECİKMİŞ' : getStatusLabel(act.status),
  ]);

  const content = `
    <h2>Faaliyet Durum Raporu - ${new Date().getFullYear()}</h2>
    <div class="stats-grid" style="grid-template-columns: repeat(5, 1fr);">
      <div class="stat-box"><div class="stat-value">${stats.total}</div><div class="stat-label">Toplam</div></div>
      <div class="stat-box"><div class="stat-value">${stats.ongoing}</div><div class="stat-label">Devam Eden</div></div>
      <div class="stat-box"><div class="stat-value">${stats.completed}</div><div class="stat-label">Tamamlanan</div></div>
      <div class="stat-box"><div class="stat-value">${stats.overdue}</div><div class="stat-label">Gecikmiş</div></div>
      <div class="stat-box"><div class="stat-value">${stats.cancelled}</div><div class="stat-label">İptal</div></div>
    </div>
    ${generateTableHTML(headers, rows)}
  `;

  exportToPDF('Faaliyet Durum Raporu', content);
}

export function generateDataEntryStatusPDF(indicators: any[], stats: any) {
  if (!indicators || indicators.length === 0) {
    const content = `
      <h2>Veri Giriş Durum Raporu - ${new Date().getFullYear()}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Henüz gösterge bulunmamaktadır.
      </p>
    `;
    exportToPDF('Veri Giriş Durum Raporu', content);
    return;
  }

  const headers = ['Kod', 'Gösterge', 'Sorumlu', 'Ç1', 'Ç2', 'Ç3', 'Ç4', 'Tamamlanma'];
  const rows = indicators.map(ind => [
    ind.code,
    ind.name,
    ind.responsible_person,
    getStatusSymbol(ind.q1_status),
    getStatusSymbol(ind.q2_status),
    getStatusSymbol(ind.q3_status),
    getStatusSymbol(ind.q4_status),
    `${Math.round(ind.completion_rate)}%`,
  ]);

  const content = `
    <h2>Veri Giriş Durum Raporu - ${new Date().getFullYear()}</h2>
    <div class="stats-grid" style="grid-template-columns: repeat(5, 1fr);">
      <div class="stat-box"><div class="stat-value">${stats.total_entries}</div><div class="stat-label">Toplam Giriş</div></div>
      <div class="stat-box"><div class="stat-value">${stats.approved}</div><div class="stat-label">Onaylandı</div></div>
      <div class="stat-box"><div class="stat-value">${stats.pending}</div><div class="stat-label">Beklemede</div></div>
      <div class="stat-box"><div class="stat-value">${stats.rejected}</div><div class="stat-label">Reddedildi</div></div>
      <div class="stat-box"><div class="stat-value">${stats.missing}</div><div class="stat-label">Girilmedi</div></div>
    </div>
    ${generateTableHTML(headers, rows)}
    <p style="margin-top: 15px; font-size: 9pt;"><strong>Semboller:</strong> ✓ = Onaylandı, ⏱ = Beklemede, ✗ = Reddedildi, - = Girilmedi</p>
  `;

  exportToPDF('Veri Giriş Durum Raporu', content);
}

export function generateGoalAchievementPDF(goals: any[]) {
  if (!goals || goals.length === 0) {
    const content = `
      <h2>Hedef Başarı Raporu - ${new Date().getFullYear()}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Henüz hedef bulunmamaktadır.
      </p>
    `;
    exportToPDF('Hedef Başarı Raporu', content);
    return;
  }

  const headers = ['Kod', 'Hedef', 'Amaç', 'Birim', 'Gösterge Sayısı', 'Ortalama İlerleme', 'Hedefte', 'Risk Altında', 'Geride', 'Başarı Tahmini'];
  const rows = goals.map(goal => [
    goal.code,
    goal.title,
    goal.objective_title,
    goal.department_name,
    goal.indicators_count,
    `${Math.round(goal.avg_progress)}%`,
    goal.on_track_indicators,
    goal.at_risk_indicators,
    goal.behind_indicators,
    goal.forecast,
  ]);

  const content = `
    <h2>Hedef Başarı Raporu - ${new Date().getFullYear()}</h2>
    <p><strong>Toplam Hedef:</strong> ${goals.length}</p>
    ${generateTableHTML(headers, rows)}

    ${goals.map(goal => `
      <div style="margin: 15px 0; padding: 12px; border: 1px solid ${goal.avg_progress < 50 ? '#fecaca' : '#e2e8f0'}; border-radius: 6px; background: #f8fafc;">
        <h3>${goal.code} - ${goal.title}</h3>
        <p><strong>Amaç:</strong> ${goal.objective_title} | <strong>Birim:</strong> ${goal.department_name}</p>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value" style="color: ${goal.avg_progress >= 70 ? '#16a34a' : goal.avg_progress >= 50 ? '#ca8a04' : '#dc2626'};">${Math.round(goal.avg_progress)}%</div>
            <div class="stat-label">İlerleme</div>
          </div>
          <div class="stat-box"><div class="stat-value">${goal.on_track_indicators}</div><div class="stat-label">Hedefte</div></div>
          <div class="stat-box"><div class="stat-value">${goal.at_risk_indicators}</div><div class="stat-label">Risk Altında</div></div>
          <div class="stat-box"><div class="stat-value">${goal.behind_indicators}</div><div class="stat-label">Geride</div></div>
        </div>
        <p><strong>Başarı Tahmini:</strong> ${goal.forecast}</p>
      </div>
    `).join('')}
  `;

  exportToPDF('Hedef Başarı Raporu', content);
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ongoing: 'Devam Ediyor',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
  };
  return labels[status] || status;
}

function getStatusSymbol(status: string): string {
  if (status === 'approved') return '✓';
  if (status === 'submitted' || status === 'pending') return '⏱';
  if (status === 'rejected') return '✗';
  return '-';
}

export function generatePeriodicDataComparisonPDF(data: any[], selectedYear: number) {
  if (!data || data.length === 0) {
    const content = `
      <h2>Dönemsel Veri Karşılaştırma Raporu - ${selectedYear}</h2>
      <p style="color: #64748b; text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
        Seçili döneme ait onaylanmış veri girişi bulunmamaktadır.
      </p>
    `;
    exportToPDF('Dönemsel Veri Karşılaştırma', content);
    return;
  }

  const previousYear = selectedYear - 1;
  const headers = [
    'Kod',
    'Gösterge',
    'Birim',
    `${previousYear} Ç1`,
    `${previousYear} Ç2`,
    `${previousYear} Ç3`,
    `${previousYear} Ç4`,
    `${previousYear} Top.`,
    `${selectedYear} Ç1`,
    `${selectedYear} Ç2`,
    `${selectedYear} Ç3`,
    `${selectedYear} Ç4`,
    `${selectedYear} Top.`,
    'Değişim %',
  ];

  const rows = data.map(item => [
    item.indicator_code,
    item.indicator_name,
    item.department_name,
    item[`q1_${previousYear}`] || '-',
    item[`q2_${previousYear}`] || '-',
    item[`q3_${previousYear}`] || '-',
    item[`q4_${previousYear}`] || '-',
    item.total_2024.toFixed(2),
    item[`q1_${selectedYear}`] || '-',
    item[`q2_${selectedYear}`] || '-',
    item[`q3_${selectedYear}`] || '-',
    item[`q4_${selectedYear}`] || '-',
    item.total_2025.toFixed(2),
    `${item.change_rate > 0 ? '+' : ''}${item.change_rate.toFixed(1)}%`,
  ]);

  const content = `
    <h2>Dönemsel Veri Karşılaştırma Raporu - ${selectedYear}</h2>
    <p><strong>Toplam Gösterge:</strong> ${data.length}</p>
    <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
    ${generateTableHTML(headers, rows)}
    <div style="margin-top: 20px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <p style="margin: 0; font-size: 9pt;"><strong>Notlar:</strong></p>
      <ul style="margin: 5px 0 0 20px; font-size: 9pt;">
        <li>Rapor sadece onaylanmış veri girişlerini gösterir</li>
        <li>Ç1-Ç4: Yılın çeyrek dönemlerini temsil eder</li>
        <li>Değişim %: ${previousYear} yılına göre ${selectedYear} yılındaki değişim oranı</li>
      </ul>
    </div>
  `;

  exportToPDF('Dönemsel Veri Karşılaştırma', content);
}
