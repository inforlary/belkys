import { Building2 } from 'lucide-react';

export default function OrganizationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-purple-600" />
          Kurum Bilgileri
        </h1>
        <p className="text-slate-600 mt-2">Kurum bilgilerini görüntüleyin ve düzenleyin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-500">Bu sayfa yakında aktif olacak</p>
      </div>
    </div>
  );
}
