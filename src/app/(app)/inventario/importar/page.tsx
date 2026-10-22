"use client";

import { useRef, useState } from "react";
import { Download, FileUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount } from "@/lib/format";
import { importProducts, inventoryErrorMessage } from "@/lib/inventory/api";
import { IMPORT_HEADERS, parseImportRows, readImportFile } from "@/lib/inventory/importRows";

type Parsed = ReturnType<typeof parseImportRows>;

function downloadTemplate() {
  const csv = `${IMPORT_HEADERS.join(",")}\n7702004003508,Arroz 500 g,Granos,unidad,2500,2800,1800,10,2\n`;
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-productos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportarProductosPage() {
  const { hydrated, permissions, currentWorkspace } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [serverErrors, setServerErrors] = useState<{ row: number; message: string }[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { hidden } = usePrivacy();
  const currency = currentWorkspace?.currency ?? "COP";
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));

  if (hydrated && !permissions.canImportProducts) {
    return (
      <>
        <AppHeader />
        <PageContainer size="narrow">
          <PageHeader title="Importar productos" backHref="/inventario" backLabel="Inventario" />
          <div className="mx-4 mt-6">
            <EmptyState icon={ShieldAlert} title="No tienes permiso para importar productos." />
          </div>
        </PageContainer>
      </>
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setServerErrors([]);
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      toast.error("Usa un archivo .csv o .xlsx.");
      return;
    }
    setReading(true);
    try {
      setParsed(parseImportRows(await readImportFile(file)));
    } catch {
      toast.error("No pudimos leer el archivo.");
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!parsed || !currentWorkspace || parsed.errors.length > 0 || parsed.valid.length === 0) return;
    setSaving(true);
    setServerErrors([]);
    try {
      const res = await importProducts(currentWorkspace.id, parsed.valid);
      if (res.ok) {
        toast.success(res.created === 1 ? "Importaste 1 producto." : `Importaste ${res.created} productos.`);
        setParsed(null);
        setFileName("");
      } else {
        // El servidor numera por posición en `valid`; se traduce a la fila del archivo.
        setServerErrors(res.errors.map((er) => ({ ...er, row: parsed.validRowNumbers[er.row - 1] ?? er.row })));
        toast.error("Hay filas con errores. No se guardó nada.");
      }
    } catch (err) {
      toast.error(inventoryErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const errors = parsed ? parsed.errors : [];
  const allErrors = [...errors, ...serverErrors];

  return (
    <>
      <AppHeader />
      <PageContainer size="medium">
        <PageHeader
          title="Importar productos"
          subtitle="Sube un archivo .csv o .xlsx."
          backHref="/inventario"
          backLabel="Inventario"
          actions={
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download size={16} aria-hidden />
              Descargar plantilla
            </Button>
          }
        />
        <div className="mx-4 mt-4 flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={onFile}
            className="sr-only"
            aria-label="Archivo de productos"
          />
          <Button variant="secondary" loading={reading} onClick={() => fileRef.current?.click()} fullWidth>
            <FileUp size={16} aria-hidden />
            {fileName || "Elegir archivo"}
          </Button>

          {allErrors.length > 0 ? (
            <div role="alert" className="rounded-2xl border border-[var(--color-expense)]/50 bg-[var(--color-expense)]/10 p-4">
              <p className="text-sm font-semibold text-[var(--color-expense)]">
                Corrige estas filas y vuelve a subir el archivo.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {allErrors.map((er, i) => (
                  <li key={`${er.row}-${i}`}>
                    <span className="font-medium">Fila {er.row}:</span> {er.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {parsed && parsed.valid.length > 0 ? (
            <>
              <p className="text-sm text-[var(--color-text-muted)]">
                {parsed.valid.length === 1 ? "1 producto listo" : `${parsed.valid.length} productos listos`} para importar.
              </p>
              <DataTable
                caption="Productos a importar"
                rows={parsed.valid.map((r, i) => ({ ...r, key: String(i) }))}
                getRowKey={(r) => r.key}
                mobileClassName="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5"
                columns={[
                  { key: "barcode", header: "Código", cell: (r) => r.barcode ?? "" },
                  { key: "name", header: "Nombre", cell: (r) => r.name },
                  { key: "category", header: "Categoría", cell: (r) => r.category ?? "" },
                  { key: "unit", header: "Unidad", cell: (r) => r.unit },
                  { key: "cash", header: "Contado", align: "right", cell: (r) => money(r.price_cash) },
                  { key: "credit", header: "Crédito", align: "right", cell: (r) => money(r.price_credit) },
                  { key: "stock", header: "Stock", align: "right", cell: (r) => r.stock },
                ]}
                renderMobile={(r) => (
                  <div className="rounded-2xl px-2 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                        Stock {r.stock} · {r.unit}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {[r.barcode, r.category].filter(Boolean).join(" · ") || "Sin código ni categoría"}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Contado {money(r.price_cash)} · Crédito {money(r.price_credit)}
                    </p>
                  </div>
                )}
              />
            </>
          ) : null}

          {parsed && parsed.valid.length === 0 && errors.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">El archivo no tiene filas.</p>
          ) : null}

          <Button
            onClick={confirm}
            loading={saving}
            disabled={!parsed || parsed.valid.length === 0 || errors.length > 0}
            fullWidth
          >
            Importar productos
          </Button>
        </div>
      </PageContainer>
    </>
  );
}
