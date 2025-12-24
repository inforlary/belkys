export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  if (!data || data.length === 0) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }

  const csvHeaders = headers || Object.keys(data[0]);

  const csvRows = data.map(row =>
    csvHeaders.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';

      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
    }).join(',')
  );

  const csv = [csvHeaders.join(','), ...csvRows].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: any[], filename: string, headers?: string[]) => {
  if (!data || data.length === 0) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }

  const excelHeaders = headers || Object.keys(data[0]);

  let html = '<table>';
  html += '<thead><tr>';
  excelHeaders.forEach(header => {
    html += `<th style="background-color: #4F81BD; color: white; font-weight: bold; padding: 8px; border: 1px solid #ddd;">${header}</th>`;
  });
  html += '</tr></thead>';

  html += '<tbody>';
  data.forEach(row => {
    html += '<tr>';
    excelHeaders.forEach(header => {
      const value = row[header];
      const displayValue = value === null || value === undefined ? '' :
                          typeof value === 'object' ? JSON.stringify(value) : String(value);
      html += `<td style="padding: 8px; border: 1px solid #ddd;">${displayValue}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface PDFTableColumn {
  header: string;
  key: string;
  width?: number;
}

export const exportToPDF = (
  data: any[],
  filename: string,
  title: string,
  columns: PDFTableColumn[]
) => {
  if (!data || data.length === 0) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF önizlemesi açılamadı. Lütfen pop-up engelleyiciyi kontrol edin.');
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
          margin: 20mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #4F81BD;
          padding-bottom: 15px;
        }
        h1 {
          color: #4F81BD;
          margin: 0;
          font-size: 28px;
        }
        .meta {
          color: #666;
          font-size: 12px;
          margin-top: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 11px;
        }
        th {
          background-color: #4F81BD;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #2F5F8F;
        }
        td {
          padding: 10px 8px;
          border: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        tr:hover {
          background-color: #f0f5ff;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">
          Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')} |
          Toplam Kayıt: ${data.length}
        </div>
      </div>

      <button onclick="window.print()" class="no-print" style="
        background-color: #4F81BD;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        margin-bottom: 15px;
      ">PDF Olarak Kaydet</button>

      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th style="${col.width ? `width: ${col.width}px;` : ''}">${col.header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${columns.map(col => {
                const value = row[col.key];
                const displayValue = value === null || value === undefined ? '-' :
                                    typeof value === 'object' ? JSON.stringify(value) : String(value);
                return `<td>${displayValue}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Kurumsal Performans Yönetim Sistemi © ${new Date().getFullYear()}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export const formatDateForExport = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('tr-TR');
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(amount);
};

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return `%${value.toFixed(2)}`;
};

export const prepareDataForExport = (data: any[], mappings: Record<string, string>) => {
  return data.map(item => {
    const exportItem: any = {};
    Object.entries(mappings).forEach(([key, label]) => {
      exportItem[label] = item[key];
    });
    return exportItem;
  });
};
