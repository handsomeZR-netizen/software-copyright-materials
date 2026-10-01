import { randomUUID } from 'node:crypto';
import { STEP_NAMES, STEP_POINTS, WEIGHTS } from '../shared/types.ts';
import type { Action, Session } from '../shared/types.ts';

export class InputError extends Error {}
export function createSession(
  label = '天平实验练习',
  source: 'practice' | 'demo' = 'practice',
): Session {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    label,
    source,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    status: 'active',
    checked: false,
    calibrated: false,
    rider: 10,
    nut: 2,
    objectSide: 'box',
    objectMass: 374,
    weights: [],
    tool: 'tweezers',
    steps: STEP_NAMES.map((name, i) => ({
      name,
      max: STEP_POINTS[i],
      passed: false,
      score: 0,
    })),
    events: [],
    reading: null,
    score: 0,
    feedback: '请先检查器材，再将游码归零。',
    balanced: false,
    difference: 10,
  };
}
function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}
export function validateAction(value: unknown): asserts value is Action {
  if (!value || typeof value !== 'object')
    throw new InputError('操作必须是 JSON 对象。');
  const a = value as Record<string, unknown>;
  if (typeof a.type !== 'string') throw new InputError('操作类型必须是字符串。');
  const valid =
    ['check', 'tidy'].includes(a.type) ||
    (a.type === 'rider' && integer(a.value, 0, 50)) ||
    (a.type === 'nut' && integer(a.value, -5, 5)) ||
    (a.type === 'tool' && typeof a.value === 'string' && ['tweezers', 'hand'].includes(a.value)) ||
    (a.type === 'object' && typeof a.side === 'string' && ['box', 'left', 'right'].includes(a.side)) ||
    (a.type === 'addWeight' &&
      WEIGHTS.includes(Number(a.mass)) &&
      typeof a.mass === 'number' &&
      typeof a.side === 'string' && ['left', 'right'].includes(a.side)) ||
    (a.type === 'removeWeight' && integer(a.index, 0, 3)) ||
    (a.type === 'read' && integer(a.value, 0, 10000));
  if (!valid) throw new InputError('操作类型或参数无效。质量参数使用整数十分之一克。');
}
function pass(s: Session, index: number) {
  if (s.steps.slice(0, index).every((step) => step.passed)) {
    s.steps[index].passed = true;
    s.steps[index].score = s.steps[index].max;
  }
}
function empty(s: Session) {
  return s.objectSide === 'box' && s.weights.length === 0;
}
function measure(s: Session) {
  const left =
    (s.objectSide === 'left' ? s.objectMass : 0) +
    s.weights.filter((w) => w.side === 'left').reduce((n, w) => n + w.mass, 0);
  const right =
    (s.objectSide === 'right' ? s.objectMass : 0) +
    s.weights.filter((w) => w.side === 'right').reduce((n, w) => n + w.mass, 0);
  s.difference = left - right - s.rider + s.nut * 10;
  s.balanced = s.difference === 0;
}
function properWeights(s: Session) {
  return (
    s.weights.length > 0 &&
    s.weights.every((w) => {
      const event = [...s.events]
        .reverse()
        .find((e) => e.action.startsWith(`addWeight:${w.mass}:`));
      return w.side === 'right' && event?.action.endsWith(':valid');
    })
  );
}
function readyToRead(s: Session) {
  return (
    s.calibrated &&
    s.nut === 0 &&
    s.objectSide === 'left' &&
    properWeights(s) &&
    s.balanced &&
    s.steps[5].passed
  );
}
export function applyAction(previous: Session, action: Action): Session {
  validateAction(action);
  if (previous.status !== 'active') throw new InputError('实验已结束，请新建实验。');
  const s = structuredClone(previous);
  let violation = false;
  let message = '';
  let tag: string = action.type;
  const reject = (text: string) => {
    violation = true;
    message = text;
  };
  switch (action.type) {
    case 'check':
      s.checked = true;
      pass(s, 0);
      message = '器材检查完成：天平、物体、砝码、镊子齐全。';
      break;
    case 'rider':
      s.rider = action.value;
      message = `游码已移至 ${(s.rider / 10).toFixed(1)} g。`;
      if (!s.checked) reject('请先检查器材。');
      else if (s.rider === 0 && empty(s)) pass(s, 1);
      else if (!s.calibrated) reject('请将游码归零并完成空载调平。');
      break;
    case 'nut':
      s.nut = action.value;
      s.calibrated = false;
      message = `平衡螺母设置为 ${s.nut}。`;
      if (!empty(s))
        reject('有负载时禁止调节平衡螺母；请取下物体和砝码、游码归零后重新调平。');
      else if (!s.checked || !s.steps[1].passed || s.rider !== 0)
        reject('调平前请先检查器材并将游码归零。');
      else if (s.nut === 0) {
        s.calibrated = true;
        pass(s, 2);
        message = '空载调平完成。';
      }
      break;
    case 'tool':
      s.tool = action.value;
      message =
        s.tool === 'tweezers'
          ? '已选用镊子。'
          : '已切换为徒手操作；取放砝码应使用镊子。';
      break;
    case 'object':
      s.objectSide = action.side;
      message =
        action.side === 'box'
          ? '物体已放回器材区。'
          : `物体已放在${action.side === 'left' ? '左' : '右'}盘。`;
      if (action.side === 'right') reject('应左物右码，请将物体放在左盘。');
      else if (
        action.side === 'left' &&
        (!s.calibrated || s.nut !== 0 || s.rider !== 0)
      )
        reject('放物前请游码归零，并完成空载调平。');
      else if (action.side === 'left') pass(s, 3);
      break;
    case 'addWeight': {
      if (s.weights.some((w) => w.mass === action.mass))
        throw new InputError('该砝码已在托盘中。');
      const last = s.weights.at(-1);
      const valid =
        s.tool === 'tweezers' &&
        action.side === 'right' &&
        s.objectSide === 'left' &&
        s.calibrated &&
        s.nut === 0 &&
        s.steps[3].passed &&
        (!last || action.mass < last.mass);
      s.weights.push({ mass: action.mass, side: action.side });
      tag = `addWeight:${action.mass}:${valid ? 'valid' : 'invalid'}`;
      message = `已添加 ${(action.mass / 10).toFixed(1)} g 砝码。`;
      if (!valid)
        reject(
          '请先正确调平并左盘放物，使用镊子向右盘按从大到小顺序加码；错误砝码请取下后重新添加。',
        );
      else pass(s, 4);
      break;
    }
    case 'removeWeight': {
      if (!s.weights[action.index]) throw new InputError('砝码索引不存在。');
      const [removed] = s.weights.splice(action.index, 1);
      message = `已取回 ${(removed.mass / 10).toFixed(1)} g 砝码。`;
      if (s.tool !== 'tweezers') reject('取回砝码也应使用镊子。');
      break;
    }
    case 'read':
      measure(s);
      if (!readyToRead(s))
        reject('当前不能读数：需正确调平、左物右码、规范取码，并完成游码微调平衡。');
      else if (action.value !== s.objectMass)
        reject('读数不正确，请将右盘砝码总质量与游码示值相加。');
      else {
        s.reading = action.value;
        s.measurement = {
          weightTotal: s.weights.reduce((n, w) => n + w.mass, 0),
          rider: s.rider,
          value: action.value,
          at: new Date().toISOString(),
        };
        pass(s, 6);
        message = `测量结果 ${(s.reading / 10).toFixed(1)} g，记录成功。`;
      }
      break;
    case 'tidy':
      if (!s.steps[6].passed) reject('请先完成正确读数，再整理器材。');
      else {
        s.objectSide = 'box';
        s.weights = [];
        s.rider = 0;
        s.nut = 0;
        s.tool = 'tweezers';
        s.calibrated = true;
        pass(s, 7);
        message = '物体和砝码已归位、游码已归零，实验完成。';
      }
      break;
  }
  s.updatedAt = new Date().toISOString();
  s.events.push({ at: s.updatedAt, action: tag, message, violation });
  measure(s);
  if (
    action.type === 'rider' &&
    !violation &&
    s.rider > 0 &&
    s.calibrated &&
    s.nut === 0 &&
    s.objectSide === 'left' &&
    properWeights(s) &&
    s.balanced
  ) {
    pass(s, 5);
    message = '游码微调完成，天平平衡。请读取右盘砝码与游码的合计质量。';
    s.events[s.events.length - 1].message = message;
  }
  s.score = s.steps.reduce((n, step) => n + step.score, 0);
  s.feedback = message;
  return s;
}
export function finishSession(previous: Session): Session {
  if (previous.status === 'finished') return previous;
  const s = structuredClone(previous);
  s.status = 'finished';
  s.finishedAt = new Date().toISOString();
  s.updatedAt = s.finishedAt;
  s.feedback = `实验已归档，练习完成得分 ${s.score} / 100。`;
  s.events.push({
    at: s.finishedAt,
    action: 'finish',
    message: s.feedback,
    violation: false,
  });
  return s;
}
