// Colour system.
//
// Saturated but never neon: high contrast reads well on a cheap tablet screen
// held at arm's length, while the slightly warm whites keep it from feeling
// clinical. Each ramp carries its own shadow tone so shading stays in family
// instead of going grey.

export const C = {
  // core toy palette
  red: '#ff5d5d', redDark: '#d63b48',
  coral: '#ff7a59', coralDark: '#e0563a',
  orange: '#ffa130', orangeDark: '#e07b1c',
  yellow: '#ffd93d', yellowDark: '#e8b41f',
  lime: '#a8e05f', limeDark: '#7cbb3c',
  green: '#4fc47a', greenDark: '#2f9e5c',
  teal: '#3ecfcf', tealDark: '#22a5aa',
  sky: '#57c7ff', skyDark: '#2d9ede',
  blue: '#5b8dff', blueDark: '#3c62d6',
  indigo: '#8b7dff', indigoDark: '#6155d6',
  purple: '#c17bff', purpleDark: '#9552dd',
  pink: '#ff87c4', pinkDark: '#e05aa0',
  magenta: '#ff6bb0', magentaDark: '#d94289',
  brown: '#b5794f', brownDark: '#8d5836',
  cream: '#fff3d6', creamDark: '#f0dcae',
  white: '#ffffff', offWhite: '#fff8e7',
  ink: '#3b2f4a', inkSoft: '#6b5b7a',
};

// Confetti / sparkle sets, pre-mixed so bursts always look deliberate.
export const CONFETTI = [C.red, C.orange, C.yellow, C.lime, C.teal, C.sky, C.indigo, C.pink, C.magenta, C.purple];
export const WARM = [C.red, C.coral, C.orange, C.yellow, C.pink];
export const COOL = [C.teal, C.sky, C.blue, C.indigo, C.purple];
export const SPARKS = ['#fff9e0', C.yellow, '#ffffff', C.cream];

// The six activities. Order here is the order on the map.
export const TOYS = [
  { id: 'balloons', hue: C.red, label: 'בלונים' },
  { id: 'animals', hue: C.lime, label: 'חיות' },
  { id: 'music', hue: C.indigo, label: 'מוזיקה' },
  { id: 'shapes', hue: C.orange, label: 'צורות' },
  { id: 'paint', hue: C.magenta, label: 'ציור' },
  { id: 'ocean', hue: C.sky, label: 'ים' },
];

// Sky gradients per scene, top to bottom.
export const SKIES = {
  hub: ['#8fdcff', '#c9f2ff', '#fff3d6'],
  balloons: ['#6ec6ff', '#a8e4ff', '#e8f8ff'],
  animals: ['#9fe0ff', '#d8f4c8', '#f4ffd9'],
  music: ['#6a5acd', '#9b7fe0', '#e5d6ff'],
  shapes: ['#ffd08a', '#ffe9b8', '#fff6e0'],
  paint: ['#fff0f6', '#ffe3f0', '#ffeaf5'],
  ocean: ['#1b7fb8', '#39a8d8', '#8fe0f0'],
};
