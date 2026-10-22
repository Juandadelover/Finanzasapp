"use client";

import { useRef, useState } from "react";
import { Download, FileUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFinance } from "@/context/FinanceContext";
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
  const currency = currentWorkspace?.currency ?? "COP";

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
        toast.success(`Importaste ${res.created} productos.`);
        setParsed(null);
        setFileName("");
      } else {
        setServerErrors(res.errors);
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
                {parsed.valid.length} productos listos para importar.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Unidad</th>
                      <th className="px-3 py-2 text-right">Contado</th>
                      <th className="px-3 py-2 text-right">Crédito</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.valid.map((r, i) => (
                      <tr key={i} className="border-t border-[var(--color-border)]">
                        <td className="px-3 py-2">{r.barcode ?? ""}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.category ?? ""}</td>
                        <td className="px-3 py-2">{r.unit}</td>
                        <td className="px-3 py-2 text-right">{formatAmount(r.price_cash, currency)}</td>
                        <td className="px-3 py-2 text-right">{formatAmount(r.price_credit, currency)}</td>
                        <td className="px-3 py-2 text-right">{r.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
