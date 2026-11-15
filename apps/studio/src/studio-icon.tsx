const shapes = {
  activity: <path d="M2 12h5l3-7 4 14 3-7h5" />,
  tag: (
    <>
      <path d="M3.5 4h7l9.6 9.6a1.8 1.8 0 0 1 0 2.5l-4.5 4.5a1.8 1.8 0 0 1-2.5 0L3.5 11Z" />
      <circle cx="7.7" cy="8.2" r="1" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  dark: <path d="M20.7 15A8.9 8.9 0 0 1 9 3.3a9 9 0 1 0 11.7 11.7Z" />,
};

export function StudioIcon({
  name,
  className = '',
}: {
  name: keyof typeof shapes;
  className?: string;
}) {
  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}
