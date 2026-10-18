import fs from 'node:fs';
const source=fs.readFileSync('public/branding/cisalfa-logo-source.png');
const w=source.readUInt32BE(16),h=source.readUInt32BE(20);
// Display the supplied wordmark through a tight SVG viewport. Source pixels are unchanged.
const view=[48/555*w,94/293*h,456/555*w,108/293*h].join(' ');
fs.writeFileSync('public/branding/cisalfa-wordmark.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="456" height="108" viewBox="${view}"><image width="${w}" height="${h}" href="data:image/png;base64,${source.toString('base64')}"/></svg>`);
