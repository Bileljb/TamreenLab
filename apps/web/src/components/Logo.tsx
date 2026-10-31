/** The TamreenLab mark: a 2×2 cell block with the active cell lit, and the wordmark. */
export function Logo({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2" dir="ltr">
      <svg viewBox="0 0 32 32" className="size-8 drop-shadow-sm" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#10b981" />
            <stop offset="0.5" stopColor="#14b8a6" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <rect x="7" y="7" width="8" height="8" rx="2" fill="white" fillOpacity="0.95" />
        <rect x="17" y="7" width="8" height="8" rx="2" fill="white" fillOpacity="0.45" />
        <rect x="7" y="17" width="8" height="8" rx="2" fill="white" fillOpacity="0.45" />
        <rect x="17" y="17" width="8" height="8" rx="2" fill="white" fillOpacity="0.45" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-ink">
        Tamreen<span className="text-gradient">Lab</span>
      </span>
      <span className="sr-only">{name}</span>
    </span>
  );
}
