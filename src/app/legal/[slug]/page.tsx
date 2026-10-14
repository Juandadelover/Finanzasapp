import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEGAL_DOCS, LEGAL_UPDATED, getLegalDoc } from "@/lib/legal";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  return doc ? { title: `${doc.title} · Finanzas`, description: doc.summary } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <article className="text-[15px] leading-7 text-[var(--color-text)]">
      <div
        role="note"
        className="mb-5 rounded-xl border border-[var(--color-warning)] bg-[var(--color-surface-2)] px-3 py-2 text-xs font-medium text-[var(--color-warning)]"
      >
        Borrador pendiente de revisión legal
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-xs text-[var(--color-text-faint)]">Última actualización: {LEGAL_UPDATED}</p>

      {doc.toc ? (
        <nav aria-label="Contenido" className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Contenido</p>
          <ol className="space-y-1 text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[var(--color-brand-light)] hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-8 scroll-mt-6">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {s.paragraphs?.map((p, i) => (
            <p key={i} className="mt-3 text-[var(--color-text-muted)]">
              {p}
            </p>
          ))}
          {s.items ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[var(--color-text-muted)]">
              {s.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}
