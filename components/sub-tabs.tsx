"use client";

export function SubTabs<T extends string>({
  label,
  items,
  value,
  onChange
}: {
  label: string;
  items: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 md:w-auto"
    >
      {items.map((item) => {
        const active = value === item.id;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-meta font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:flex-none ${
              active ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
