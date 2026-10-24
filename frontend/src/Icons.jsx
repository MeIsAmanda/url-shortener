export default function Icon({ name, ...props }) {
  const paths = {
    link: <><path d="m10 14 4-4" /><path d="m8 15-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)" /></>,
    scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="m8.5 7.5 12 13m-12-4 12-13M13 12l1-1" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>,
    sparkles: <><path d="m10 2 2.5 6.5L19 11l-6.5 2.5L10 20l-2.5-6.5L1 11l6.5-2.5L10 2Z" /><path d="m20 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" /></>,
    flower: <><path d="M12 7c-7-12-13 1-5 5-12 7 1 13 5 5 7 12 13-1 5-5 12-7-1-13-5-5Z" /><circle cx="12" cy="12" r="2" /></>,
    heart: <path d="M20 4c-3-2-6 0-8 3-2-3-5-5-8-3-7 5 2 13 8 17 6-4 15-12 8-17Z" />,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14q4 5 8 0m-8-5h.1m7.9 0h.1" /></>,
    'paper-plane': <><path d="m3 10 18-7-7 18-4-7-7-4Z" /><path d="m10 14 6-6" /></>,
    cloud: <path d="M7 19a5 5 0 1 1 0-10 6 6 0 0 1 12-1 5.5 5.5 0 0 1-1 11H7Z" />,
    close: <path d="m7 7 10 10M7 17 17 7" />,
    chevron: <path d="m7 10 5 5 5-5" />,
    history: <><path d="M3 11a9 9 0 1 1 2.5 7M3 5v6h6" /><path d="M12 7v5l3 2" /></>,
    click: <><path d="m7 3 12 9-6 1-3 6L7 3Z" /><path d="m4 4-2-2m11 0v3m-10 7h3" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
