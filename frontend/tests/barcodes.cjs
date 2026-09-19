const assert = require('node:assert/strict');
const JsBarcode = require('jsbarcode');
const { Code128Reader, BitArray } = require('@zxing/library');

for (const value of ['200000000001', '209876543210', 'TN123456789012', 'TB-ROB001', '001234567890', 'ABC/12+34']) {
  const encoded = {};
  JsBarcode(encoded, value, { format: 'CODE128', width: 1, height: 40, marginLeft: 10, marginRight: 10, displayValue: false });
  const modules = '0'.repeat(10) + encoded.encodings.map(x => x.data).join('') + '0'.repeat(10);
  const row = new BitArray(modules.length * 2);
  for (let i = 0; i < modules.length; i++) if (modules[i] === '1') { row.set(i * 2); row.set(i * 2 + 1); }
  assert.equal(new Code128Reader().decodeRow(0, row, new Map()).getText(), value);
  assert.ok(modules.length * 25.4 * 2 / 203 <= 46, 'Test label must fit 50mm stock without shrinking');
  console.log('PASS independent Code128 decode:', value);
}
