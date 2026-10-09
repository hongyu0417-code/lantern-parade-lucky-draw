import { fireEvent, render, screen, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AudioController } from './components/AudioController';
import { createDefaultRecord, DRAW_STORAGE_KEY } from './draw/persistence';

let pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let frameTime = 0;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(), media: '(prefers-reduced-motion: reduce)', onchange: null }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  pendingFrames = new Map();
  nextFrameId = 1;
  frameTime = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { pendingFrames.delete(id); });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function stepFrame(stepMs = 32) {
  frameTime += stepMs;
  const frames = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => {
    vi.advanceTimersByTime(stepMs);
    frames.forEach((callback) => callback(frameTime));
  });
}

function advanceUntil(predicate: () => boolean, timeoutMs = 24_000) {
  const deadline = frameTime + timeoutMs;
  while (!predicate() && frameTime < deadline) stepFrame();
  expect(predicate(), `Draw remained in ${document.querySelector('main')?.dataset.screen ?? 'no screen'}`).toBe(true);
}

function startAndWaitUntilRunning() {
  fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
  advanceUntil(() => document.querySelector('main')?.dataset.screen === 'running');
}

function stopAndWaitForWinner() {
  fireEvent.keyDown(window, { key: ' ' });
  advanceUntil(() => document.querySelector('main')?.dataset.screen === 'winner');
}

describe('App draw controls', () => {
  it('reserves before animation, prevents rapid duplicate starts, and restores a winner after refresh', () => {
    const { unmount } = render(<App />);
    const start = screen.getByRole('button', { name: /开始抽奖/ });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY) ?? 'null')).toBeNull();
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'running');
    fireEvent.keyDown(window, { key: ' ' });
    const first = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(first.winnerHistory).toHaveLength(1);
    expect(first.activeWinner).toEqual(first.winnerHistory[0]);
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'winner');
    expect(screen.getByRole('region', { name: /幸运抽奖结果/ })).toBeInTheDocument();
    unmount();
    render(<App />);
    expect(screen.getByRole('region', { name: /幸运抽奖结果/ })).toHaveTextContent(first.activeWinner.number);
    expect(document.querySelectorAll('.floating-lantern--chosen')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /下一轮抽奖/ }));
    startAndWaitUntilRunning();
    fireEvent.keyDown(window, { key: ' ' });
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'winner');
    const second = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(second.winnerHistory).toHaveLength(2);
    expect(second.winnerHistory[1].number).not.toBe(first.activeWinner.number);
  });

  it('blocks drawing and shows an inline error if storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    render(<App />);
    startAndWaitUntilRunning();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('alert')).toHaveTextContent(/无法保存抽奖数据/);
    expect(document.querySelector('main')).toHaveAttribute('data-screen', 'running');
  });

  it('shows a save failure inside operator settings without changing the saved pool', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.change(screen.getByRole('textbox', { name: /结束号码/ }), { target: { value: '450' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    fireEvent.click(screen.getByRole('button', { name: /保存抽奖名单/ }));
    expect(screen.getByRole('dialog', { name: /抽奖设置/ }).querySelector('[role="alert"]')).toHaveTextContent(/无法保存抽奖数据/);
    expect(screen.getByRole('textbox', { name: /结束号码/ })).toHaveValue('450');
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
  });

  it('keeps an unsaved form draft and shows an error when confirmed reset cannot persist', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.change(screen.getByRole('textbox', { name: /导入参与者名单/ }), { target: { value: '777,Draft' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    fireEvent.click(screen.getByRole('button', { name: /全部重置/ }));
    expect(screen.getByRole('textbox', { name: /导入参与者名单/ })).toHaveValue('777,Draft');
    expect(screen.getByRole('dialog', { name: /抽奖设置/ }).querySelector('[role="alert"]')).toHaveTextContent(/无法保存抽奖数据/);
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
  });

  it('uses shortcuts outside editable fields and ignores Space during a draw', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.getByRole('dialog', { name: /抽奖设置/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: /起始号码/ }), { key: ' ' });
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ' });
    startAndWaitUntilRunning();
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(1);
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'winner');
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByRole('button', { name: /开始抽奖/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('dialog', { name: /今晚的幸运得主/ })).toBeInTheDocument();
  });

  it('accepts Space immediately after the lantern stream starts', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
    expect(document.querySelector('main')).toHaveAttribute('data-screen', 'preparing');
    fireEvent.keyDown(window, { key: ' ' });

    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(1);
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'finalists3');
    expect(document.querySelectorAll('.flying-number-lantern[data-finalist="true"]').length).toBe(3);
  });

  it('keeps the public screen free of operator controls and keeps hidden shortcuts working', () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    render(<App />);
    expect(screen.queryByRole('button', { name: /进入全屏|关闭音效|中奖记录|抽奖设置/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'm' });
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).settings.soundEnabled).toBe(false);
    fireEvent.keyDown(window, { key: 'f' });
    expect(requestFullscreen).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'f' });
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it('shows recovery guidance for an exhausted pool', () => {
    const record = createDefaultRecord();
    record.settings.startNumber = '001';
    record.settings.endNumber = '001';
    record.winnerHistory = [{ number: '001', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }];
    record.availableNumbers = [];
    localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify(record));
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/调整号码范围或重置中奖记录/);
    expect(screen.getByRole('button', { name: /开始抽奖/ })).toBeDisabled();
  });

  it('keeps public keyboard shortcuts out of editable fields', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole('button', { name: /中奖记录|关闭音效|进入全屏/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'a' });
    const startNumber = screen.getByRole('textbox', { name: /起始号码/ });
    startNumber.focus();
    await user.keyboard(' ');
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('dialog', { name: /今晚的幸运得主/ })).toBeInTheDocument();
  });

  it('clears the participant form when confirmed reset all restores default data', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.change(screen.getByRole('textbox', { name: /导入参与者名单/ }), {
      target: { value: '001,Amina Lee\n002,Ben Tan' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存抽奖名单/ }));
    expect(screen.getByRole('textbox', { name: /导入参与者名单/ })).toHaveValue('001,Amina Lee\n002,Ben Tan');

    fireEvent.click(screen.getByRole('button', { name: /全部重置/ }));

    expect(confirm).toHaveBeenCalledWith('确定要重置全部抽奖数据、设置和已导入名单吗？');
    expect(screen.getByRole('textbox', { name: /导入参与者名单/ })).toHaveValue('');
  });

  it('shows an inline notice when the Fullscreen API is unavailable', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: undefined });
    render(<App />);
    await act(async () => { fireEvent.keyDown(window, { key: 'f' }); });
    expect(screen.getByRole('alert')).toHaveTextContent('此浏览器暂不支持全屏显示。');
  });

  it('sends audio events from draw start, run, Space, and motion-complete milestones', () => {
    const motionEvent = vi.spyOn(AudioController.prototype, 'onMotionEvent');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
    expect(motionEvent).toHaveBeenCalledWith('launch');
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'running');
    expect(motionEvent).toHaveBeenCalledWith('running');
    fireEvent.keyDown(window, { key: ' ' });
    expect(motionEvent).toHaveBeenCalledWith('space-stop');
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'finalists3');
    expect(motionEvent).toHaveBeenCalledWith('finalists3');
  });

  it('moves from the Final 3 hold through one coordinated exit sequence without showing Final 2', () => {
    const motionEvent = vi.spyOn(AudioController.prototype, 'onMotionEvent');
    render(<App />);
    startAndWaitUntilRunning();
    fireEvent.keyDown(window, { key: ' ' });
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'finalists3');

    const seenPhases: string[] = [];
    const deadline = frameTime + 18_000;
    while (document.querySelector('main')?.dataset.screen !== 'finalist1' && frameTime < deadline) {
      stepFrame();
      const phase = document.querySelector('main')?.dataset.screen;
      if (phase) seenPhases.push(phase);
    }

    expect(document.querySelector('main')?.dataset.screen).toBe('finalist1');
    expect(seenPhases).not.toContain('finalists2');
    expect(document.querySelectorAll('.flying-number-lantern[data-active="true"][data-finalist="true"]')).toHaveLength(1);
    expect(motionEvent).toHaveBeenCalledWith('losers-exit');
  });

  it('reserves exactly one winner from the complete eligible pool when Space is pressed', () => {
    const pool = Array.from({ length: 40 }, (_, index) => ({ number: String(index + 1).padStart(3, '0'), name: `Guest ${index + 1}` }));
    const record = createDefaultRecord();
    record.settings.startNumber = '001';
    record.settings.endNumber = '040';
    record.settings.participants = pool;
    record.availableNumbers = pool;
    localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify(record));
    render(<App />);
    startAndWaitUntilRunning();
    const before = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(before.winnerHistory).toHaveLength(0);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ' });
    const saved = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(saved.winnerHistory).toHaveLength(1);
    expect(saved.activeWinner).toEqual(saved.winnerHistory[0]);
    expect(before.availableNumbers.map(({ number }: { number: string }) => number)).toContain(saved.activeWinner.number);
    stopAndWaitForWinner();
    expect(screen.getByRole('region', { name: /幸运抽奖结果/ })).toHaveTextContent(saved.activeWinner.number);
  });

  it('uses browser cryptographic randomness when reserving each draw', () => {
    const cryptoRandom = vi.spyOn(window.crypto, 'getRandomValues');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /draw a lucky lantern|开始抽奖/i }));
    advanceUntil(() => document.querySelector('main')?.dataset.screen === 'running');
    fireEvent.keyDown(window, { key: ' ' });
    expect(cryptoRandom).toHaveBeenCalled();
  });
});
