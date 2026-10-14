import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * DataTable: semantic <table> from lg (1024px), your existing mobile card/list below it.
 *   <DataTable
 *     caption="Movimientos"                      // required, screen-reader label
 *     rows={items}
 *     getRowKey={(r) => r.id}
 *     columns={[
 *       { key: "date", header: "Fecha", cell: (r) => r.date },
 *       { key: "name", header: "Descripción", cell: (r) => r.name, className: "w-full" },
 *       { key: "amount", header: "Monto", align: "right", cell: (r) => <Money value={r.amount} /> },
 *     ]}
 *     renderMobile={(r) => <TransactionItem ... />}   // rendered inside <ul>/<li> below lg
 *     onRowClick={(r) => open(r)}                     // optional: row gets hover + Enter/Space access
 *     empty={<EmptyState .../>}                       // optional, shown when rows is empty (both layouts)
 *   />
 * Column: { key, header, cell(row), align?: "left" | "right" (numeric: tabular-nums), className? }.
 * Desktop: sticky header (pinned under the sticky AppHeader via --app-header-h), hover rows (hover-capable devices only),
 * numeric cells right-aligned with tabular figures. Both trees are CSS-toggled (no hydration flash).
 * `mobileClassName` styles the mobile <ul> (default "flex flex-col gap-1").
 */
export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface DataTableProps<T> {
  caption: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  renderMobile: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  mobileClassName?: string;
  className?: string;
}

export function DataTable<T>({
  caption,
  rows,
  columns,
  getRowKey,
  renderMobile,
  onRowClick,
  empty,
  mobileClassName,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={className}>
      <ul className={cn("lg:hidden", mobileClassName ?? "flex flex-col gap-1")}>
        {rows.map((row) => (
          <li key={getRowKey(row)}>{renderMobile(row)}</li>
        ))}
      </ul>
      <div className="hidden overflow-clip rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-(--z-raised) lg:top-(--app-header-h) border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-xs font-medium text-[var(--color-text-muted)]",
                    c.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)]",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 align-middle",
                      c.align === "right" && "text-right tabular-nums",
                      c.className
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
