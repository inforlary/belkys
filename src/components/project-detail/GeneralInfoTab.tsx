interface Project {
  project_no: string;
  project_name: string;
  source: string;
  year: number;
  period: number;
  sector: string;
  sub_sector: string;
  responsible_unit: string;
  location: string;
  tender_date: string;
  tender_type: string;
  contractor: string;
  start_date: string;
  end_date: string;
  contract_amount: number;
}

interface GeneralInfoTabProps {
  project: Project;
}

export default function GeneralInfoTab({ project }: GeneralInfoTabProps) {
  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
  };

  const formatCurrency = (amount: number) => {
    if (!amount) return '-';
    return `${amount.toLocaleString('tr-TR')} ₺`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Proje Bilgileri</h3>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Proje No</label>
            <div className="text-sm text-gray-900">{project.project_no}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Kaynak</label>
            <div className="text-sm text-gray-900">{project.source?.toUpperCase()}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Yıl</label>
            <div className="text-sm text-gray-900">{project.year}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Dönem</label>
            <div className="text-sm text-gray-900">{project.period ? `${project.period}. Dönem` : '-'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Sektör</label>
            <div className="text-sm text-gray-900">{project.sector || '-'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Alt Sektör</label>
            <div className="text-sm text-gray-900">{project.sub_sector || '-'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Sorumlu Birim</label>
            <div className="text-sm text-gray-900">{project.responsible_unit}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Yer/Mahalle</label>
            <div className="text-sm text-gray-900">{project.location || '-'}</div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">İhale Bilgileri</h3>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">İhale Tarihi</label>
            <div className="text-sm text-gray-900">{formatDate(project.tender_date)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">İhale Türü</label>
            <div className="text-sm text-gray-900">{project.tender_type || '-'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Yüklenici</label>
            <div className="text-sm text-gray-900">{project.contractor || '-'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Başlama Tarihi</label>
            <div className="text-sm text-gray-900">{formatDate(project.start_date)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Bitiş Tarihi</label>
            <div className="text-sm text-gray-900">{formatDate(project.end_date)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Sözleşme Tutarı</label>
            <div className="text-sm font-bold text-gray-900">{formatCurrency(project.contract_amount)}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mali Bilgiler</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">Dönem</th>
                <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Ödenek</th>
                <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Harcama</th>
                <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Nakdi %</th>
                <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Fiziki %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">Önceki Yıllar</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">-</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">I. Dönem</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">-</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">II. Dönem</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">-</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">III. Dönem</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">-</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">0</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">2</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">IV. Dönem</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">-</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">46.581.374</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">19.5</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700 text-right">25</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">TOPLAM</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900 text-right">-</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900 text-right">46.581.374</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900 text-right">19.5</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900 text-right">27</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
