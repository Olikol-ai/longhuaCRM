import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOCUMENT_PIP_DEFAULT_SIZE,
  isDocumentPictureInPictureSupported,
  reparentDomNode,
} from './documentPictureInPicture.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('document Picture-in-Picture helpers', () => {
  it('detects missing Document PiP API', () => {
    assert.equal(isDocumentPictureInPictureSupported(null), false);
    assert.equal(isDocumentPictureInPictureSupported({}), false);
  });

  it('detects supported Document PiP API', () => {
    assert.equal(
      isDocumentPictureInPictureSupported({ documentPictureInPicture: {} }),
      true,
    );
  });

  it('uses Zoom-like initial size ~360×240', () => {
    assert.equal(DOCUMENT_PIP_DEFAULT_SIZE.width, 360);
    assert.equal(DOCUMENT_PIP_DEFAULT_SIZE.height, 240);
  });

  it('reparents DOM nodes without cloning', () => {
    const parentA = { children: [] };
    const parentB = { children: [] };
    const node = { parentElement: parentA };
    parentA.appendChild = () => {};
    parentB.appendChild = (n) => {
      n.parentElement = parentB;
    };
    assert.equal(reparentDomNode(node, parentB), true);
    assert.equal(node.parentElement, parentB);
    assert.equal(reparentDomNode(node, parentB), false);
    assert.equal(reparentDomNode(null, parentB), false);
  });
});

describe('Document PiP video session wiring', () => {
  it('uses documentPictureInPicture.requestWindow and reparents Jitsi host', () => {
    const helpers = read('lib/documentPictureInPicture.js');
    const hook = read('components/video/useDocumentVideoPiP.jsx');
    const layer = read('components/video/VideoSessionLayer.jsx');
    const chrome = read('components/video/VideoSessionPiPChrome.jsx');
    const ctx = read('lib/VideoSessionContext.jsx');
    const controls = read('components/video/LessonVideoControls.jsx');

    assert.match(helpers, /documentPictureInPicture/);
    assert.match(helpers, /requestWindow/);
    assert.match(helpers, /preferInitialWindowPlacement/);
    assert.match(helpers, /reparentDomNode/);
    assert.match(helpers, /enterpictureinpicture/);
    assert.doesNotMatch(helpers, /window\.open\(/);

    assert.match(hook, /createRoot/);
    assert.match(hook, /requestDocumentPictureInPictureWindow/);
    assert.match(hook, /reparentDomNode/);
    assert.match(hook, /pagehide/);
    assert.match(hook, /registerAutomaticDocumentPiPHandler/);

    assert.match(layer, /useDocumentVideoPiP/);
    assert.match(layer, /lesson-video-jitsi-host/);
    assert.match(layer, /lesson-video-document-pip|lesson-video-pip-crm-banner/);
    assert.match(layer, /floatOverWindows|Вынести видео поверх окон|Поверх окон/);
    assert.match(layer, /enterPipMode|exitPipMode/);
    assert.match(layer, /data-jitsi-park/);
    // Must not remount Jitsi when opening PiP
    assert.match(layer, /jitsiHostRef/);
    assert.doesNotMatch(layer, /embedKey\s*\+\s*1.*pip|setEmbedKey.*pip/i);

    assert.match(chrome, /lesson-video-document-pip/);
    assert.match(chrome, /lesson-video-pip-mic|lesson-video-pip-return|lesson-video-pip-hangup/);
    assert.match(chrome, /LessonVideoFilmstrip/);
    assert.match(chrome, /Вернуться в урок/);

    assert.match(ctx, /enterPipMode|exitPipMode|'pip'/);
    assert.match(controls, /documentPipSupported|onFloatOverWindows|PictureInPicture2/);
    assert.match(controls, /lesson-video-float-dock/);
  });

  it('keeps in-CRM mini as fallback and hides PiP CTA when unsupported', () => {
    const layer = read('components/video/VideoSessionLayer.jsx');
    const controls = read('components/video/LessonVideoControls.jsx');
    assert.match(layer, /lesson-video-mini/);
    assert.match(layer, /documentPip\.supported/);
    assert.match(controls, /documentPipSupported && onFloatOverWindows/);
    assert.match(controls, /Свернуть/);
  });

  it('closing PiP does not end the session', () => {
    const hook = read('components/video/useDocumentVideoPiP.jsx');
    const layer = read('components/video/VideoSessionLayer.jsx');
    assert.match(hook, /pagehide/);
    assert.match(layer, /exitPipMode\('mini'\)/);
    const closedHandler = layer.match(/onPipClosed:\s*\(\{ reason \} = \{\}\) => \{[\s\S]*?\},/);
    assert.ok(closedHandler, 'onPipClosed handler present');
    assert.doesNotMatch(closedHandler[0], /endSession\s*\(/);
  });

  it('reparents Jitsi host before unmounting PiP root (no iframe teardown)', () => {
    const hook = read('components/video/useDocumentVideoPiP.jsx');
    const start = hook.indexOf('const closeDocumentPiP = useCallback');
    assert.ok(start >= 0, 'closeDocumentPiP present');
    const body = hook.slice(start, start + 1800);
    const reparentIdx = body.indexOf('reparentDomNode');
    const unmountIdx = body.indexOf('.unmount');
    assert.ok(reparentIdx >= 0, 'reparents host on close');
    assert.ok(unmountIdx >= 0, 'unmounts pip root on close');
    assert.ok(
      reparentIdx < unmountIdx,
      'must reparent Jitsi host before unmounting PiP React tree',
    );
  });
});
