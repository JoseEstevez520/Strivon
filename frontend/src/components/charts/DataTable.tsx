import type { ReactNode } from 'react'

/** A plain table: a muted header row, a hairline of tone between rows, numbers aligned to the right. */
export function DataTable({ columns, rows }: { columns: { key: string; label: string; numeric?: boolean }[]; rows: Record<string, ReactNode>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-ui">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`h-8 px-2 text-meta font-normal text-fg-muted ${c.numeric ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-surface">
              {columns.map((c) => (
                <td key={c.key} className={`h-9 px-2 first:rounded-l-md last:rounded-r-md ${c.numeric ? 'text-right tabular-nums' : 'text-left'}`}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
