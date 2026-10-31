/** One icon and colour per learning track. Unknown tracks get the grid icon. */
const TRACKS: Record<string, { path: string; tone: string }> = {
  basics: { path: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16', tone: 'from-emerald-400 to-teal-500' },
  aggregation: { path: 'M17 5H7l6 7-6 7h10', tone: 'from-sky-400 to-indigo-500' },
  logic: { path: 'M6 3v6a6 6 0 0 0 6 6h6M18 15l-3-3m3 3-3 3M6 21v-6', tone: 'from-violet-400 to-fuchsia-500' },
  conditional: { path: 'M4 5h16l-6 8v5l-4 2v-7z', tone: 'from-amber-400 to-orange-500' },
  lookup: { path: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM21 21l-5-5', tone: 'from-rose-400 to-pink-500' },
  review: { path: 'm12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z', tone: 'from-lime-400 to-emerald-500' },
};

export function TrackIcon({ track, size = 'md' }: { track: string; size?: 'md' | 'lg' }) {
  const { path, tone } = TRACKS[track] ?? TRACKS.basics!;
  const box = size === 'lg' ? 'size-14 rounded-2xl' : 'size-12 rounded-xl';
  return (
    <span className={`grid shrink-0 place-items-center bg-linear-to-br ${tone} ${box} text-white shadow-soft`} aria-hidden>
      <svg viewBox="0 0 24 24" className={size === 'lg' ? 'size-7' : 'size-6'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}
