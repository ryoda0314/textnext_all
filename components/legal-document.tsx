/** Renders the plain-text legal documents: "第N条（…）" lines become headings. */
export function LegalDocument({ text }: { text: string }) {
  const [title, ...lines] = text.split("\n");
  return (
    <article className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 space-y-3 text-[15px] leading-relaxed">
        {lines.map((line, i) => {
          if (!line.trim()) return null;
          if (/^第\d+条/.test(line)) {
            return (
              <h2 key={i} className="pt-4 text-base font-bold">
                {line}
              </h2>
            );
          }
          return (
            <p key={i} className="text-muted">
              {line}
            </p>
          );
        })}
      </div>
    </article>
  );
}
