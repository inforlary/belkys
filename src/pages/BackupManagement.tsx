import { Database } from 'lucide-react';

export default function BackupManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Database className="w-8 h-8 text-cyan-600" />
          Yedekleme Yönetimi
        </h1>
        <p className="text-slate-600 mt-2">Veritabanı yedeklemelerini yönetin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-500">Bu sayfa yakında aktif olacak</p>
      </div>
    </div>
  );
}
