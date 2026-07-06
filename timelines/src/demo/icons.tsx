// Small stroke icons for the demo, in the spirit of the reference design.
const props = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const;

export const DocumentIcon = (
  <svg {...props}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
    <path d="M14 3v4h4M9.5 12h5M9.5 16h5" />
  </svg>
);

export const LoginIcon = (
  <svg {...props}>
    <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M4 12h11M11.5 8.5 15 12l-3.5 3.5" />
  </svg>
);

export const ShareIcon = (
  <svg {...props}>
    <path d="M13 5h6v6M19 5l-8.5 8.5M9 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
  </svg>
);

export const EditIcon = (
  <svg {...props}>
    <path d="M16.5 4.5 19.5 7.5 9 18l-4 1 1-4z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);

export const MegaphoneIcon = (
  <svg {...props}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l2 5h2l-2-5h1c3 0 6 1 8 2V7c-2 1-5 2-8 2H5a1 1 0 0 0-1 1z" />
  </svg>
);

export const PillIcon = (
  <svg {...props}>
    <rect x="3.5" y="9" width="17" height="6.5" rx="3.25" transform="rotate(-35 12 12.25)" />
    <path d="M9.5 8.2l4.5 6.5" />
  </svg>
);

export const CheckIcon = (
  <svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </svg>
);

export const NetworkIcon = (
  <svg {...props}>
    <circle cx="6.5" cy="12" r="2.2" />
    <circle cx="16.5" cy="6.5" r="2.2" />
    <circle cx="16.5" cy="17.5" r="2.2" />
    <path d="m8.6 11 5.8-3.4M8.6 13l5.8 3.4" />
  </svg>
);

export const LayersIcon = (
  <svg {...props}>
    <path d="m12 4 8 4.5-8 4.5-8-4.5z" />
    <path d="m4 13 8 4.5 8-4.5M4 17.5 12 22l8-4.5" />
  </svg>
);

export const ExportIcon = (
  <svg {...props}>
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M14 8l4 4-4 4M8.5 12H18" />
  </svg>
);
