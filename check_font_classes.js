import fs from 'fs';
const app = fs.readFileSync('src/App.tsx', 'utf8');
const fontMatches = app.match(/font-[a-z-]+/g);
const uniqueFonts = [...new Set(fontMatches)];
console.log('Fonts in App.tsx:', uniqueFonts);
