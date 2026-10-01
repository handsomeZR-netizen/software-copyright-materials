import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  SOFTWARE_NAME,
  VERSION,
  STEP_NAMES,
  STEP_POINTS,
  WEIGHTS,
  type Session,
  type Action,
} from '../shared/types';
import './style.css';

const grams = (n: number) => (n / 10).toFixed(1);
const date = (s: string) => new Date(s).toLocaleString('zh-CN', { hour12: false });
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    '/api' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作未完成，请重试');
  return data;
}
function Balance({ session: s }: { session: Session }) {
  const angle = Math.max(-13, Math.min(13, -s.difference / 12));
  const pan = (side: 'left' | 'right', x: number) => {
    const y =
      175 + (side === 'left' ? -1 : 1) * Math.sin((angle * Math.PI) / 180) * 215;
    return (
      <g>
        <path
          d={`M ${x} ${y} L ${x - 66} ${y + 102} M ${x} ${y} L ${x + 66} ${y + 102}`}
          stroke="#8b9fa8"
          strokeWidth="2"
          fill="none"
        />
        <path
          d={`M ${x - 78} ${y + 102} Q ${x - 71} ${y + 123} ${x} ${y + 125} Q ${x + 71} ${y + 123} ${x + 78} ${y + 102} Z`}
          fill="url(#steel)"
          stroke="#71909e"
        />
        {s.objectSide === side && (
          <g>
            <path
              d={`M ${x - 25} ${y + 54} l 38 -10 20 14 -1 43 -45 0 -13 -12 Z`}
              fill="#bb7658"
              stroke="#925339"
            />
            <path
              d={`M ${x - 25} ${y + 54} l 20 12 38 -8 M ${x - 5} ${y + 66} v 35`}
              fill="none"
              stroke="#e4ac87"
              strokeWidth="2"
            />
          </g>
        )}
        {s.weights
          .filter((w) => w.side === side)
          .map((w, i) => (
            <g
              key={w.mass}
              transform={`translate(${x - 48 + i * 32},${y + 81 - (w.mass === 500 ? 12 : 0)})`}
            >
              <rect x="7" y="-7" width="12" height="8" rx="3" fill="#8e7041" />
              <path
                d="M 6 0 L 20 0 L 25 20 L 1 20 Z"
                fill="url(#brass)"
                stroke="#957645"
              />
              <text x="13" y="14" textAnchor="middle" fontSize="9" fill="#4d3d25">
                {w.mass / 10}
              </text>
            </g>
          ))}
        <text x={x} y="335" textAnchor="middle" className="pan-label">
          {side === 'left' ? '左盘 · 放置物体' : '右盘 · 添加砝码'}
        </text>
      </g>
    );
  };
  return (
    <svg
      className="balance"
      viewBox="0 0 820 390"
      role="img"
      aria-label={`托盘天平，${s.balanced ? '已平衡' : '未平衡'}，左盘${s.objectSide === 'left' ? '有物体' : '无物体'}`}
    >
      <defs>
        <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ecf4f5" />
          <stop offset=".6" stopColor="#b9cbd2" />
          <stop offset="1" stopColor="#7c99a7" />
        </linearGradient>
        <linearGradient id="brass">
          <stop stopColor="#d5bb81" />
          <stop offset=".5" stopColor="#eee0b4" />
          <stop offset="1" stopColor="#ab8c4c" />
        </linearGradient>
        <linearGradient id="base">
          <stop stopColor="#265468" />
          <stop offset="1" stopColor="#153748" />
        </linearGradient>
      </defs>
      <ellipse cx="410" cy="364" rx="218" ry="10" fill="#173d4c" opacity=".07" />
      <path d="M 332 349 L 346 327 H 474 L 490 349 Z" fill="url(#base)" />
      <rect x="393" y="172" width="34" height="155" rx="4" fill="url(#steel)" />
      <path d="M 379 327 L 398 282 H 422 L 441 327" fill="#27556b" />
      <path d="M 357 177 A 56 56 0 0 1 463 177" fill="#fff" stroke="#b9cbd2" />
      {[-40, -20, 0, 20, 40].map((v) => (
        <line
          key={v}
          x1={410 + v}
          y1={v === 0 ? 124 : 130 + Math.abs(v) / 4}
          x2={410 + v}
          y2={v === 0 ? 138 : 139 + Math.abs(v) / 4}
          stroke={v === 0 ? '#0d887f' : '#8ba2ad'}
          strokeWidth={v === 0 ? 3 : 1}
        />
      ))}
      <g transform={`rotate(${angle},410,175)`} className="beam">
        <path
          d="M 193 173 L 410 161 L 627 173 L 627 185 L 410 180 L 193 185 Z"
          fill="url(#steel)"
          stroke="#73909e"
        />
        <line x1="410" y1="171" x2="410" y2="124" stroke="#148d85" strokeWidth="3" />
        <circle cx="410" cy="175" r="9" fill="#31586a" />
        <circle cx="410" cy="175" r="3" fill="#e5eef1" />
        <rect x="624" y="167" width="18" height="24" rx="3" fill="url(#brass)" />
        <rect x="180" y="167" width="18" height="24" rx="3" fill="url(#brass)" />
        <rect
          x="426"
          y="186"
          width="181"
          height="15"
          rx="2"
          fill="#dce7eb"
          stroke="#8ea7b2"
        />
        {Array.from({ length: 26 }, (_, i) => (
          <line
            key={i}
            x1={430 + i * 6.8}
            x2={430 + i * 6.8}
            y1="187"
            y2={i % 5 === 0 ? 197 : 192}
            stroke="#637d89"
          />
        ))}
        <rect
          x={426 + s.rider * 3.4}
          y="182"
          width="9"
          height="25"
          rx="2"
          fill="#187e7b"
        />
      </g>
      {pan('left', 195)}
      {pan('right', 625)}
      <text
        x="410"
        y="349"
        textAnchor="middle"
        fill="#d8e7eb"
        fontSize="10"
        letterSpacing="3"
      >
        TRAY BALANCE
      </text>
      <g transform="translate(350,35)">
        <rect
          width="120"
          height="28"
          rx="14"
          fill={s.balanced ? '#d8eee7' : '#e1e9ee'}
        />
        <circle cx="17" cy="14" r="3" fill={s.balanced ? '#168778' : '#617a89'} />
        <text x="67" y="19" textAnchor="middle" fill="#285365" fontSize="12">
          {s.balanced ? '指针已平衡' : '指针未平衡'}
        </text>
      </g>
    </svg>
  );
}
function App() {
  const [tab, setTab] = useState('实验台'),
    [session, setSession] = useState<Session | null>(null),
    [history, setHistory] = useState<Session[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [label, setLabel] = useState('天平质量测量练习'),
    [source, setSource] = useState<'practice' | 'demo'>('practice'),
    [side, setSide] = useState<'left' | 'right'>('right'),
    [reading, setReading] = useState(''),
    [report, setReport] = useState<Session | null>(null),
    [reset, setReset] = useState(false),
    [online, setOnline] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接失败，请检查本地服务后重试');
    } finally {
      setBusy(false);
    }
  };
  const load = () =>
    run(async () => {
      await api('/health');
      setOnline(true);
      setHistory(await api<Session[]>('/sessions'));
      const id = localStorage.getItem('balance-session');
      if (id) setSession(await api<Session>('/sessions/' + id));
    });
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!reset && !report) return;
    const dialog = document.querySelector<HTMLElement>(
      report ? '.report[role="dialog"]' : '.new-dialog[role="dialog"]',
    );
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0);
    dialog.tabIndex = -1;
    const focusFirst = () => (focusable()[0] ?? dialog).focus();
    focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (report) setReport(null);
        else setReset(false);
      } else if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey &&
          (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey &&
          (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [reset, report?.id]);
  const create = () =>
    run(async () => {
      const s = await api<Session>('/sessions', {
        label: label.trim() || '天平质量测量练习',
        source,
      });
      setSession(s);
      localStorage.setItem('balance-session', s.id);
      setReading('');
      setSide('right');
      setReset(false);
      setTab('实验台');
      setHistory(await api('/sessions'));
    });
  const act = (action: Action) =>
    session &&
    run(async () =>
      setSession(await api<Session>(`/sessions/${session.id}/actions`, action)),
    );
  const finish = () =>
    session &&
    run(async () => {
      const s = await api<Session>(`/sessions/${session.id}/finish`, {});
      setSession(s);
      setReport(s);
      setHistory(await api('/sessions'));
    });
  const disabled = busy || session?.status === 'finished';
  const submitReading = () => {
    if (
      !/^\d+(\.\d)?$/.test(reading) ||
      Number(reading) < 0 ||
      Number(reading) > 1000
    ) {
      setError('读数需为 0 至 1000 g 的数字，最多保留一位小数。');
      return;
    }
    void act({ type: 'read', value: Math.round(Number(reading) * 10) });
  };
  const download = (s: Session) => {
    const a = document.createElement('a');
    a.href = `/api/sessions/${s.id}/export`;
    a.download = `天平实验-${s.id}.json`;
    a.click();
  };
  return (
    <>
      <header className="topbar">
        <div className="brand-icon">⚖</div>
        <div className="brand">
          <strong>{SOFTWARE_NAME}</strong>
          <span>实验教学 · 交互练习与过程评测</span>
        </div>
        <span className="version">{VERSION}</span>
        <div className="connection">
          <i className={online ? 'on' : ''} />
          {online ? '本地服务已连接' : '正在连接本地服务'}
        </div>
      </header>
      <div className="navigation">
        <nav aria-label="主导航">
          {['实验台', '实验记录', '实验指南'].map((t, i) => (
            <button
              key={t}
              className={tab === t ? 'selected' : ''}
              onClick={() => {
                setTab(t);
                if (i === 1) void run(async () => setHistory(await api('/sessions')));
              }}
            >
              <span>{['◈', '▤', '◎'][i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <span>认识仪器，规范操作，准确测量。</span>
      </div>
      <main>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => void load()}>重新连接</button>
          </div>
        )}
        {tab === '实验台' && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">物理实验 / 质量测量</div>
                <h1>把每一步，放在天平上。</h1>
                <p>按顺序完成八个实验环节，操作过程将自动保存。</p>
              </div>
              <button className="secondary" onClick={() => setReset(true)}>
                ＋ 新建实验
              </button>
            </div>
            {!session ? (
              <section className="start-panel">
                <div className="start-mark">⚖</div>
                <h2>开始你的第一轮测量</h2>
                <p>检查器材、调整平衡，再测量物体的质量。</p>
                <label>
                  实验名称
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={80}
                  />
                </label>
                <label>
                  记录来源
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as 'practice' | 'demo')}
                  >
                    <option value="practice">自主练习</option>
                    <option value="demo">演示记录</option>
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void create()}
                >
                  开始实验 →
                </button>
              </section>
            ) : (
              <div className="workbench">
                <div className="left-column">
                  <section className="instrument-panel">
                    <div className="panel-heading">
                      <div>
                        <strong>{session.label}</strong>
                        <span className="badge">
                          {session.source === 'demo' ? '演示记录' : '自主练习'}
                        </span>
                        {session.status === 'finished' && (
                          <span className="badge">已归档</span>
                        )}
                      </div>
                      <span className="subtle">分度值 0.1 g</span>
                    </div>
                    <Balance session={session} />
                    <div className="instrument-readings">
                      <div>
                        <span>游码示值</span>
                        <strong>
                          {grams(session.rider)}
                          <small>g</small>
                        </strong>
                      </div>
                      <div>
                        <span>砝码总质量</span>
                        <strong>
                          {grams(session.weights.reduce((n, w) => n + w.mass, 0))}
                          <small>g</small>
                        </strong>
                      </div>
                      <div>
                        <span>空载调平</span>
                        <strong className="status-word">
                          {session.calibrated ? '已完成' : '待调整'}
                        </strong>
                      </div>
                    </div>
                  </section>
                  <div
                    className={`feedback ${session.events.at(-1)?.violation ? 'warning' : ''}`}
                    role="status"
                  >
                    <span>{session.events.at(-1)?.violation ? '!' : 'i'}</span>
                    <div>
                      <strong>
                        {session.events.at(-1)?.violation ? '操作提示' : '当前指引'}
                      </strong>
                      <p>{session.feedback}</p>
                    </div>
                  </div>
                  <section className="controls">
                    <div className="panel-heading">
                      <strong>器材与操作</strong>
                      <span className="subtle">依次完成准备、测量与整理</span>
                    </div>
                    <fieldset disabled={disabled}>
                      <div className="control-grid">
                        <div className="control-group">
                          <h3>
                            <b>01</b> 准备与调平
                          </h3>
                          <button
                            className={session.checked ? 'done-button' : 'secondary'}
                            onClick={() => void act({ type: 'check' })}
                          >
                            {session.checked ? '✓ 器材检查完成' : '检查实验器材'}
                          </button>
                          <label className="slider-label">
                            平衡螺母 <output>{session.nut}</output>
                            <input
                              aria-label="平衡螺母"
                              type="range"
                              min="-5"
                              max="5"
                              value={session.nut}
                              onChange={(e) =>
                                void act({ type: 'nut', value: Number(e.target.value) })
                              }
                            />
                          </label>
                          <small>空载时，先游码归零，再调螺母至 0。</small>
                        </div>
                        <div className="control-group">
                          <h3>
                            <b>02</b> 放物与取码
                          </h3>
                          <label>
                            取码工具
                            <select
                              aria-label="取码工具"
                              value={session.tool}
                              onChange={(e) =>
                                void act({
                                  type: 'tool',
                                  value: e.target.value as 'hand' | 'tweezers',
                                })
                              }
                            >
                              <option value="tweezers">镊子</option>
                              <option value="hand">徒手（不规范操作）</option>
                            </select>
                          </label>
                          <label>
                            物体位置
                            <select
                              aria-label="物体位置"
                              value={session.objectSide}
                              onChange={(e) =>
                                void act({
                                  type: 'object',
                                  side: e.target.value as 'box' | 'left' | 'right',
                                })
                              }
                            >
                              <option value="box">器材盒</option>
                              <option value="left">左盘</option>
                              <option value="right">右盘</option>
                            </select>
                          </label>
                          <label>
                            砝码放置
                            <select
                              aria-label="砝码放置"
                              value={side}
                              onChange={(e) =>
                                setSide(e.target.value as 'left' | 'right')
                              }
                            >
                              <option value="right">右盘</option>
                              <option value="left">左盘</option>
                            </select>
                          </label>
                        </div>
                        <div className="control-group">
                          <h3>
                            <b>03</b> 砝码与游码
                          </h3>
                          <div className="weight-buttons">
                            {WEIGHTS.map((w) => (
                              <button
                                key={w}
                                disabled={session.weights.some((x) => x.mass === w)}
                                onClick={() =>
                                  void act({ type: 'addWeight', mass: w, side })
                                }
                                aria-label={`添加${w / 10}克砝码`}
                              >
                                <span>▰</span>
                                {w / 10}
                                <small>g</small>
                              </button>
                            ))}
                          </div>
                          <div className="placed-weights">
                            {session.weights.length ? (
                              session.weights.map((w, i) => (
                                <button
                                  key={w.mass}
                                  onClick={() =>
                                    void act({ type: 'removeWeight', index: i })
                                  }
                                  aria-label={`取回${w.mass / 10}克砝码`}
                                >
                                  {w.mass / 10}g {w.side === 'left' ? '左' : '右'} ×
                                </button>
                              ))
                            ) : (
                              <span>砝码均在器材盒内</span>
                            )}
                          </div>
                          <label className="slider-label">
                            游码 <output>{grams(session.rider)} g</output>
                            <input
                              aria-label="游码"
                              type="range"
                              min="0"
                              max="50"
                              value={session.rider}
                              onChange={(e) =>
                                void act({
                                  type: 'rider',
                                  value: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <button
                            className="text-button"
                            onClick={() => void act({ type: 'rider', value: 0 })}
                          >
                            游码归零
                          </button>
                        </div>
                      </div>
                      <div className="record-row">
                        <label htmlFor="reading">测量读数</label>
                        <div className="unit-input">
                          <input
                            id="reading"
                            aria-label="测量读数"
                            type="number"
                            min="0"
                            max="1000"
                            step="0.1"
                            placeholder="0.0"
                            value={reading}
                            onChange={(e) => setReading(e.target.value)}
                          />
                          <span>g</span>
                        </div>
                        <button
                          className="primary"
                          disabled={reading === '' || !Number.isFinite(Number(reading))}
                          onClick={submitReading}
                        >
                          记录读数
                        </button>
                        <button
                          className="secondary"
                          onClick={() => void act({ type: 'tidy' })}
                        >
                          整理器材归位
                        </button>
                      </div>
                    </fieldset>
                  </section>
                </div>
                <aside>
                  <section className="assessment">
                    <div className="panel-heading">
                      <strong>实验完成度</strong>
                      <span className="subtle">8 个环节</span>
                    </div>
                    <div className="score">
                      <strong>{session.score}</strong>
                      <span>/ 100 分</span>
                      <p>练习完成评分</p>
                    </div>
                    <div className="progress">
                      <div style={{ width: session.score + '%' }} />
                    </div>
                    <ol className="step-list">
                      {session.steps.map((s, i) => (
                        <li key={s.name} className={s.passed ? 'passed' : ''}>
                          <span className="step-no">
                            {s.passed ? '✓' : String(i + 1).padStart(2, '0')}
                          </span>
                          <span>{s.name}</span>
                          <b>
                            {s.score}
                            <small>/{s.max}</small>
                          </b>
                        </li>
                      ))}
                    </ol>
                    <p className="assessment-note">
                      操作失误会记录提示；纠正后仍可完成环节得分。每项只计分一次。
                    </p>
                    <button
                      className="primary full"
                      disabled={busy}
                      onClick={() =>
                        session.status === 'finished'
                          ? setReport(session)
                          : void finish()
                      }
                    >
                      {session.status === 'finished'
                        ? '查看实验报告'
                        : '结束实验 · 生成报告'}
                    </button>
                  </section>
                  <section className="event-panel">
                    <div className="panel-heading">
                      <strong>最近操作</strong>
                      <span className="subtle">自动保存</span>
                    </div>
                    {session.events
                      .slice(-3)
                      .reverse()
                      .map((e, i) => (
                        <div className="event" key={i}>
                          <i className={e.violation ? 'warn' : ''} />
                          <p>
                            {e.message}
                            <time>
                              {new Date(e.at).toLocaleTimeString('zh-CN', {
                                hour12: false,
                              })}
                            </time>
                          </p>
                        </div>
                      ))}
                    {!session.events.length && (
                      <p className="subtle">从检查实验器材开始。</p>
                    )}
                  </section>
                </aside>
              </div>
            )}
          </>
        )}
        {tab === '实验记录' && (
          <>
            <div className="page-heading">
              <div className="eyebrow">实验档案 / 自动保存</div>
              <h1>每一次练习，都有迹可循。</h1>
              <p>查看测量结果、操作过程与分项完成情况。</p>
            </div>
            <section className="history-panel">
              <table>
                <thead>
                  <tr>
                    <th>实验名称</th>
                    <th>创建时间</th>
                    <th>来源</th>
                    <th>状态</th>
                    <th>完成评分</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.label}</strong>
                        <small>{s.id.slice(0, 8)}</small>
                      </td>
                      <td>{date(s.createdAt)}</td>
                      <td>{s.source === 'demo' ? '演示记录' : '自主练习'}</td>
                      <td>
                        <span className="badge">
                          {s.status === 'finished' ? '已归档' : '进行中'}
                        </span>
                      </td>
                      <td>
                        <b>{s.score}</b> / 100
                      </td>
                      <td>
                        <button className="text-button" onClick={() => setReport(s)}>
                          查看报告
                        </button>
                        <button className="text-button" onClick={() => download(s)}>
                          导出 JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!history.length && (
                <div className="empty">还没有实验记录。前往实验台开始练习。</div>
              )}
            </section>
          </>
        )}
        {tab === '实验指南' && (
          <>
            <div className="page-heading">
              <div className="eyebrow">操作规范 / 学习指南</div>
              <h1>先调平，再测量。</h1>
              <p>这是一套本地交互练习系统，八个环节共 100 分。</p>
            </div>
            <div className="guide-grid">
              {STEP_NAMES.map((name, i) => (
                <section key={name}>
                  <span className="guide-no">{String(i + 1).padStart(2, '0')}</span>
                  <h2>
                    {name}
                    <small>{STEP_POINTS[i]} 分</small>
                  </h2>
                  <p>
                    {
                      [
                        '先检查天平、砝码、镊子及待测物体，确认器材齐全。',
                        '保持托盘空载，将游码移动到标尺的零刻度。',
                        '游码归零后，将平衡螺母调整到 0，使空载天平平衡。',
                        '完成调平后，将待测物体放在左盘，砝码放在右盘。',
                        '用镊子先试较大的砝码，过重则取回，再依次试较小的砝码。',
                        '砝码接近物体质量后，微调游码；指针居中即表示达到平衡。',
                        '物体质量等于右盘砝码质量加上游码示值，按 0.1 g 分度记录。',
                        '记录正确读数后整理器材：物体、砝码归盒，游码与螺母回零。',
                      ][i]
                    }
                  </p>
                </section>
              ))}
            </div>
            <p className="guide-disclaimer">
              评分用于练习完成情况反馈，不能替代真实实验考核。错误操作保留在报告中，纠正后可继续完成练习。
            </p>
          </>
        )}
      </main>
      <footer>
        <span>
          {SOFTWARE_NAME} {VERSION}
        </span>
        <span>本地运行 · 过程留痕 · 自主练习</span>
      </footer>
      {reset && (
        <div className="modal-backdrop">
          <section
            className="new-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-title"
          >
            <h2 id="new-title">新建一轮实验</h2>
            <p>当前记录会保留在实验记录中，新实验从初始状态开始。</p>
            <label>
              实验名称
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              记录来源
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as 'practice' | 'demo')}
              >
                <option value="practice">自主练习</option>
                <option value="demo">演示记录</option>
              </select>
            </label>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setReset(false)}>
                取消
              </button>
              <button className="primary" disabled={busy} onClick={() => void create()}>
                开始新实验
              </button>
            </div>
          </section>
        </div>
      )}
      {report && (
        <div className="modal-backdrop report-backdrop">
          <section
            className="report"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <div className="report-tools">
              <button className="secondary" onClick={() => download(report)}>
                导出 JSON
              </button>
              <button className="primary" onClick={() => window.print()}>
                打印 / 保存 PDF
              </button>
              <button className="secondary" onClick={() => setReport(null)}>
                关闭报告
              </button>
            </div>
            <div className="eyebrow">
              实验评测报告 · {report.source === 'demo' ? '演示记录' : '自主练习'}
            </div>
            <h1 id="report-title">{report.label}</h1>
            <p>
              {SOFTWARE_NAME} {VERSION}
            </p>
            <div className="report-summary">
              <div>
                <span>完成评分</span>
                <strong>{report.score} / 100</strong>
              </div>
              <div>
                <span>记录读数</span>
                <strong>
                  {report.reading === null ? '尚未记录' : grams(report.reading) + ' g'}
                </strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{report.status === 'finished' ? '已归档' : '进行中'}</strong>
              </div>
            </div>
            <p className="subtle">
              创建时间：{date(report.createdAt)}
              <br />
              结束时间：{report.finishedAt ? date(report.finishedAt) : '尚未结束'}
              <br />
              记录编号：{report.id}
            </p>
            <h2>测量结果</h2>
            <p>
              {report.measurement
                ? `右盘砝码 ${grams(report.measurement.weightTotal)} g ＋ 游码 ${grams(report.measurement.rider)} g ＝ 物体质量 ${grams(report.measurement.value)} g`
                : '尚未完成正确读数。'}
            </p>
            <h2>分项完成情况</h2>
            <table>
              <thead>
                <tr>
                  <th>实验环节</th>
                  <th>状态</th>
                  <th>得分</th>
                </tr>
              </thead>
              <tbody>
                {report.steps.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.passed ? '已完成' : '未完成'}</td>
                    <td>
                      {s.score} / {s.max}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2>完整操作记录</h2>
            <table className="report-events">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>操作反馈</th>
                </tr>
              </thead>
              <tbody>
                {report.events.map((e, i) => (
                  <tr key={i}>
                    <td>{date(e.at)}</td>
                    <td>{e.violation ? '违规提示' : '操作记录'}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-note">
              本报告为本地交互练习的完成评分。失误记录保留，纠正后允许获得环节得分；报告不代替真实实验考核。
            </p>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
