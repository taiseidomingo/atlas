/** Small stroke icon set (24×24, currentColor), so the UI needs no icon font. */

const PATHS = {
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  send: "M4 12 20 4l-6 16-2.5-6.5L4 12Z M11.5 13.5 20 4",
  chat: "M5 18.5V6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4a2.8 2.8 0 0 1-2.8 2.8H9.2L5 18.5Z M9 9h6 M9 12h4",
  sparkle: "M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9 12 3.5Z M18.5 16.5l.7 2 .2.1-.2.1-.7 2",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M8 17h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16",
  swap: "M7 4v16 M3.5 7.5 7 4l3.5 3.5 M17 20V4 M13.5 16.5 17 20l3.5-3.5",
  x: "M6 6l12 12 M18 6 6 18",
  building: "M4 20h16 M6 20V6.5L12 4l6 2.5V20 M9.5 9h1 M13.5 9h1 M9.5 12.5h1 M13.5 12.5h1 M11 20v-3.5h2V20",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4",
  locate: "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 2v4 M12 18v4 M2 12h4 M18 12h4 M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  arrowLeft: "M19 12H5 M11 6l-6 6 6 6",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  refresh: "M20 11a8 8 0 0 0-14.3-4.9L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.3 4.9L20 16 M20 20v-4h-4",
  chevronUp: "M6 15l6-6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20a7.5 7.5 0 0 1 15 0",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2",
  walk: "M13 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M9 21l2.5-6.5 M14 21l-1.5-5-2-2 1-4.5 M7 12l2-3.5 3-.5 2.5 3 2.5 1",
  check: "M5 12.5 10 17.5 19.5 7",
  map: "M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z M9 4v14 M15 6v14",
  layers: "M12 4 3 8.5l9 4.5 9-4.5L12 4Z M3 12.5l9 4.5 9-4.5 M3 16.5l9 4.5 9-4.5",
  flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
  home: "M4 11 12 4l8 7 M6 9.5V20h12V9.5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8h.01",
  dots: "M5 12h.01 M12 12h.01 M19 12h.01",
  expand: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  shrink: "M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
