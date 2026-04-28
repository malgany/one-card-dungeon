import { BOARD_SIZE, LEVELS } from '../config/game-data.js';

export function posKey(pos) {
  return `${pos.x},${pos.y}`;
}

export function parseKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function samePos(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(pos) {
  return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

export function stepCost(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function levelWallsSet(levelIndex) {
  const walls = new Set();
  LEVELS[levelIndex].walls.forEach(([x, y]) => walls.add(`${x},${y}`));
  return walls;
}

export function monsterOccupiedKeys(monsters, exceptId = null) {
  const occupied = new Set();

  for (const monster of monsters) {
    if (monster.hp <= 0) continue;
    if (exceptId && monster.id === exceptId) continue;
    occupied.add(posKey(monster));
  }

  return occupied;
}

export function neighbors(pos) {
  const result = [];

  const offsets = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ];

  for (const [dx, dy] of offsets) {
    const next = { x: pos.x + dx, y: pos.y + dy };
    if (inBounds(next)) result.push(next);
  }

  return result;
}

export function dijkstra(start, blockedKeys = new Set()) {
  const dist = new Map([[posKey(start), 0]]);
  const prev = new Map();
  const open = [{ x: start.x, y: start.y, cost: 0 }];

  while (open.length > 0) {
    open.sort((a, b) => a.cost - b.cost);
    const current = open.shift();
    const currentKey = posKey(current);

    if (current.cost > dist.get(currentKey)) continue;

    for (const next of neighbors(current)) {
      const key = posKey(next);
      if (blockedKeys.has(key)) continue;

      const newCost = current.cost + stepCost(current, next);
      if (newCost < (dist.get(key) ?? Number.POSITIVE_INFINITY)) {
        dist.set(key, newCost);
        prev.set(key, { x: current.x, y: current.y });
        open.push({ x: next.x, y: next.y, cost: newCost });
      }
    }
  }

  return { dist, prev };
}

export function reconstructPath(prevMap, target) {
  const path = [];
  let current = { x: target.x, y: target.y };

  while (current) {
    path.unshift(current);
    current = prevMap.get(posKey(current)) || null;
  }

  return path;
}

export function distanceBetween(start, target, blockedKeys = new Set(), allowTargetBlocked = false) {
  const effectiveBlocked = new Set(blockedKeys);
  if (allowTargetBlocked) effectiveBlocked.delete(posKey(target));
  const { dist } = dijkstra(start, effectiveBlocked);
  return dist.get(posKey(target)) ?? Number.POSITIVE_INFINITY;
}

export function lineCells(a, b) {
  const ax = a.x + 0.5;
  const ay = a.y + 0.5;
  const bx = b.x + 0.5;
  const by = b.y + 0.5;
  const steps = Math.max(12, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 12));
  const cells = [];

  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    cells.push({
      x: Math.floor(ax + (bx - ax) * t),
      y: Math.floor(ay + (by - ay) * t),
    });
  }

  return cells;
}

export function hasLineOfSight(from, to, wallKeys, blockerKeys = new Set()) {
  for (const cell of lineCells(from, to)) {
    if (samePos(cell, from) || samePos(cell, to)) continue;
    const key = posKey(cell);
    if (wallKeys.has(key)) return false;
    if (blockerKeys.has(key)) return false;
  }

  return true;
}
