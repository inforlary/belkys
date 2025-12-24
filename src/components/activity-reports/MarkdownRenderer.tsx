interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderMarkdown = (text: string) => {
    let html = text;

    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4 shadow-md" />');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-gray-900 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-900 mt-5 mb-3">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-4">$1</h1>');

    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

    html = html.replace(/^- (.+)$/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1 my-2">$1</ul>');

    html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-4">$1</li>');

    const tableRegex = /\|(.+)\|\n\|[\s\-:|]+\|\n((?:\|.+\|\n?)+)/g;
    html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').filter((h: string) => h.trim()).map((h: string) => h.trim());
      const rows = bodyRows.trim().split('\n').map((row: string) =>
        row.split('|').filter((c: string) => c.trim()).map((c: string) => c.trim())
      );

      let table = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-gray-300 border border-gray-300 rounded-lg">';
      table += '<thead class="bg-gray-50"><tr>';
      headers.forEach((h: string) => {
        table += `<th class="px-4 py-2 text-left text-sm font-semibold text-gray-900 border-b">${h}</th>`;
      });
      table += '</tr></thead><tbody class="divide-y divide-gray-200 bg-white">';
      rows.forEach((row: string[]) => {
        table += '<tr>';
        row.forEach((cell: string) => {
          table += `<td class="px-4 py-2 text-sm text-gray-700 border-r last:border-r-0">${cell}</td>`;
        });
        table += '</tr>';
      });
      table += '</tbody></table></div>';
      return table;
    });

    html = html.replace(/\n\n/g, '</p><p class="mb-3">');
    html = '<p class="mb-3">' + html + '</p>';

    return html;
  };

  return (
    <div
      className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
