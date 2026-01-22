export default function ProgressRecordsTab({ projectId, onUpdate }: { projectId: string; onUpdate: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">İlerleme Kayıtları - Geliştirme aşamasında</p>
      <p className="text-sm text-gray-400 mt-2">Bu bölüm bir sonraki güncellemede eklenecektir.</p>
    </div>
  );
}
