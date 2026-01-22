interface Project {
  start_date: string;
  end_date: string;
  physical_progress: number;
}

export default function TimelineTab({ project }: { project: Project }) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">Timeline - Geliştirme aşamasında</p>
      <p className="text-sm text-gray-400 mt-2">Bu bölüm bir sonraki güncellemede eklenecektir.</p>
    </div>
  );
}
