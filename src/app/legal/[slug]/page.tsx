import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

  const index = LEGAL_DOCS.findIndex((d) => d.slug === doc.slug);
  const prev = index > 0 ? LEGAL_DOCS[index - 1] : null;
  const next = index < LEGAL_DOCS.length - 1 ? LEGAL_DOCS[index + 1] : null;

  return (
    <article className="text-base leading-7 text-[var(--color-text)]">
      <nav aria-label="Documentos legales" className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1">
        {LEGAL_DOCS.map((d) => (
          <Link
            key={d.slug}
            href={`/legal/${d.slug}`}
            aria-current={d.slug === doc.slug ? "page" : undefined}
            className={
              d.slug === doc.slug
                ? "inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--color-brand)] bg-[var(--color-brand)]/15 px-4 text-sm font-medium text-[var(--color-brand-light)]"
                : "inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            }
          >
            {d.title}
          </Link>
        ))}
      </nav>
      <div
        role="note"
        className="mb-5 rounded-xl border border-[var(--color-warning)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-warning)]"
      >
        Borrador pendiente de revisión legal
      </div>
      <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">Última actualización: {LEGAL_UPDATED}</p>

      {doc.toc ? (
        <nav aria-label="Contenido" className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-sm font-semibold">Contenido</p>
          <ol className="text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center text-[var(--color-brand-light)] hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-8 scroll-mt-6">
          <h2 className="text-xl font-semibold leading-snug">{s.heading}</h2>
          {s.paragraphs?.map((p, i) => (
            <p key={i} className="mt-3">
              {p}
            </p>
          ))}
          {s.items ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-[var(--color-text-muted)]">
              {s.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <nav aria-label="Otros documentos" className="mt-12 flex flex-col gap-3 border-t border-[var(--color-border)] pt-6 sm:flex-row sm:justify-between">
        {prev ? (
          <Link href={`/legal/${prev.slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-brand-light)] hover:underline">
            <ArrowLeft size={16} aria-hidden /> {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/legal/${next.slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-brand-light)] hover:underline sm:ml-auto">
            {next.title} <ArrowRight size={16} aria-hidden />
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
