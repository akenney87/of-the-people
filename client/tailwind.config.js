// File: tailwind.config.js
//
// Editorial / op-ed design system. Warm newsprint cream as the canvas,
// a single vermillion accent for live/urgent moments, deep navy for civic
// gravitas, blue-check reserved for verified officials.
//
// Type stack: Fraunces (display), Source Serif 4 (body), Instrument Sans
// (UI), JetBrains Mono (ledger data). All loaded in index.html.

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Newsprint surfaces
        paper:        "#F4ECE0",  // canvas
        "paper-warm": "#FBF6EE",  // raised card
        "paper-cool": "#E8DECF",  // slightly recessed
        ink:          "#1A1A14",  // body text (warm black)
        "ink-soft":   "#5C5247",  // metadata, captions
        "ink-faint":  "#A89D8C",  // ornamental
        rule:         "#1F1B12",  // hairline
        "rule-soft":  "#D6CDBF",  // background dividers

        // Accents — used sparingly
        vermillion:        "#C7372F",
        "vermillion-deep": "#9A2A24",
        "vermillion-soft": "#EAC8C2",
        navy:              "#1B2A4E",
        "navy-soft":       "#C9D0DD",
        verified:          "#1D7CC4",  // blue-check, reserved for officials
        gold:              "#A88438",  // rare, decorative only

        // Yes/No retain civic semantics but recolored to the palette
        yes:        "#2F6B3A",
        "yes-soft": "#C6D8C9",
        no:         "#9A2A24",
        "no-soft":  "#E5C2B5",
      },

      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        body:    ['"Source Serif 4"', '"Iowan Old Style"', 'Georgia', 'serif'],
        ui:      ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"SF Mono"', 'Consolas', 'monospace'],
      },

      fontSize: {
        // Editorial type scale — a bit more dramatic than Tailwind defaults
        eyebrow: ['0.6875rem', { lineHeight: '1.1', letterSpacing: '0.16em' }],
        caption: ['0.8125rem', { lineHeight: '1.35' }],
        body:    ['1.0625rem', { lineHeight: '1.55' }],
        lede:    ['1.25rem',   { lineHeight: '1.45' }],
        h4:      ['1.5rem',    { lineHeight: '1.2' }],
        h3:      ['2rem',      { lineHeight: '1.1' }],
        h2:      ['2.75rem',   { lineHeight: '1.05' }],
        h1:      ['3.75rem',   { lineHeight: '1.0' }],
        hero:    ['5rem',      { lineHeight: '0.95' }],
      },

      letterSpacing: {
        eyebrow: '0.16em',
        wider2:  '0.08em',
      },

      borderRadius: {
        none: '0',
        sm:   '2px',
        DEFAULT: '3px',
        md:   '4px',
        lg:   '6px',
      },

      maxWidth: {
        column: '38rem',     // long-form text column
        spread: '72rem',     // broadsheet content width
      },

      boxShadow: {
        // No drop shadows — we use rules and borders instead
        rule: 'inset 0 -1px 0 0 #D6CDBF',
        'rule-strong': 'inset 0 -1px 0 0 #1F1B12',
      },

      animation: {
        'rise-in': 'rise-in 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'rise-slow': 'rise-in 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'stamp':   'stamp 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'ink-fade': 'ink-fade 700ms ease-out both',
      },
      keyframes: {
        'rise-in': {
          '0%':   { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'stamp': {
          '0%':   { transform: 'scale(1) rotate(0)' },
          '40%':  { transform: 'scale(0.94) rotate(-1.2deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
        'ink-fade': {
          '0%':   { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
  corePlugins: { preflight: true },
};
