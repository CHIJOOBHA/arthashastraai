import fs from 'fs';

const cssPath = 'src/index.css';
let css = fs.readFileSync(cssPath, 'utf-8');
css = css.replace(/rgba\(0,\s*240,\s*255/g, 'rgba(0, 230, 118');
fs.writeFileSync(cssPath, css);

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf-8');
app = app.replace(/rgba\(0,\s*240,\s*255/g, 'rgba(0, 230, 118'); // map cyan to emerald
app = app.replace(/caps-modern/g, 'caps-modern'); // dummy
app = app.replace(
  /h1 className="text-34 caps-modern/g,
  'h1 className="text-34 caps-modern font-bold'
);
app = app.replace(
  /caps-modern leading-relaxed italic/g,
  'font-sans leading-relaxed tracking-wide opacity-80'
);
app = app.replace(
  /caps-modern text-neon-cyan mb-21/g,
  'caps-modern font-bold text-neon-cyan mb-21'
);
app = app.replace(
  /"Absolute truth is the most dangerous artifact in history. Access is restricted to designated Witnesses."/g,
  'Absolute truth is the most dangerous artifact in history. Access is restricted to designated Witnesses.'
);

fs.writeFileSync(appPath, app);
console.log('Replacements complete');
