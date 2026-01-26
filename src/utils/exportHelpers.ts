export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('Dışa aktarılacak veri bulunamadı');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const cell = row[header];
        if (cell === null || cell === undefined) return '';
        const cellStr = String(cell);
        return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
          ? `"${cellStr.replace(/"/g, '""')}"`
          : cellStr;
      }).join(',')
    )
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(data: any[] | { [key: string]: any[] }, filename: string) {
  if (!data) {
    alert('Dışa aktarılacak veri bulunamadı');
    return;
  }

  import('xlsx').then((XLSX) => {
    const workbook = XLSX.utils.book_new();

    if (Array.isArray(data)) {
      if (data.length === 0) {
        alert('Dışa aktarılacak veri bulunamadı');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);

      const columnWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        ) + 2
      }));
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Veri');
    } else {
      const sheets = Object.entries(data);

      if (sheets.length === 0 || sheets.every(([_, sheetData]) => sheetData.length === 0)) {
        alert('Dışa aktarılacak veri bulunamadı');
        return;
      }

      sheets.forEach(([sheetName, sheetData]) => {
        if (sheetData && sheetData.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(sheetData);

          const columnWidths = Object.keys(sheetData[0]).map(key => ({
            wch: Math.max(
              key.length,
              ...sheetData.map(row => String(row[key] || '').length)
            ) + 2
          }));
          worksheet['!cols'] = columnWidths;

          const sanitizedSheetName = sheetName.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
          XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedSheetName);
        }
      });
    }

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }).catch(err => {
    console.error('Excel export error:', err);
    alert('Excel dosyası oluşturulurken bir hata oluştu');
  });
}

export function exportToPDF(title: string, content: string, filename?: string) {
  const printWindow = window.open('', '', 'width=900,height=700');

  if (!printWindow) {
    alert('Pop-up engellendi. Lütfen pop-up engelleyiciyi devre dışı bırakın.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 0.8cm;
        }
        body {
          font-family: 'Arial', sans-serif;
          font-size: 8.5pt;
          line-height: 1.25;
          color: #333;
          margin: 0;
          padding: 12px;
        }
        h1 {
          color: #2563eb;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 8px;
          margin-bottom: 15px;
          font-size: 18pt;
        }
        h2 {
          color: #1e40af;
          margin-top: 12px;
          margin-bottom: 6px;
          font-size: 11pt;
        }
        h3 {
          color: #475569;
          margin-top: 10px;
          margin-bottom: 5px;
          font-size: 9.5pt;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 7.5pt;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 4px 6px;
          text-align: left;
        }
        th {
          background-color: #2563eb;
          color: white;
          font-weight: bold;
          font-size: 8pt;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin: 8px 0;
        }
        .stat-box {
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 10px;
          text-align: center;
          background: #f8fafc;
        }
        .stat-value {
          font-size: 18pt;
          font-weight: bold;
          color: #1e40af;
        }
        .stat-label {
          font-size: 7.5pt;
          color: #64748b;
          margin-top: 3px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #cbd5e1;
          font-size: 8pt;
          color: #64748b;
        }
        .recommendation {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 10px 15px;
          margin: 10px 0;
          font-size: 9pt;
        }
        @media print {
          body {
            margin: 0;
            padding: 15px;
          }
          .no-print {
            display: none !important;
          }
          h1 {
            font-size: 18pt;
          }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${content}
      <div class="footer">
        <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}</p>
        <p>Kurumsal Yönetim Sistemi - Stratejik Planlama ve Performans Yönetimi</p>
      </div>
      <div class="no-print" style="margin-top: 20px; text-align: center; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 15px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); border-radius: 8px;">
        <button onclick="window.print()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin-right: 10px;">
          📄 Yazdır / PDF Olarak Kaydet
        </button>
        <button onclick="window.close()" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
          ❌ Kapat
        </button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function generateTableHTML(headers: string[], rows: any[][]): string {
  return `
    <table>
      <thead>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function generateStrategicPlanReport(plan: any, objectives: any[], goals: any[], indicators: any[]) {
  const content = `
    <h2>Stratejik Plan Bilgileri</h2>
    <table>
      <tr>
        <th>Plan Adı</th>
        <td>${plan.name}</td>
      </tr>
      <tr>
        <th>Dönem</th>
        <td>${plan.start_year} - ${plan.end_year}</td>
      </tr>
      <tr>
        <th>Açıklama</th>
        <td>${plan.description || '-'}</td>
      </tr>
    </table>

    <h2>Amaçlar (${objectives.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Kod</th>
          <th>Başlık</th>
          <th>Açıklama</th>
        </tr>
      </thead>
      <tbody>
        ${objectives.map(obj => `
          <tr>
            <td>${obj.code}</td>
            <td>${obj.title}</td>
            <td>${obj.description || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Hedefler (${goals.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Kod</th>
          <th>Başlık</th>
          <th>Amaç</th>
        </tr>
      </thead>
      <tbody>
        ${goals.map(goal => `
          <tr>
            <td>${goal.code}</td>
            <td>${goal.title}</td>
            <td>${goal.objective?.title || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Performans Göstergeleri (${indicators.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Kod</th>
          <th>Gösterge</th>
          <th>Hedef</th>
          <th>Birim</th>
          <th>Başlangıç</th>
          <th>Güncel</th>
        </tr>
      </thead>
      <tbody>
        ${indicators.map(ind => `
          <tr>
            <td>${ind.code || '-'}</td>
            <td>${ind.name}</td>
            <td>${ind.goal?.title || '-'}</td>
            <td>${ind.unit}</td>
            <td>${ind.baseline_value}</td>
            <td>${ind.current_value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  exportToPDF(
    `Stratejik Plan Raporu - ${plan.name}`,
    content,
    `stratejik_plan_${plan.name.replace(/\s+/g, '_')}_${Date.now()}`
  );
}

export function generateIndicatorReport(indicators: any[]) {
  const csvData = indicators.map(ind => ({
    'Kod': ind.code || '',
    'Gösterge Adı': ind.name,
    'Hedef': ind.goal?.title || '',
    'Birim': ind.unit,
    'Başlangıç Değeri': ind.baseline_value,
    'Güncel Değer': ind.current_value,
    'Ölçüm Sıklığı': ind.measurement_frequency,
  }));

  exportToCSV(csvData, `performans_gostergeleri_${Date.now()}`);
}

export function generateActivitiesReport(activities: any[]) {
  const csvData = activities.map(act => ({
    'Kod': act.code,
    'Faaliyet': act.title,
    'Hedef': act.goal?.title || '',
    'Durum': act.status,
    'Başlangıç': act.start_date || '',
    'Bitiş': act.end_date || '',
    'Sorumlu Birim': act.responsible_department || '',
    'İlerleme (%)': act.progress_percentage || 0,
  }));

  exportToCSV(csvData, `faaliyetler_${Date.now()}`);
}
