import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, FileText, Loader } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ActivityReport {
  id: string;
  year: number;
  type: string;
  title: string;
  organizations?: { name: string; logo_url?: string };
}

interface ReportSection {
  section_name: string;
  html_content: string | null;
  parent_section_code: string | null;
}

export default function ActivityReportExport() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const reportId = window.location.hash.split('/')[2];
  const previewRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<ActivityReport | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (profile && reportId) {
      loadReport();
    }
  }, [profile, reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);

      const { data: reportData, error: reportError } = await supabase
        .from('activity_reports')
        .select('*, organizations(name, logo_url)')
        .eq('id', reportId)
        .single();

      if (reportError) throw reportError;
      setReport(reportData);

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('report_sections')
        .select('section_name, html_content, parent_section_code')
        .eq('report_id', reportId)
        .order('order_index');

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
    } catch (error: any) {
      console.error('Error loading report:', error);
      alert('Rapor yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!previewRef.current || !report) return;

    try {
      setExporting(true);

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${report.title} - ${report.year}.pdf`);

      alert('PDF başarıyla oluşturuldu');
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert('PDF oluşturulurken hata oluştu: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportHTML = () => {
    if (!previewRef.current || !report) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title} - ${report.year}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
    }
    h1, h2, h3 { color: #1f2937; }
    h1 { font-size: 24px; margin-bottom: 10px; }
    h2 { font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
    h3 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
    p { margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table th, table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    table th { background-color: #f3f4f6; font-weight: bold; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1f2937; padding-bottom: 20px; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .subsection { margin-left: 20px; margin-bottom: 20px; }
  </style>
</head>
<body>
  ${previewRef.current.innerHTML}
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title} - ${report.year}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('HTML dosyası başarıyla oluşturuldu');
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

  if (!report) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Rapor Bulunamadı</h2>
        <Button onClick={() => navigate('activity-reports')} className="mt-4">
          Raporlara Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate(`activity-reports/${reportId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rapor Dışa Aktar</h1>
            <p className="text-gray-600">{report.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleExportHTML}
            disabled={exporting}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            HTML İndir
          </Button>
          <Button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                PDF İndir
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <div
          ref={previewRef}
          className="p-12 bg-white"
          style={{ minHeight: '297mm' }}
        >
          <div className="text-center mb-12 pb-8 border-b-2 border-gray-900">
            {report.organizations?.logo_url && (
              <img
                src={report.organizations.logo_url}
                alt="Logo"
                className="h-20 mx-auto mb-6"
              />
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {report.organizations?.name || 'Kurum Adı'}
            </h1>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {report.title}
            </h2>
            <p className="text-xl text-gray-600">{report.year}</p>
          </div>

          <div className="space-y-8">
            {sections.map((section, index) => (
              <div
                key={index}
                className={section.parent_section_code ? 'ml-8 mb-6' : 'mb-8'}
              >
                <h3
                  className={`${
                    section.parent_section_code
                      ? 'text-lg font-semibold'
                      : 'text-2xl font-bold'
                  } text-gray-900 mb-4`}
                >
                  {section.section_name}
                </h3>
                {section.html_content ? (
                  <div
                    className="prose max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: section.html_content }}
                  />
                ) : (
                  <p className="text-gray-400 italic">Bu bölüm boş.</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-gray-300 text-center text-sm text-gray-600">
            <p>Bu rapor {new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
