import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  
  try {
    const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log('STATUS:', response.status());
  } catch (err) {
    console.error('GOTO ERROR:', err.message);
  }
  
  await browser.close();
})();
