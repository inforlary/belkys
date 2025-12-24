import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import { Image as ImageIcon, X, Clipboard, Trash2 } from 'lucide-react';

interface EnhancedReportEditorProps {
  value: any;
  onChange: (value: any) => void;
  reportId?: string;
}

interface UploadedImage {
  name: string;
  url: string;
}

interface ReportContent {
  text: string;
  images: UploadedImage[];
  tables: any[];
}

export default function EnhancedReportEditor({ value, onChange, reportId }: EnhancedReportEditorProps) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getContent = (): ReportContent => {
    if (typeof value === 'string') {
      return { text: value, images: [], tables: [] };
    }
    return value || { text: '', images: [], tables: [] };
  };

  const updateContent = (updates: Partial<ReportContent>) => {
    const current = getContent();
    onChange({ ...current, ...updates });
  };

  const content = getContent();

  const compressImage = (file: File, maxSizeMB: number = 1): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Sıkıştırma başarısız'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !profile?.organization_id) return;

    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Lütfen sadece görsel dosyası seçin');
      return;
    }

    try {
      setUploading(true);
      const uploadedUrls: UploadedImage[] = [];

      for (const file of imageFiles) {
        try {
          const compressedFile = await compressImage(file);

          const fileExt = 'jpg';
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${profile.organization_id}/${reportId || 'temp'}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('activity-reports')
            .upload(filePath, compressedFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error for', file.name, ':', uploadError);
            alert(`"${file.name}" yüklenirken hata: ${uploadError.message}`);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('activity-reports')
            .getPublicUrl(filePath);

          uploadedUrls.push({
            name: file.name,
            url: publicUrl
          });
        } catch (compressError: any) {
          console.error('Compression error for', file.name, ':', compressError);
          alert(`"${file.name}" sıkıştırılırken hata`);
          continue;
        }
      }

      if (uploadedUrls.length > 0) {
        updateContent({ images: [...content.images, ...uploadedUrls] });
        alert(`${uploadedUrls.length} görsel başarıyla yüklendi!`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Görsel yüklenirken hata: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = content.images.filter((_, i) => i !== index);
    updateContent({ images: newImages });
  };

  const handlePasteTableData = async () => {
    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        alert('Pano boş! Lütfen Excel\'den veri kopyalayın (Ctrl+C).');
        return;
      }

      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        alert('Yapıştırılan veri boş görünüyor');
        return;
      }

      const parseLine = (line: string) => {
        return line.split('\t').map(cell => cell.trim());
      };

      const allRows = lines.map(parseLine);
      const headers = allRows[0];
      const rows = allRows.slice(1);

      const maxCols = Math.max(...allRows.map(r => r.length));
      const normalizedHeaders = [...headers, ...Array(Math.max(0, maxCols - headers.length)).fill('')];
      const normalizedRows = rows.map(row => [...row, ...Array(Math.max(0, maxCols - row.length)).fill('')]);

      const filteredHeaders = normalizedHeaders.filter(h => h.trim());
      const filteredRows = normalizedRows
        .map(row => row.slice(0, filteredHeaders.length))
        .filter(row => row.some(cell => cell.trim()));

      if (filteredHeaders.length === 0) {
        alert('Hiç sütun başlığı bulunamadı');
        return;
      }

      const newTable = {
        headers: filteredHeaders,
        rows: filteredRows
      };

      updateContent({ tables: [...content.tables, newTable] });

      alert('Tablo başarıyla eklendi!');
    } catch (error: any) {
      console.error('Paste error:', error);
      alert('Veri yapıştırılırken hata. Excel\'den Ctrl+C ile kopyaladığınızdan emin olun.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap border-b pb-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <ImageIcon className="w-4 h-4 mr-1" />
          {uploading ? 'Yükleniyor...' : 'Görsel Ekle (Çoklu)'}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handlePasteTableData}
        >
          <Clipboard className="w-4 h-4 mr-1" />
          Excel'den Yapıştır
        </Button>

        <span className="text-xs text-gray-500 ml-2">
          💡 Büyük görseller otomatik sıkıştırılır
        </span>
      </div>

      {content.images.length > 0 && (
        <div className="border rounded-lg p-3 bg-blue-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Yüklenen Görseller ({content.images.length}):
          </h4>
          <ul className="space-y-2">
            {content.images.map((file, index) => (
              <li key={index} className="flex items-center justify-between text-sm text-gray-600 bg-white p-2 rounded">
                <div className="flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2 text-green-600" />
                  <span>{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="text-red-500 hover:text-red-600 p-1"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.tables.length > 0 && (
        <div className="border rounded-lg p-3 bg-green-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Eklenen Tablolar ({content.tables.length}):
          </h4>
          <div className="space-y-4">
            {content.tables.map((table, index) => (
              <div key={index} className="bg-white p-3 rounded border relative">
                <button
                  type="button"
                  onClick={() => {
                    const newTables = content.tables.filter((_, i) => i !== index);
                    updateContent({ tables: newTables });
                  }}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-600 p-1"
                  title="Tabloyu Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border-collapse border border-gray-300">
                    <thead className="bg-blue-50">
                      <tr>
                        {table.headers.map((header, hIdx) => (
                          <th key={hIdx} className="border border-gray-300 px-2 py-1 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 3).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="border border-gray-300 px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {table.rows.length > 3 && (
                        <tr>
                          <td colSpan={table.headers.length} className="text-center text-gray-500 py-1 text-xs">
                            ... ve {table.rows.length - 3} satır daha
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rapor İçeriği
        </label>
        <textarea
          ref={textareaRef}
          value={content.text}
          onChange={(e) => updateContent({ text: e.target.value })}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Faaliyet raporu detaylarını yazın..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Markdown desteklenir: **kalın**, *italik*, [link](url), # başlık
        </p>
        <p className="text-xs text-blue-600 mt-1">
          💡 Excel'den tablo yapıştırmak için: Verileri Excel'de seçin → Ctrl+C → "Excel'den Yapıştır" butonuna tıklayın
        </p>
      </div>
    </div>
  );
}
