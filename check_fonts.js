import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');
// To make it look "more sci-fi", apply `.font-display` to headings maybe?
// Actually if I change `--font-sans` to `"Outfit"`, all body text immediately becomes the sci-fi look 'Outfit'.
// `caps-modern` already uses `--font-display` ("Space Grotesk").
// Let's ensure headers or other big elements explicitly use `font-display`.

const matches = content.match(/<h[1-6][^>]*>/g);
console.log(matches ? matches.slice(0, 10).join('\\n') : "No h1-h6 tags");
