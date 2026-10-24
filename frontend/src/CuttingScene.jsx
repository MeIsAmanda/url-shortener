import { memo } from 'react';

function CuttingScene({ active }) {
  return (
    <svg
      className={`cutting-scene${active ? ' is-snipping' : ''}`}
      data-testid="cutting-scene"
      viewBox="0 0 680 410"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="#304057" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path className="scene-edge-decoration" d="M92 180c-12-2-17-16-10-24 4-5 11-7 17-3 1-11 14-16 23-9 6 4 7 11 5 17 15-3 24 16 12 24H93" fill="#eaf4fc" />
        <path className="scene-edge-decoration" d="m548 197 5-15 7 14 16 1-12 10 4 16-14-8-14 8 3-16-12-10 17-1Z" fill="#ffe28a" />
        <path className="scene-heart" d="M155 244c-22-12-28-23-20-31 5-6 14-4 19 3 5-8 14-10 20-4 10 10-2 24-19 32Z" fill="#f7b8cd" />
        <g className="scene-confetti" transform="translate(0 110)">
          <path d="m575 63 4 9m15 2-9 4m-2-25-4 7" stroke="#8ca3c1" />
          <path d="m105 81 4 9m-14 5 9-1m6-23 5 6" stroke="#8ca3c1" />
          <path d="m219 26 4-10 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#ffe28a" stroke="#b48b35" strokeWidth="1.5" />
        </g>
        <circle cx="478" cy="250" r="5" fill="#c5d8fb" stroke="none" />
        <circle cx="194" cy="172" r="3.5" fill="#f2b8cb" stroke="none" />

        <ellipse cx="340" cy="395" rx="43" ry="5" fill="#d6e5eb" stroke="none" />
        <g className="cutter">
        <g className="little-helper">
          <path d="m331 256-5 28-15 25 9 5 21-27 6-26" fill="#304057" />
          <path d="m346 257 9 28 1 27 11-1 3-30-10-27" fill="#304057" />
          <path d="m311 307-8 7c-3 3-1 6 2 6h16l2-8" fill="#fffef9" />
          <path d="m356 309-1 10h20c3 0 4-3 1-5l-10-5" fill="#fffef9" />
          <path d="m325 224-16-10-5-40-10 1 2 46 28 21m31-18 17-12 3-39 10 1-1 46-28 23" fill="#a9d5ee" />
          <path d="M325 220c9-6 20-6 30 0l8 41c-15 5-30 5-44 0l6-41Z" fill="#a9d5ee" />
          <path d="m332 218 8 10 8-10" fill="#fffef9" />
          <path d="M334 207v12c3 4 9 4 12 0v-12" fill="#f6c7a7" />
          <path d="M326 193c0-12 26-12 26 0v8c0 9-6 14-13 14s-13-7-13-14v-8Z" fill="#f6c7a7" />
          <path d="M325 197c-6-13 2-23 13-21 8-6 19 2 17 11-5 2-10 0-13-5-3 7-10 10-17 8v7Z" fill="#304057" />
          <path d="M333 199h.1m12 0h.1" strokeWidth="3" />
          <path d="M336 205q4 4 8 0" strokeWidth="1.5" />
          <ellipse cx="329" cy="203" rx="3" ry="1.8" fill="#ec9c9d" stroke="none" />
          <ellipse cx="348" cy="203" rx="3" ry="1.8" fill="#ec9c9d" stroke="none" />
          <path d="m295 175-2-10c-1-5 5-7 7-2l3 10m72 1 3-11c1-4 7-3 6 2l-1 10" fill="#f6c7a7" />
        </g>

        <g className="scissor-blade scissor-blade--left">
          <path d="M341 107 298 10c-1-3 1-5 3-2l56 91-16 8Z" fill="#c9d4dc" />
          <path d="m301 16 41 85" stroke="#fffef9" strokeWidth="2" />
          <path d="m342 105 23 35" strokeWidth="8" />
          <ellipse cx="371" cy="153" rx="17" ry="21" fill="#fffef9" strokeWidth="8" transform="rotate(-31 371 153)" />
          <path d="m365 143 5-3" stroke="#8ca3b9" strokeWidth="2" />
        </g>
        <g className="scissor-blade scissor-blade--right">
          <path d="M339 107 382 10c1-3-1-5-3-2l-56 91 16 8Z" fill="#e6edf0" />
          <path d="m379 16-41 85" stroke="#fffef9" strokeWidth="2" />
          <path d="m338 105-23 35" strokeWidth="8" />
          <ellipse cx="309" cy="153" rx="17" ry="21" fill="#fffef9" strokeWidth="8" transform="rotate(31 309 153)" />
          <path d="m303 143 5-3" stroke="#8ca3b9" strokeWidth="2" />
        </g>
        <circle cx="340" cy="102" r="6" fill="#ffe28a" strokeWidth="2" />
        <circle cx="340" cy="102" r="1.5" fill="#304057" stroke="none" />

        <g className="snip-sparks" stroke="#c78b27" strokeWidth="2.5">
          <path d="m288 171-10-6m114 6 10-6" />
          <path d="m287 193-10 4m116-4 10 4" />
        </g>
        </g>
      </g>
    </svg>
  );
}

// Typing and clipboard updates do not need to redraw the decorative scene.
export default memo(CuttingScene);
