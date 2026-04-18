import fs from 'fs';

let files = ['src/index.css', 'src/App.tsx'];

files.forEach(path => {
  let content = fs.readFileSync(path, 'utf-8');
  content = content.replace(/#00F0FF/gi, '#00E676'); // cyan -> emerald green
  content = content.replace(/#FF00FF/gi, '#FFB300'); // magenta -> gold
  fs.writeFileSync(path, content);
});

console.log('Hex replacements complete');
