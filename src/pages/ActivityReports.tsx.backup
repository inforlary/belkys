import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  Search,
  Edit2,
  FileText,
  BarChart3,
  Upload,
  Plus,
  X,
  Clipboard,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Eye,
} from 'lucide-react';

interface Indicator {
  id: string;
  code: string;
  name: string;
  target_value: number | null;
  unit: string | null;
}

interface IndicatorReport {
  indicator_id: string;
  description: string;
  images: { url: string; caption: string; file?: File }[];
  tables: { rows: string[][] }[];
}

interface Report {
  id: string;
  indicator_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  content: IndicatorReport;
  rejection_reason?: string;
  submitted_at?: string;
  approved_at?: string;
}

export default function ActivityReports() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewReport, setViewReport] = useState<{ indicator: Indicator; report: Report } | null>(null);

  const [editData, setEditData] = useState<IndicatorReport>({
    indicator_id: '',
    description: '',
    images: [],
    tables: [],
  });

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          id,
          code,
          name,
          target_value,
          unit,
          goal:goals!inner(department_id)
        `)
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (profile.role !== 'admin' && profile.department_id) {
        indicatorsQuery = indicatorsQuery.eq('goal.department_id', profile.department_id);
      }

      const { data: indicatorsData, error: indicatorsError } = await indicatorsQuery;
      if (indicatorsError) throw indicatorsError;

      let reportsQuery = supabase
        .from('activity_reports')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('period_year', selectedYear);

      if (profile.role !== 'admin' && profile.department_id) {
        reportsQuery = reportsQuery.eq('department_id', profile.department_id);
      }

      const { data: reportsData, error: reportsError } = await reportsQuery;
      if (reportsError) throw reportsError;

      setIndicators(indicatorsData || []);

      const reportsMap: Record<string, Report> = {};
      (reportsData || []).forEach((report) => {
        reportsMap[report.indicator_id] = {
          id: report.id,
          indicator_id: report.indicator_id,
          status: report.status,
          content: report.content,
          rejection_reason: report.rejection_reason,
          submitted_at: report.submitted_at,
          approved_at: report.approved_at,
        };
      });
      setReports(reportsMap);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (indicator: Indicator) => {
    const report = reports[indicator.id];
    if (report && report.status !== 'draft' && profile?.role !== 'admin') {
      alert('Sadece taslak durumundaki raporları düzenleyebilirsiniz');
      return;
    }

    setSelectedIndicator(indicator);
    setEditData(
      report?.content || {
        indicator_id: indicator.id,
        description: '',
        images: [],
        tables: [],
      }
    );
    setIsEditModalOpen(true);
  };

  const handleView = (indicator: Indicator) => {
    const report = reports[indicator.id];
    if (!report) return;
    setViewReport({ indicator, report });
    setIsViewModalOpen(true);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `activity-reports/${profile?.organization_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('public')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('public').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!selectedIndicator || !profile) return;

    try {
      const uploadedImages = await Promise.all(
        editData.images.map(async (img) => {
          if (img.file) {
            setUploadingImages((prev) => new Set(prev).add(editData.images.indexOf(img)));
            const url = await uploadImage(img.file);
            setUploadingImages((prev) => {
              const newSet = new Set(prev);
              newSet.delete(editData.images.indexOf(img));
              return newSet;
            });
            return { url, caption: img.caption };
          }
          return { url: img.url, caption: img.caption };
        })
      );

      const finalData = {
        ...editData,
        images: uploadedImages,
      };

      const existingReport = reports[selectedIndicator.id];

      if (existingReport) {
        const { error } = await supabase
          .from('activity_reports')
          .update({
            content: finalData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReport.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('activity_reports').insert({
          organization_id: profile.organization_id,
          department_id: profile.department_id,
          indicator_id: selectedIndicator.id,
          title: `${selectedIndicator.code} - ${selectedYear}`,
          period_year: selectedYear,
          created_by: profile.id,
          content: finalData,
          status: 'draft',
        });

        if (error) throw error;
      }

      setIsEditModalOpen(false);
      await loadData();
    } catch (error) {
      console.error('Rapor kaydedilirken hata:', error);
      alert('Rapor kaydedilirken bir hata oluştu');
    }
  };

  const handleSubmit = async (indicatorId: string) => {
    const report = reports[indicatorId];
    if (!report) return;

    if (!confirm('Bu raporu onaya göndermek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      if (error) throw error;

      await supabase.from('messages').insert({
        organization_id: profile?.organization_id,
        sender_id: profile?.id,
        title: 'Faaliyet Raporu Onay Bekliyor',
        message: `${indicators.find(i => i.id === indicatorId)?.code} - ${selectedYear} yılı faaliyet raporu onayınızı bekliyor.`,
        priority: 'normal',
        type: 'system',
      });

      await loadData();
    } catch (error) {
      console.error('Rapor gönderilirken hata:', error);
      alert('Rapor gönderilirken bir hata oluştu');
    }
  };

  const handleApprove = async (indicatorId: string) => {
    const report = reports[indicatorId];
    if (!report) return;

    if (!confirm('Bu raporu onaylamak istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: profile?.id,
        })
        .eq('id', report.id);

      if (error) throw error;

      const { data: reportData } = await supabase
        .from('activity_reports')
        .select('created_by')
        .eq('id', report.id)
        .single();

      if (reportData) {
        await supabase.from('messages').insert({
          organization_id: profile?.organization_id,
          sender_id: profile?.id,
          recipient_id: reportData.created_by,
          title: 'Faaliyet Raporu Onaylandı',
          message: `${indicators.find(i => i.id === indicatorId)?.code} - ${selectedYear} yılı faaliyet raporunuz onaylandı.`,
          priority: 'normal',
          type: 'system',
        });
      }

      await loadData();
    } catch (error) {
      console.error('Rapor onaylanırken hata:', error);
      alert('Rapor onaylanırken bir hata oluştu');
    }
  };

  const handleReject = async (indicatorId: string) => {
    const report = reports[indicatorId];
    if (!report) return;

    setSelectedIndicator(indicators.find(i => i.id === indicatorId) || null);
    setIsApprovalModalOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedIndicator || !rejectionReason.trim()) {
      alert('Lütfen red nedeni giriniz');
      return;
    }

    const report = reports[selectedIndicator.id];
    if (!report) return;

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', report.id);

      if (error) throw error;

      const { data: reportData } = await supabase
        .from('activity_reports')
        .select('created_by')
        .eq('id', report.id)
        .single();

      if (reportData) {
        await supabase.from('messages').insert({
          organization_id: profile?.organization_id,
          sender_id: profile?.id,
          recipient_id: reportData.created_by,
          title: 'Faaliyet Raporu Reddedildi',
          message: `${selectedIndicator.code} - ${selectedYear} yılı faaliyet raporunuz reddedildi. Neden: ${rejectionReason}`,
          priority: 'high',
          type: 'system',
        });
      }

      setIsApprovalModalOpen(false);
      setRejectionReason('');
      await loadData();
    } catch (error) {
      console.error('Rapor reddedilirken hata:', error);
      alert('Rapor reddedilirken bir hata oluştu');
    }
  };

  const exportToPDF = async (indicator: Indicator) => {
    const report = reports[indicator.id];
    if (!report) return;

    alert('PDF export özelliği yakında eklenecek');
  };

  const exportAllToExcel = () => {
    let csvContent = 'Gösterge Kodu,Gösterge Adı,Durum,Açıklama\n';

    indicators.forEach((indicator) => {
      const report = reports[indicator.id];
      const status = report?.status || 'Girilmedi';
      const description = report?.content.description || '';
      csvContent += `"${indicator.code}","${indicator.name}","${status}","${description.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `faaliyet_raporu_${selectedYear}.csv`;
    link.click();
  };

  const handleFileSelect = (index: number) => {
    setCurrentImageIndex(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || currentImageIndex === null) return;

    if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
      alert('Sadece PNG veya JPEG formatında görseller yükleyebilirsiniz');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const newImages = [...editData.images];
      newImages[currentImageIndex] = {
        ...newImages[currentImageIndex],
        url: e.target?.result as string,
        file: file,
      };
      setEditData({ ...editData, images: newImages });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addImage = () => {
    setEditData({
      ...editData,
      images: [...editData.images, { url: '', caption: '' }],
    });
  };

  const updateImage = (index: number, field: 'caption', value: string) => {
    const newImages = [...editData.images];
    newImages[index][field] = value;
    setEditData({ ...editData, images: newImages });
  };

  const removeImage = (index: number) => {
    setEditData({
      ...editData,
      images: editData.images.filter((_, i) => i !== index),
    });
  };

  const addTable = () => {
    setEditData({
      ...editData,
      tables: [
        ...editData.tables,
        {
          rows: [
            ['', '', ''],
            ['', '', ''],
          ],
        },
      ],
    });
  };

  const handlePasteExcel = (tableIndex: number, event: React.ClipboardEvent) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData('text');
    const rows = pastedData.split('\n').map(row => row.split('\t'));

    const newTables = [...editData.tables];
    newTables[tableIndex] = { rows };
    setEditData({ ...editData, tables: newTables });
  };

  const updateTableCell = (tableIndex: number, rowIndex: number, cellIndex: number, value: string) => {
    const newTables = [...editData.tables];
    newTables[tableIndex].rows[rowIndex][cellIndex] = value;
    setEditData({ ...editData, tables: newTables });
  };

  const addTableRow = (tableIndex: number) => {
    const newTables = [...editData.tables];
    const colCount = newTables[tableIndex].rows[0]?.length || 3;
    newTables[tableIndex].rows.push(new Array(colCount).fill(''));
    setEditData({ ...editData, tables: newTables });
  };

  const addTableColumn = (tableIndex: number) => {
    const newTables = [...editData.tables];
    newTables[tableIndex].rows = newTables[tableIndex].rows.map((row) => [...row, '']);
    setEditData({ ...editData, tables: newTables });
  };

  const removeTable = (index: number) => {
    setEditData({
      ...editData,
      tables: editData.tables.filter((_, i) => i !== index),
    });
  };

  const getStatusBadge = (status?: 'draft' | 'submitted' | 'approved' | 'rejected') => {
    if (!status) return null;

    const badges = {
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-800', icon: FileText },
      submitted: { label: 'Onay Bekliyor', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-800', icon: XCircle },
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const filteredIndicators = indicators.filter((indicator) => {
    const matchesSearch =
      indicator.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indicator.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;

    const report = reports[indicator.id];
    if (statusFilter === 'no-report') return matchesSearch && !report;

    return matchesSearch && report?.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faaliyet Raporu</h1>
          <p className="text-gray-600 mt-1">Performans göstergeleriniz için açıklama ve detay ekleyin</p>
        </div>
        <Button onClick={exportAllToExcel} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Excel İndir
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Yıl</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tümü</option>
            <option value="no-report">Girilmedi</option>
            <option value="draft">Taslak</option>
            <option value="submitted">Onay Bekliyor</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ara</label>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Gösterge ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {filteredIndicators.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Gösterge bulunmuyor</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredIndicators.map((indicator) => {
            const report = reports[indicator.id];
            return (
              <Card key={indicator.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {indicator.code} - {indicator.name}
                        </h3>
                        {getStatusBadge(report?.status)}
                      </div>
                      {indicator.target_value && (
                        <p className="text-sm text-gray-600">
                          Hedef: {indicator.target_value} {indicator.unit}
                        </p>
                      )}
                      {report?.rejection_reason && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                          <p className="text-sm text-red-900">
                            <strong>Red Nedeni:</strong> {report.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {report && (
                        <Button size="sm" variant="outline" onClick={() => handleView(indicator)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}

                      {(!report || report.status === 'draft' || report.status === 'rejected' || profile?.role === 'admin') && (
                        <Button size="sm" onClick={() => handleEdit(indicator)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          {report ? 'Düzenle' : 'Rapor Ekle'}
                        </Button>
                      )}

                      {report && report.status === 'draft' && profile?.role !== 'admin' && (
                        <Button size="sm" onClick={() => handleSubmit(indicator.id)}>
                          <Send className="w-4 h-4 mr-2" />
                          Onaya Gönder
                        </Button>
                      )}

                      {report && report.status === 'submitted' && profile?.role === 'admin' && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(indicator.id)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Onayla
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(indicator.id)}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Reddet
                          </Button>
                        </>
                      )}

                      {report && report.status === 'approved' && (
                        <Button size="sm" variant="outline" onClick={() => exportToPDF(indicator)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedIndicator ? `${selectedIndicator.code} - ${selectedIndicator.name}` : ''}
        size="large"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Bu gösterge hakkında açıklama yazın..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Görseller</label>
              <Button size="sm" variant="outline" onClick={addImage}>
                <Plus className="w-4 h-4 mr-2" />
                Görsel Ekle
              </Button>
            </div>
            <div className="space-y-3">
              {editData.images.map((image, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Görsel {index + 1}</span>
                    <button
                      onClick={() => removeImage(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFileSelect(index)}
                    className="w-full mb-2"
                    disabled={uploadingImages.has(index)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingImages.has(index) ? 'Yükleniyor...' : 'Görsel Yükle (PNG/JPEG)'}
                  </Button>

                  {image.url && (
                    <img src={image.url} alt="" className="w-full h-48 object-cover rounded-lg mb-2" />
                  )}
                  <input
                    type="text"
                    value={image.caption}
                    onChange={(e) => updateImage(index, 'caption', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Görsel açıklaması (opsiyonel)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Tablolar</label>
              <Button size="sm" variant="outline" onClick={addTable}>
                <Plus className="w-4 h-4 mr-2" />
                Tablo Ekle
              </Button>
            </div>
            <div className="space-y-4">
              {editData.tables.map((table, tableIndex) => (
                <div key={tableIndex} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Tablo {tableIndex + 1}</span>
                    <button
                      onClick={() => removeTable(tableIndex)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Clipboard className="w-4 h-4 text-blue-600 mt-0.5" />
                      <p className="text-sm text-blue-900">
                        Excel'den veri kopyalayıp tabloya yapıştırabilirsiniz. Tabloyu seçip <kbd className="px-1 py-0.5 bg-white rounded border text-xs">Ctrl+V</kbd> yapın.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto mb-3">
                    <table className="min-w-full border border-gray-300">
                      <tbody>
                        {table.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="border border-gray-300 p-0">
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(e) =>
                                    updateTableCell(tableIndex, rowIndex, cellIndex, e.target.value)
                                  }
                                  onPaste={(e) => {
                                    if (rowIndex === 0 && cellIndex === 0) {
                                      handlePasteExcel(tableIndex, e);
                                    }
                                  }}
                                  className="w-full px-2 py-1 border-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addTableRow(tableIndex)}>
                      Satır Ekle
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addTableColumn(tableIndex)}>
                      Sütun Ekle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleSave} className="flex-1">
              Kaydet
            </Button>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
              İptal
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={viewReport ? `${viewReport.indicator.code} - ${viewReport.indicator.name}` : ''}
        size="large"
      >
        {viewReport && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusBadge(viewReport.report.status)}
                {viewReport.report.submitted_at && (
                  <span className="text-sm text-gray-600">
                    Gönderim: {new Date(viewReport.report.submitted_at).toLocaleDateString('tr-TR')}
                  </span>
                )}
              </div>
            </div>

            {viewReport.report.content.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Açıklama</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{viewReport.report.content.description}</p>
              </div>
            )}

            {viewReport.report.content.images.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Görseller</h3>
                <div className="space-y-4">
                  {viewReport.report.content.images.map((image, index) => (
                    <div key={index}>
                      <img src={image.url} alt="" className="w-full rounded-lg" />
                      {image.caption && (
                        <p className="text-sm text-gray-600 mt-1">{image.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewReport.report.content.tables.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tablolar</h3>
                <div className="space-y-4">
                  {viewReport.report.content.tables.map((table, index) => (
                    <div key={index} className="overflow-x-auto">
                      <table className="min-w-full border border-gray-300">
                        <tbody>
                          {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border border-gray-300 px-3 py-2">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setRejectionReason('');
        }}
        title="Rapor Reddetme"
      >
        <div className="space-y-4">
          <p className="text-gray-700">Bu raporu reddetmek istediğinizden emin misiniz?</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Red Nedeni *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Raporu neden reddediyorsunuz?"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={confirmReject} className="flex-1 bg-red-600 hover:bg-red-700">
              Reddet
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsApprovalModalOpen(false);
                setRejectionReason('');
              }}
              className="flex-1"
            >
              İptal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
