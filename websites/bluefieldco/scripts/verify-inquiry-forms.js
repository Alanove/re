const data = require('../data/pages.json');
for (const [key, page] of Object.entries(data.pages)) {
  if (!page.content || !page.content.includes('submit_your_inquiry')) continue;
  const bad =
    page.content.includes('="disabled"') ||
    page.content.includes('<p class="<form') ||
    !page.content.includes('name="fname"');
  console.log(key, bad ? 'BAD' : 'ok');
}
