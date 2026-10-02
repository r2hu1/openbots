export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`size-4 animate-spin ${className}`}
      viewBox="0 0 50 50"
      role="status"
      aria-label="Loading"
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="origin-center animate-[material-dash_1.5s_ease-in-out_infinite]"
        strokeDasharray="90 150"
        strokeDashoffset="0"
      />
    </svg>
  );
}
