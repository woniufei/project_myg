/**
 * Compact 14x14 SVG icon set used by the sidebars. Inline SVG keeps the
 * bundle small and lets us style strokes via currentColor.
 */

const baseProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": true
};

export function MyWorkIcon() {
  return (
    <svg {...baseProps}>
      <path
        d="M3 4.5L7 7L3 9.5M9 9.5H13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProjectsIcon() {
  return (
    <svg {...baseProps}>
      <rect x="2.5" y="3" width="11" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="7.5" width="11" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="12" width="11" height="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function WorkPackagesIcon() {
  return (
    <svg {...baseProps}>
      <path
        d="M2.5 4.5L8 2L13.5 4.5M2.5 4.5V11.5L8 14M2.5 4.5L8 7M13.5 4.5V11.5L8 14M13.5 4.5L8 7M8 7V14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotificationsIcon() {
  return (
    <svg {...baseProps}>
      <path
        d="M3.5 11C3.5 10 4 9 4 7.5C4 5.29086 5.79086 3.5 8 3.5C10.2091 3.5 12 5.29086 12 7.5C12 9 12.5 10 12.5 11H3.5ZM6.5 12.5H9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 2V3.5M8 12.5V14M14 8H12.5M3.5 8H2M12.24 3.76L11.18 4.82M4.82 11.18L3.76 12.24M12.24 12.24L11.18 11.18M4.82 4.82L3.76 3.76"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LaunchIcon() {
  return (
    <svg {...baseProps}>
      <path d="M8 2.5L12.5 13.5L8 11.5L3.5 13.5L8 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6.8 9H9.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function OverviewIcon() {
  return (
    <svg {...baseProps}>
      <rect x="2.5" y="2.5" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2.5" y="10" width="5" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2.5" width="4.5" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="7.5" width="4.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function BoardsIcon() {
  return (
    <svg {...baseProps}>
      <rect x="2.5" y="3" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6.75" y="3" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.5" y="3" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function GanttIcon() {
  return (
    <svg {...baseProps}>
      <rect x="2.5" y="3.5" width="6" height="2" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
      <rect x="5.5" y="7" width="6" height="2" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
      <rect x="3.5" y="10.5" width="7" height="2" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function TeamIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 12.5C2.5 10.8431 3.84315 9.5 5.5 9.5C7.15685 9.5 8.5 10.8431 8.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 12.5C7.5 10.8431 8.84315 9.5 10.5 9.5C12.1569 9.5 13.5 10.8431 13.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 9.5H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function MembersIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 13C2.5 11.067 4.067 9.5 6 9.5C7.933 9.5 9.5 11.067 9.5 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.5 13C9.5 11.067 11.067 9.5 13 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function AIDiagnosisIcon() {
  return (
    <svg {...baseProps}>
      <path d="M8 2L9.2 5.5L13 6L10 8.5L11 12.5L8 10.5L5 12.5L6 8.5L3 6L6.8 5.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function AIBreakdownIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="8" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="3.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 4.5L4.5 9.5M9 4.5L11.5 9.5M5 11H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M12.6 8C12.6 8.4 12.55 8.8 12.45 9.2L13.7 10.2C13.85 10.3 13.9 10.5 13.8 10.7L12.6 12.7C12.5 12.85 12.3 12.95 12.1 12.85L10.55 12.25C10.2 12.5 9.8 12.7 9.4 12.85L9.2 14.5C9.15 14.7 9 14.85 8.8 14.85H7.2C7 14.85 6.85 14.7 6.8 14.5L6.6 12.85C6.2 12.7 5.8 12.5 5.45 12.25L3.9 12.85C3.7 12.95 3.5 12.85 3.4 12.7L2.2 10.7C2.1 10.5 2.15 10.3 2.3 10.2L3.55 9.2C3.45 8.8 3.4 8.4 3.4 8C3.4 7.6 3.45 7.2 3.55 6.8L2.3 5.8C2.15 5.7 2.1 5.5 2.2 5.3L3.4 3.3C3.5 3.15 3.7 3.05 3.9 3.15L5.45 3.75C5.8 3.5 6.2 3.3 6.6 3.15L6.8 1.5C6.85 1.3 7 1.15 7.2 1.15H8.8C9 1.15 9.15 1.3 9.2 1.5L9.4 3.15C9.8 3.3 10.2 3.5 10.55 3.75L12.1 3.15C12.3 3.05 12.5 3.15 12.6 3.3L13.8 5.3C13.9 5.5 13.85 5.7 13.7 5.8L12.45 6.8C12.55 7.2 12.6 7.6 12.6 8Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
