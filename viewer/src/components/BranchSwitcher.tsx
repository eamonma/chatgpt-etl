export function BranchSwitcher({
  activeIndex,
  totalChildren,
  onSwitch,
}: {
  activeIndex: number;
  totalChildren: number;
  onSwitch: (newIndex: number) => void;
}) {
  if (totalChildren <= 1) return null;

  return (
    <div className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 select-none">
      <button
        onClick={() => onSwitch(activeIndex - 1)}
        disabled={activeIndex === 0}
        className="p-0.5 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Previous branch"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="tabular-nums">{activeIndex + 1}/{totalChildren}</span>
      <button
        onClick={() => onSwitch(activeIndex + 1)}
        disabled={activeIndex === totalChildren - 1}
        className="p-0.5 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Next branch"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
