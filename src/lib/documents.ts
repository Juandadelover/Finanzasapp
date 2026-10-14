import { toast } from "sonner";
import { toastDbError } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/client";

export type DocumentKind = "quote" | "collection";
export type DocumentStatus = "draft" | "issued" | "paid" | "void";

export interface DocumentItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CollectionDocument {
  id: string;
  workspaceId: string;
  kind: DocumentKind;
  number: number;
  contactId: string | null;
  contactName: string | null;
  issueDate: string;
  dueDate: string | null;
  status: DocumentStatus;
  notes: string;
  externalInvoiceNumber: string | null;
  total: number;
  transactionId: string | null;
}

export interface CollectionDocumentWithItems extends CollectionDocument {
  items: DocumentItem[];
}

export interface NewDocumentInput {
  workspaceId: string;
  kind: DocumentKind;
  contactId: string | null;
  issueDate: string;
  dueDate: string | null;
  notes: string;
  items: DocumentItem[];
}

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
  void: "Anulada",
};

export function formatDocNumber(n: number): string {
  return `N.º ${String(n).padStart(4, "0")}`;
}

export function computeTotal(items: DocumentItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

/** Número de WhatsApp para Colombia: solo dígitos, con prefijo 57. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("57") && digits.length === 12) return digits;
  return `57${digits}`;
}

interface DocRow {
  id: string;
  workspace_id: string;
  kind: DocumentKind;
  number: number;
  contact_id: string | null;
  issue_date: string;
  due_date: string | null;
  status: DocumentStatus;
  notes: string;
  external_invoice_number: string | null;
  total: number | string;
  transaction_id: string | null;
  contacts?: { name: string } | null;
}

function rowToDoc(r: DocRow): CollectionDocument {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    kind: r.kind,
    number: r.number,
    contactId: r.contact_id,
    contactName: r.contacts?.name ?? null,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    status: r.status,
    notes: r.notes ?? "",
    externalInvoiceNumber: r.external_invoice_number,
    total: Number(r.total),
    transactionId: r.transaction_id,
  };
}

export async function listDocuments(workspaceId: string): Promise<CollectionDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_documents")
    .select("*, contacts(name)")
    .eq("workspace_id", workspaceId)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false });
  if (error || !data) {
    console.error(error);
    toast.error("No se pudieron cargar los documentos.");
    return [];
  }
  return (data as unknown as DocRow[]).map(rowToDoc);
}

export async function getDocument(id: string): Promise<CollectionDocumentWithItems | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_documents")
    .select("*, contacts(name)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error(error);
    toast.error("No se pudo cargar el documento.");
    return null;
  }
  const { data: items, error: itemsError } = await supabase
    .from("collection_document_items")
    .select("id, description, quantity, unit_price, position")
    .eq("document_id", id)
    .order("position", { ascending: true });
  if (itemsError) {
    console.error(itemsError);
    toast.error("No se pudieron cargar los ítems del documento.");
    return null;
  }
  return {
    ...rowToDoc(data as unknown as DocRow),
    items: (items ?? []).map((i) => ({
      id: i.id as string,
      description: i.description as string,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })),
  };
}

export async function createDocument(input: NewDocumentInput): Promise<CollectionDocument | null> {
  const supabase = createClient();
  const total = computeTotal(input.items);
  const { data, error } = await supabase
    .from("collection_documents")
    .insert({
      workspace_id: input.workspaceId,
      kind: input.kind,
      number: 0,
      contact_id: input.contactId,
      issue_date: input.issueDate,
      due_date: input.kind === "collection" ? input.dueDate : null,
      status: "issued",
      notes: input.notes,
      total,
    })
    .select("*, contacts(name)")
    .single();
  if (error || !data) {
    console.error(error);
    toastDbError(error, "No se pudo crear el documento. Intenta de nuevo.");
    return null;
  }
  const doc = rowToDoc(data as unknown as DocRow);
  const { error: itemsError } = await supabase.from("collection_document_items").insert(
    input.items.map((it, idx) => ({
      document_id: doc.id,
      workspace_id: input.workspaceId,
      position: idx,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
    }))
  );
  if (itemsError) {
    console.error(itemsError);
    await supabase.from("collection_documents").delete().eq("id", doc.id);
    toast.error("No se pudieron guardar los ítems del documento.");
    return null;
  }
  return doc;
}

export async function updateDocumentStatus(id: string, status: DocumentStatus): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("collection_documents").update({ status }).eq("id", id);
  if (error) {
    console.error(error);
    toast.error("No se pudo actualizar el estado del documento.");
    return false;
  }
  return true;
}

export async function setDocumentTransaction(id: string, transactionId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("collection_documents")
    .update({ transaction_id: transactionId })
    .eq("id", id);
  if (error) {
    console.error(error);
    toast.error("No se pudo vincular el movimiento al documento.");
    return false;
  }
  return true;
}

/** Convierte una cotización en cuenta de cobro copiando sus ítems. */
export async function convertQuoteToCollection(
  quote: CollectionDocumentWithItems,
  issueDate: string,
  dueDate: string | null
): Promise<CollectionDocument | null> {
  if (quote.kind !== "quote") return null;
  return createDocument({
    workspaceId: quote.workspaceId,
    kind: "collection",
    contactId: quote.contactId,
    issueDate,
    dueDate,
    notes: quote.notes,
    items: quote.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
  });
}

export const STATUS_CHIP: Record<DocumentStatus, string> = {
  draft: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  issued: "bg-amber-500/15 text-amber-500",
  paid: "bg-emerald-500/15 text-emerald-500",
  void: "bg-red-500/15 text-red-500",
};
