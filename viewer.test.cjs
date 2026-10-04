const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'embedded application script exists');

class Element {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.textContent = '';
    this.value = '';
    this.listeners = {};
    this.style = {};
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, enabled) => enabled === undefined
        ? (this.classes.has(name) ? this.classes.delete(name) : this.classes.add(name))
        : (enabled ? this.classes.add(name) : this.classes.delete(name)),
      contains: name => this.classes.has(name),
    };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  scrollIntoView() { this.scrolled = (this.scrolled || 0) + 1; }
}

const ids = new Map();
const document = {
  getElementById(id) {
    if (!ids.has(id)) ids.set(id, new Element());
    return ids.get(id);
  },
  createElement(tag) { return new Element(tag); },
};
const objectUrls = [];
let intervalCallback = null;
let intervalDelay = null;
const context = vm.createContext({
  document,
  setInterval(callback, delay) { intervalCallback = callback; intervalDelay = delay; return 1; },
  clearInterval() { intervalCallback = null; },
  URL: {
    createObjectURL(file) { const url = `blob:${file.name}`; objectUrls.push(url); return url; },
    revokeObjectURL() {},
  },
});
vm.runInContext(script, context);
ids.get('statusFilter').value = 'all';

const file = (name, content) => ({
  name,
  webkitRelativePath: `allure-results/${name}`,
  size: String(content).length,
  type: name.endsWith('.png') ? 'image/png' : 'application/json',
  text: async () => String(content),
});

(async () => {
  await context.loadFiles([
    file('one-result.json', JSON.stringify({
      name: 'One', status: 'passed', start: 1000, stop: 2200,
      labels: [{ name: 'suite', value: 'Payments' }],
      parameters: [{ name: 'device', value: 'Android' }],
      steps: [
        { name: 'Pay', status: 'passed', start: 1100, stop: 1300,
          attachments: [{ name: 'Screen', source: 'screen-attachment.png', type: 'image/png' }] },
        { name: 'Wait for confirmation', status: 'passed', start: 1400, stop: 2100,
          steps: [{ name: 'Confirm', status: 'passed', start: 1800, stop: 2000,
            attachments: [{ name: 'Confirmation', source: 'confirmation-attachment.png', type: 'image/png' }] }] },
      ],
    })),
    file('two-result.json', JSON.stringify({
      name: 'Two', status: 'failed', start: 2300, stop: 3200,
      labels: [{ name: 'suite', value: 'Payments' }, { name: 'platform', value: 'iOS' }],
      parameters: [{ name: 'device', value: 'Android' }],
      parameters: [{ name: 'device', value: 'iPhone 15' }],
      statusDetails: { message: 'Expected confirmation' },
    })),
    file('screen-attachment.png', 'image bytes'),
    file('confirmation-attachment.png', 'more image bytes'),
  ]);
  assert.equal(context.run().tests.length, 2);
  assert.equal(context.run().tests[0]._suite, 'Payments');
  assert.equal(context.tagValue(context.run().tests[0], 'device'), 'Android');
  assert.equal(context.tagValue(context.run().tests[0], 'platform'), 'Android');
  assert.equal(context.tagValue(context.run().tests[1], 'platform'), 'iOS');
  assert.equal(ids.get('deviceFilter').children.length, 3);
  assert.equal(ids.get('platformFilter').children.length, 3);
  assert.equal(ids.get('summary').children[0].children[0].textContent, '2');
  assert.equal(objectUrls.length, 0, 'suite selection is the prescreen');
  assert.equal(ids.get('report').classList.contains('hidden'), false);
  assert.equal(ids.get('workspace').classList.contains('hidden'), true);
  ids.get('tests').children[0].listeners.click();
  assert.ok(ids.get('workspaceMeta').textContent.includes('Payments'));
  assert.equal(ids.get('report').classList.contains('hidden'), true);
  assert.equal(ids.get('workspace').classList.contains('hidden'), false);
  assert.ok(objectUrls.includes('blob:screen-attachment.png'));
  const entries = context.timelineEntries(context.run().tests[0].steps);
  assert.equal(entries.length, 3);
  assert.equal(entries[2].depth, 1);
  assert.equal(context.screenshotForEntry(context.run().tests[0], entries, 0).attachment.source, 'screen-attachment.png');
  assert.equal(context.screenshotForEntry(context.run().tests[0], entries, 1).attachment.source, 'screen-attachment.png');
  assert.equal(context.screenshotForEntry(context.run().tests[0], entries, 2).attachment.source, 'confirmation-attachment.png');
  const find = (node, className) => {
    if (node.className?.split(' ').includes(className)) return node;
    for (const child of node.children) {
      const match = find(child, className);
      if (match) return match;
    }
    return null;
  };
  const strip = find(ids.get('detail'), 'thumbnail-strip');
  assert.equal(strip.children.length, 2);
  strip.children[1].listeners.click();
  assert.equal(vm.runInContext('state.timeline.current()', context), 2);
  assert.equal(find(ids.get('detail'), 'screenshot-image').src, 'blob:confirmation-attachment.png');
  assert.ok(strip.children[1].scrolled);
  const rail = find(ids.get('detail'), 'timeline-rail');
  assert.equal(rail.children.length, 3);
  rail.children[1].listeners.click();
  assert.equal(find(ids.get('detail'), 'screenshot-image').src, 'blob:screen-attachment.png');
  rail.children[2].listeners.click();
  assert.equal(find(ids.get('detail'), 'screenshot-image').src, 'blob:confirmation-attachment.png');
  find(ids.get('detail'), 'screenshot-link').listeners.click();
  assert.equal(ids.get('imageDialog').open, true);
  assert.equal(ids.get('largeImage').src, 'blob:confirmation-attachment.png');
  ids.get('closeImage').listeners.click();
  assert.equal(ids.get('imageDialog').open, false);
  ids.get('playbackSpeed').value = '900';
  ids.get('playButton').listeners.click();
  assert.equal(intervalDelay, 900);
  ids.get('playbackSpeed').value = '450';
  ids.get('playbackSpeed').listeners.change();
  assert.equal(intervalDelay, 450);
  assert.equal(ids.get('playButton').textContent, 'Pause');
  assert.equal(ids.get('playButton').textContent, 'Pause');
  intervalCallback();
  assert.equal(context.state?.timeline?.current?.() ?? vm.runInContext('state.timeline.current()', context), 1);
  assert.ok(rail.children[1].scrolled, 'playback follows the selected step');
  intervalCallback();
  assert.equal(vm.runInContext('state.timeline.current()', context), 2);
  assert.equal(ids.get('playButton').textContent, 'Play steps');
  assert.equal(intervalCallback, null);
  ids.get('backButton').listeners.click();
  assert.equal(ids.get('report').classList.contains('hidden'), false);
  assert.equal(ids.get('workspace').classList.contains('hidden'), true);
  ids.get('statusFilter').value = 'failed';
  context.tests();
  assert.equal(ids.get('tests').children.length, 1);
  assert.equal(ids.get('tests').children[0].children[1].children[0].textContent, 'Two');
  ids.get('statusFilter').value = 'all';
  ids.get('deviceFilter').value = 'Android';
  context.tests();
  assert.equal(ids.get('tests').children.length, 1);
  assert.equal(ids.get('tests').children[0].children[1].children[0].textContent, 'One');
  ids.get('platformFilter').value = 'iOS';
  context.tests();
  assert.equal(ids.get('tests').children[0].textContent, 'No tests match these filters.');
  assert.equal(typeof ids.get('jsonInput').listeners.change, 'function');
  await context.loadFiles([{
    ...file('single-result.json', JSON.stringify({ name: 'From file picker', status: 'passed' })),
    webkitRelativePath: '',
  }]);
  ids.get('statusFilter').value = 'all';
  context.render();
  assert.equal(context.run().name, 'Selected files');
  assert.equal(context.run().tests.length, 1);
  console.log('Viewer loading, tag filters, playback, screenshot enlargement, and attachments passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
