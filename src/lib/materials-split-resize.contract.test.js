import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('materials two-pane resize contract', () => {
  it('uses existing react-resizable-panels only on desktop two-pane layout', () => {
    const manager = read('src/components/materials/MaterialManager.jsx');
    const folderTree = read('src/components/materials/FolderTree.jsx');
    assert.match(manager, /ResizablePanelGroup/);
    assert.match(manager, /ResizableHandle/);
    assert.match(manager, /useIsLgUp/);
    assert.match(manager, /materials-panel-resizer/);
    assert.match(manager, /materials-split-layout/);
    assert.match(manager, /autoSaveId="materials-hub-panels"/);
    assert.match(manager, /minSize=\{18\}/);
    assert.match(manager, /maxSize=\{42\}/);
    assert.match(manager, /minSize=\{40\}/);
    assert.match(folderTree, /className/);
    // Mobile path remains a stacked column without the splitter.
    assert.match(manager, /flex flex-col gap-4 items-start/);
  });
});
