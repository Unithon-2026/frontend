/**
 * 인라인 SVG 아이콘.
 *
 * 아이콘 라이브러리를 넣지 않은 이유는 번들 크기와 CSP 때문입니다. 크기·색은
 * 전부 CSS(`stroke: currentColor`)가 정하므로 여기서는 경로만 그립니다.
 */

type Props = { className?: string };

const box = (children: React.ReactNode, className?: string) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const IconLayers = ({ className }: Props) =>
  box(
    <>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 12l9 4 9-4" />
      <path d="M3 17l9 4 9-4" />
    </>,
    className,
  );

export const IconSearch = ({ className }: Props) =>
  box(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </>,
    className,
  );

export const IconBookmark = ({ className }: Props) =>
  box(<path d="M6 3h12a1 1 0 011 1v16l-7-4-7 4V4a1 1 0 011-1z" />, className);

export const IconChat = ({ className }: Props) =>
  box(
    <>
      <path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z" />
      <path d="M9 11h6M9 14h4" />
    </>,
    className,
  );

export const IconUsers = ({ className }: Props) =>
  box(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-3 2-5 5-5s5 2 5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 20c0-2.4 1.4-4 3.5-4" />
    </>,
    className,
  );

export const IconDatabase = ({ className }: Props) =>
  box(
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>,
    className,
  );

export const IconPin = ({ className }: Props) =>
  box(
    <>
      <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>,
    className,
  );

export const IconPinOff = ({ className }: Props) =>
  box(
    <>
      <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" />
      <path d="M4 4l16 16" />
    </>,
    className,
  );

export const IconFilterLines = ({ className }: Props) =>
  box(<path d="M4 7h16M4 12h16M4 17h10" />, className);

export const IconList = ({ className }: Props) =>
  box(<path d="M4 6h16M4 12h16M4 18h16" />, className);

export const IconSplit = ({ className }: Props) =>
  box(
    <>
      <rect x="3" y="4" width="8" height="16" rx="1" />
      <path d="M14 8h7M14 12h7M14 16h7" />
    </>,
    className,
  );

export const IconClock = ({ className }: Props) =>
  box(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    className,
  );

export const IconCheck = ({ className }: Props) =>
  box(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>,
    className,
  );

export const IconWarn = ({ className }: Props) =>
  box(
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9l-7.4 12.8A2 2 0 004.6 20h14.8a2 2 0 001.7-3.3L13.7 3.9a2 2 0 00-3.4 0z" />
    </>,
    className,
  );

export const IconSpark = ({ className }: Props) =>
  box(
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </>,
    className,
  );

export const IconRefresh = ({ className }: Props) =>
  box(
    <>
      <path d="M20 12a8 8 0 11-2.3-5.7" />
      <path d="M20 4v4h-4" />
    </>,
    className,
  );
