import { Shield } from 'lucide-react';

export default function LoginAttemptsLog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-600" />
          Giriş Denemeleri
        </h1>
        <p className="text-slate-600 mt-2">Başarılı ve başarısız giriş denemelerini görüntüleyin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-500">Bu sayfa yakında aktif olacak</p>
      </div>
    </div>
  );
}
