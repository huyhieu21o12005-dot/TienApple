import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moveIndex } from '../../Frontend/js/customSelect.js';

describe('customSelect.moveIndex', () => {
  const none = [false, false, false, false];

  it('đi xuống/lên và dừng ở hai đầu', () => {
    assert.equal(moveIndex(0, 'ArrowDown', none), 1);
    assert.equal(moveIndex(3, 'ArrowDown', none), 3);
    assert.equal(moveIndex(1, 'ArrowUp', none), 0);
    assert.equal(moveIndex(0, 'ArrowUp', none), 0);
  });

  it('bỏ qua mục bị vô hiệu hóa', () => {
    const d = [false, true, true, false];
    assert.equal(moveIndex(0, 'ArrowDown', d), 3);
    assert.equal(moveIndex(3, 'ArrowUp', d), 0);
    assert.equal(moveIndex(-1, 'Home', [true, false, false]), 1);
    assert.equal(moveIndex(0, 'End', [false, false, true]), 1);
  });

  it('Home/End và danh sách rỗng', () => {
    assert.equal(moveIndex(2, 'Home', none), 0);
    assert.equal(moveIndex(1, 'End', none), 3);
    assert.equal(moveIndex(0, 'ArrowDown', []), -1);
    assert.equal(moveIndex(-1, 'ArrowDown', none), 0);
  });
});
