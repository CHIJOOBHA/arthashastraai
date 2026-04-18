import fs from 'fs';

let files = ['src/index.css', 'src/App.tsx'];

files.forEach(path => {
  let content = fs.readFileSync(path, 'utf-8');
  content = content.replace(/rgba\(0,\s*230,\s*118/g, 'rgba(0,230,118'); // strip spaces
  fs.writeFileSync(path, content);
});

console.log('Hex space replacements complete');
