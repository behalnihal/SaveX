"use client";

export default function LinePatternBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800" />
      <svg
        className="absolute inset-0 w-full h-full opacity-20 dark:opacity-10"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="linePattern"
            patternUnits="userSpaceOnUse"
            width="20"
            height="20"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="20"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-slate-300 dark:text-slate-600"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#linePattern)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/5 dark:to-black/5" />
    </div>
  );
}
