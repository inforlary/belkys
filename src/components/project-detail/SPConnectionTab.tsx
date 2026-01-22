interface Project {
  strategic_plan_id?: string;
}

export default function SPConnectionTab({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">SP Bağlantısı - Geliştirme aşamasında</p>
      <p className="text-sm text-gray-400 mt-2">Bu bölüm bir sonraki güncellemede eklenecektir.</p>
      {project.strategic_plan_id ? (
        <p className="text-sm text-green-600 mt-4">Bağlantılı</p>
      ) : (
        <p className="text-sm text-gray-400 mt-4">Henüz bağlantı yok</p>
      )}
    </div>
  );
}
