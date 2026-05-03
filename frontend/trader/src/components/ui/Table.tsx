'use client';

import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowContextMenu?: (row: T, e: React.MouseEvent) => void;
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
  rowClassName?: (row: T) => string;
}

export default function Table<T extends Record<string, any>>({
  columns, data, rowKey, onRowClick, onRowContextMenu, emptyMessage, compact, className, rowClassName,
}: TableProps<T>) {
  const cellPad = compact ? 'px-2 py-1' : 'px-2 py-1.5';

  return (
    <div className={cn('overflow-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  cellPad,
                  'text-xs font-medium text-text-tertiary select-none whitespace-nowrap',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-text-tertiary text-sm">
                {emptyMessage || 'No data'}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                onContextMenu={(e) => onRowContextMenu?.(row, e)}
                className={cn(
                  'border-b border-border-primary/50 transition-fast',
                  onRowClick && 'cursor-pointer',
                  'hover:bg-bg-hover',
                  rowClassName?.(row),
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      cellPad,
                      'text-sm tabular-nums whitespace-nowrap',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
