import type { SVGProps } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

type P = SVGProps<SVGSVGElement>;

export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const IconEdit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const IconUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
export const IconDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconPlan = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 4h18v16H3z" />
    <path d="M3 11h8V4M11 15v5M15 11h6M15 11V4" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v7h14v-7" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
