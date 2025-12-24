interface TableData {
  headers: string[];
  rows: string[][];
}

interface TableRendererProps {
  tables: TableData[];
}

export default function TableRenderer({ tables }: TableRendererProps) {
  if (!tables || tables.length === 0) return null;

  return (
    <div className="space-y-4">
      {tables.map((table, tableIndex) => (
        <div key={tableIndex} className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-blue-50">
              <tr>
                {table.headers.map((header, headerIndex) => (
                  <th
                    key={headerIndex}
                    className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border border-gray-300 px-4 py-2 text-gray-600"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
