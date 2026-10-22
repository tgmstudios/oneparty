// Fixed, hand-drawn SVG markup. Only ever rendered with v-html from this constant table, never from guest data.
export const ICONS = {
  mask: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 7c4-2 8-3 12-3s8 1 12 3c0 10-3 18-12 21C7 25 4 17 4 7z"/><path d="M8.5 13c2-1.8 4.5-1.8 6.5 0M17 13c2-1.8 4.5-1.8 6.5 0"/><path d="M11 20c3 2.2 7 2.2 10 0"/></svg>',
  ballot: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 17h22v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M11 17v-1.5M21 17v-1.5M12 22h8"/><path d="M10 14V5h12v9"/><path d="M13 9.5l2 2 4-4.5"/></svg>',
  trophy: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 4h12v8a6 6 0 0 1-12 0z"/><path d="M10 7H5c0 5 2 7 5 7.5M22 7h5c0 5-2 7-5 7.5"/><path d="M16 18v5M10 28h12M12 23h8v5h-8z"/></svg>',
  music: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 23V8l14-3v15"/><circle cx="8.5" cy="23.5" r="3.5"/><circle cx="22.5" cy="20.5" r="3.5"/></svg>',
  potion: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 4h6M14 4v8L7.5 24a3.2 3.2 0 0 0 2.8 4.5h11.4a3.2 3.2 0 0 0 2.8-4.5L18 12V4"/><path d="M10 20c3 2 9-2 12 0"/><circle cx="14" cy="24" r="1"/><circle cx="19" cy="22.5" r=".8"/></svg>',
  skull: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4c-6 0-10 4-10 10 0 3 1 5 3 7v5h4v-3h6v3h4v-5c2-2 3-4 3-7 0-6-4-10-10-10z"/><circle cx="12" cy="15" r="2.2"/><circle cx="20" cy="15" r="2.2"/><path d="M16 18l-1.2 3h2.4z"/></svg>',
  pumpkin: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 9c-7 0-12 4-12 9s5 9 12 9 12-4 12-9-5-9-12-9z"/><path d="M16 9c-3 0-5 4-5 9s2 9 5 9 5-4 5-9-2-9-5-9z"/><path d="M16 9c0-3 1-5 4-6"/><path d="M10 15l3 2.5-3 1zM22 15l-3 2.5 3 1z"/><path d="M11 22c3 2 7 2 10 0"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19l-1.2-11 6 4.8L12 4l4.2 8.8 6-4.8L21 19z"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v11.5"/><circle cx="6.5" cy="18" r="2.8"/><circle cx="16.5" cy="15.5" r="2.8"/></svg>',
  candle: '<svg viewBox="0 0 52 96" aria-hidden="true"><circle class="halo" cx="26" cy="26" r="26" fill="rgba(255,150,40,.28)"/><rect class="wax" x="16" y="42" width="20" height="50" rx="4"/><path d="M26 44v-5" stroke="#1b1020" stroke-width="2" stroke-linecap="round"/><g class="flame"><path d="M26 38c-8-6-8-15 0-28 8 13 8 22 0 28z" fill="#ffa43a"/><path d="M26 37c-4-3-4-8 0-14 4 6 4 11 0 14z" fill="#fff3d6"/></g></svg>',
};
