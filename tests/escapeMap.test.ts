import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCAPE_ROUTE_NODES,
  canEnterEscapeNode,
  completeEscapeTransition,
  createInitialEscapeProgress,
  loadEscapeProgress,
  markEscapeNodeCleared,
  markEscapeWallRevealed,
  resetEscapeProgress,
  samplePolylinePoint,
  sanitizeEscapeProgress,
} from '../src/engine/escapeMap.ts';

describe('escapeMap: 黑域逃亡路线图状态机与钻缝轨迹插值', () => {
  it('initializes with 5 combat nodes + 1 reality exit and unlocks node 0 only', () => {
    const progress = createInitialEscapeProgress();
    assert.equal(ESCAPE_ROUTE_NODES.length, 6);
    assert.equal(ESCAPE_ROUTE_NODES[5].isExit, true);
    assert.equal(progress.currentNodeIndex, 0);
    assert.equal(progress.highestUnlockedIndex, 0);
    assert.deepEqual(progress.clearedIndices, []);
    assert.equal(progress.pendingTransition, null);
    assert.equal(progress.escapedReality, false);

    assert.equal(canEnterEscapeNode(progress, 0), true);
    assert.equal(canEnterEscapeNode(progress, 1), false);
    assert.equal(canEnterEscapeNode(progress, 5), false);
  });

  it('queues an escape transition when clearing current node and unlocks next node after move completes', () => {
    let progress = createInitialEscapeProgress();
    progress = markEscapeNodeCleared(progress, 0);

    assert.deepEqual(progress.clearedIndices, [0]);
    assert.ok(progress.pendingTransition);
    assert.equal(progress.pendingTransition?.fromIndex, 0);
    assert.equal(progress.pendingTransition?.toIndex, 1);
    assert.equal(progress.highestUnlockedIndex, 1);
    assert.equal(canEnterEscapeNode(progress, 1), true);

    progress = completeEscapeTransition(progress);
    assert.equal(progress.pendingTransition, null);
    assert.equal(progress.currentNodeIndex, 1);
    assert.equal(progress.escapedReality, false);
  });

  it('transitions through all 5 combat nodes and marks escapedReality upon completing exit move', () => {
    let progress = createInitialEscapeProgress();
    for (let i = 0; i < 5; i += 1) {
      assert.equal(canEnterEscapeNode(progress, i), true);
      progress = markEscapeNodeCleared(progress, i);
      progress = completeEscapeTransition(progress);
    }

    assert.equal(progress.currentNodeIndex, 5);
    assert.equal(progress.escapedReality, true);
    assert.deepEqual(progress.clearedIndices, [0, 1, 2, 3, 4]);
    assert.equal(canEnterEscapeNode(progress, 5), false);

    const reset = resetEscapeProgress();
    assert.equal(reset.currentNodeIndex, 0);
    assert.equal(reset.escapedReality, false);
  });

  it('ignores out-of-order clear calls for locked future nodes', () => {
    const progress = createInitialEscapeProgress();
    const untouched = markEscapeNodeCleared(progress, 3);
    assert.equal(untouched.highestUnlockedIndex, 0);
    assert.deepEqual(untouched.clearedIndices, []);
    assert.equal(untouched.pendingTransition, null);
  });

  it('provides multi-turn zigzag escape paths and samples positions with heading angle accurately', () => {
    for (let i = 0; i < 5; i += 1) {
      const node = ESCAPE_ROUTE_NODES[i];
      assert.ok(
        node.escapePath.length >= 5,
        `Node ${i} should have >=5 zigzag waypoints for containment-turn-gap escape animation`
      );
      assert.ok(
        node.barricadeWalls.length >= 2,
        `Node ${i} should define red containment walls around the gap`
      );
    }

    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const start = samplePolylinePoint(pts, 0);
    const mid = samplePolylinePoint(pts, 0.5);
    const end = samplePolylinePoint(pts, 1);
    assert.equal(start.x, 0);
    assert.equal(start.y, 0);
    assert.equal(mid.x, 100);
    assert.equal(mid.y, 0);
    assert.equal(end.x, 100);
    assert.equal(end.y, 100);
    assert.equal(Math.round(end.angleDeg), 90);
  });

  it('aligns every barricade wall gap dead-center with the zigzag escape path and persists revealed walls until reset', () => {
    for (let i = 0; i < 5; i += 1) {
      const node = ESCAPE_ROUTE_NODES[i];
      const topWall = node.barricadeWalls[0];
      const botWall = node.barricadeWalls[1];
      assert.equal(topWall.x1, botWall.x1, `Node ${i} top/bottom walls must share wallX`);
      assert.ok(topWall.y2 < botWall.y1, `Node ${i} topWall.y2 must be above botWall.y1`);
      const gapCenterY = (topWall.y2 + botWall.y1) / 2;
      const wallX = topWall.x1;
      // The horizontal escape segment [3] -> [4] crosses wallX at that exact Y
      const segStart = node.escapePath[3];
      const segEnd = node.escapePath[4];
      assert.ok(
        segStart.x < wallX && segEnd.x > wallX,
        `Node ${i} segment [3]->[4] must pass through wallX`
      );
      assert.equal(segStart.y, gapCenterY, `Node ${i} gap center Y must equal escape path Y`);
      assert.equal(segEnd.y, gapCenterY, `Node ${i} segment [3]->[4] must be horizontal through gap`);
    }

    let progress = createInitialEscapeProgress();
    assert.deepEqual(progress.revealedWallIndices, []);
    progress = markEscapeWallRevealed(progress, 0);
    progress = markEscapeWallRevealed(progress, 2);
    assert.deepEqual(progress.revealedWallIndices, [0, 2]);
    const reset = resetEscapeProgress();
    assert.deepEqual(reset.revealedWallIndices, []);
  });

  it('sanitizes malformed storage payloads safely and works without window', () => {
    const fallback = sanitizeEscapeProgress({ currentNodeIndex: 999, clearedIndices: ['bad', -1, 2] });
    assert.equal(fallback.currentNodeIndex, 5);
    assert.deepEqual(fallback.clearedIndices, [2]);
    assert.equal(fallback.highestUnlockedIndex >= 2, true);

    const nodeSafe = loadEscapeProgress();
    assert.equal(nodeSafe.currentNodeIndex, 0);
  });
});
