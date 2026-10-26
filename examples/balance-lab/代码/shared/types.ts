export const SOFTWARE_NAME = '天平实验训练示例';
export const VERSION = 'V1.0';
export const OWNER = '示例著作权人';
export const STEP_NAMES = [
  '检查实验器材',
  '游码归零',
  '空载调平',
  '左盘放置物体',
  '由大到小添加砝码',
  '游码微调平衡',
  '读取并记录质量',
  '整理器材归位',
];
export const STEP_POINTS = [10, 10, 15, 15, 20, 10, 10, 10];
export const WEIGHTS = [500, 200, 100, 50]; // 0.1 g units
export interface Step {
  name: string;
  max: number;
  passed: boolean;
  score: number;
}
export interface Event {
  at: string;
  action: string;
  message: string;
  violation: boolean;
}
export interface Session {
  id: string;
  label: string;
  source: 'practice' | 'demo';
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  status: 'active' | 'finished';
  checked: boolean;
  calibrated: boolean;
  rider: number;
  nut: number;
  objectSide: 'box' | 'left' | 'right';
  objectMass: number;
  weights: { mass: number; side: 'left' | 'right' }[];
  tool: 'tweezers' | 'hand';
  steps: Step[];
  events: Event[];
  reading: number | null;
  score: number;
  feedback: string;
  balanced: boolean;
  measurement?: { weightTotal: number; rider: number; value: number; at: string };
  difference: number;
}
export type Action =
  | { type: 'check' }
  | { type: 'rider'; value: number }
  | { type: 'nut'; value: number }
  | { type: 'tool'; value: 'tweezers' | 'hand' }
  | { type: 'object'; side: 'box' | 'left' | 'right' }
  | { type: 'addWeight'; mass: number; side: 'left' | 'right' }
  | { type: 'removeWeight'; index: number }
  | { type: 'read'; value: number }
  | { type: 'tidy' };
export interface ApiError {
  error: string;
}
