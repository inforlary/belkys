import { CheckSquare } from 'lucide-react';

export default function ControlTesting() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Kontrol Testi/Etkinlik</h1>
            <p className="text-slate-600 mt-1">Kontrol etkinlik testleri</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="text-center">
          <CheckSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Kontrol Testi/Etkinlik</h3>
          <p className="text-slate-600">Bu sayfa yakında eklenecektir.</p>
        </div>
      </div>
    </div>
  );
}
