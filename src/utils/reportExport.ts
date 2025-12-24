import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  if (data.length === 0) {
    alert('Rapor için veri bulunamadı');
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

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filename}_${date}.xlsx`);
};

export const exportToPDF = (data: any[], filename: string, title: string) => {
  if (data.length === 0) {
    alert('Rapor için veri bulunamadı');
    return;
  }

  const headers = Object.keys(data[0]);
  const date = new Date().toLocaleDateString('tr-TR');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 15mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 9pt;
          line-height: 1.4;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 3px solid #e97528;
        }
        h1 {
          color: #e97528;
          font-size: 18pt;
          margin: 0 0 5px 0;
        }
        .report-date {
          color: #666;
          font-size: 9pt;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 8pt;
        }
        th {
          background-color: #34495e;
          color: white;
          font-weight: bold;
          padding: 8px 6px;
          text-align: left;
          border: 1px solid #2c3e50;
          font-size: 8pt;
        }
        td {
          padding: 6px;
          border: 1px solid #ddd;
          text-align: left;
        }
        tr:nth-child(even) {
          background-color: #f5f5f5;
        }
        tr:hover {
          background-color: #fff3e0;
        }
        .page-break {
          page-break-after: always;
        }
        @media print {
          body {
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
        .footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
          font-size: 7pt;
          color: #666;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <p class="report-date">Rapor Tarihi: ${date}</p>
      </div>

      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(header => `<td>${row[header] || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>Kurumsal Yönetim Sistemi - İç Kontrol ve Risk Yönetimi</p>
        <p>Sayfa 1 / 1</p>
      </div>

      <div class="no-print" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 15px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); border-radius: 8px; z-index: 1000;">
        <button onclick="window.print()" style="padding: 12px 24px; background: #e97528; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin-right: 10px;">
          📄 PDF Olarak Kaydet
        </button>
        <button onclick="window.close()" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
          ✖ Kapat
        </button>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up engellendi. Lütfen tarayıcı ayarlarından pop-up iznini açın.');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
  }, 250);
};
