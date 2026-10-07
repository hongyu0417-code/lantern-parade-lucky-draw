import { fireEvent, render, screen, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AudioController } from './components/AudioController';
import { createDefaultRecord, DRAW_STORAGE_KEY } from './draw/persistence';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(), media: '(prefers-reduced-motion: reduce)', onchange: null }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function finishDraw() {
  act(() => { vi.advanceTimersByTime(320); });
  for (const delay of [2500, 3000, 1500, 1500, 1200, 1000, 500, 200, 600]) act(() => { vi.advanceTimersByTime(delay); });
}

describe('App draw controls', () => {
  it('reserves before animation, prevents rapid duplicate starts, and restores a winner after refresh', () => {
    const { unmount } = render(<App />);
    const start = screen.getByRole('button', { name: /开始抽奖/ });
    fireEvent.click(start);
    fireEvent.click(start);
    const first = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(first.winnerHistory).toHaveLength(1);
    expect(first.activeWinner).toEqual(first.winnerHistory[0]);
    finishDraw();
    expect(screen.getByRole('region', { name: /幸运抽奖结果/ })).toBeInTheDocument();
    unmount();
    render(<App />);
    expect(screen.getByRole('region', { name: /幸运抽奖结果/ })).toHaveTextContent(first.activeWinner.number);
    expect(document.querySelectorAll('.floating-lantern--chosen')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /下一轮抽奖/ }));
    fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
    finishDraw();
    const second = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(second.winnerHistory).toHaveLength(2);
    expect(second.winnerHistory[1].number).not.toBe(first.activeWinner.number);
  });

  it('blocks drawing and shows an inline error if storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/无法保存抽奖数据/);
    expect(screen.queryByTestId('flying-number-lanterns')).not.toBeInTheDocument();
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
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(1);
    finishDraw();
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByRole('button', { name: /开始抽奖/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('dialog', { name: /今晚的幸运得主/ })).toBeInTheDocument();
  });

  it('persists sound and requests fullscreen from controls and shortcuts', () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    render(<App />);
    fireEvent.keyDown(window, { key: 'm' });
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).settings.soundEnabled).toBe(false);
    expect(screen.getByRole('button', { name: /开启音效/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /进入全屏/ }));
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

  it('lets Space activate a focused History or Sound button without starting a draw', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<App />);
    screen.getByRole('button', { name: /中奖记录/ }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: /今晚的幸运得主/ })).toBeInTheDocument();
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /关闭中奖记录/ }));
    screen.getByRole('button', { name: /关闭音效/ }).focus();
    await user.keyboard(' ');
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).settings.soundEnabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(0);
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
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /进入全屏/ })); });
    expect(screen.getByRole('alert')).toHaveTextContent('此浏览器暂不支持全屏显示。');
  });

  it('plays launch and finalist cues at their new animation phases', () => {
    const launch = vi.spyOn(AudioController.prototype, 'playLaunchCue').mockImplementation(() => undefined);
    const finalists = vi.spyOn(AudioController.prototype, 'playFinalistsCue').mockImplementation(() => undefined);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
    expect(launch).not.toHaveBeenCalled();
    expect(finalists).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(319); });
    expect(launch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(launch).toHaveBeenCalledOnce();
    for (const delay of [2500, 3000, 1499]) act(() => { vi.advanceTimersByTime(delay); });
    expect(finalists).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(finalists).toHaveBeenCalledOnce();
  });

  it('completes twenty consecutive draws with fresh eligible rosters and one saved winner each time', () => {
    const pool = Array.from({ length: 40 }, (_, index) => ({ number: String(index + 1).padStart(3, '0'), name: `Guest ${index + 1}` }));
    const record = createDefaultRecord();
    record.settings.startNumber = '001';
    record.settings.endNumber = '040';
    record.settings.participants = pool;
    record.availableNumbers = pool;
    localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify(record));
    render(<App />);

    const winners = new Set<string>();
    const rosters = new Set<string>();
    const trios = new Set<string>();
    for (let drawIndex = 0; drawIndex < 20; drawIndex += 1) {
      const before = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
      fireEvent.click(screen.getByRole('button', { name: /开始抽奖/ }));
      act(() => { vi.advanceTimersByTime(320); });
      const saved = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
      const winnerNumber = saved.activeWinner.number as string;
      const candidateNodes = screen.getAllByRole('listitem');
      const visibleNumbers = candidateNodes.map((node) => node.getAttribute('data-number')!);

      expect(screen.queryByRole('button', { name: /抽奖设置/ })).not.toBeInTheDocument();
      expect(saved.winnerHistory).toHaveLength(drawIndex + 1);
      expect(saved.activeWinner).toEqual(saved.winnerHistory.at(-1));
      expect(visibleNumbers.length).toBeGreaterThanOrEqual(20);
      expect(visibleNumbers.length).toBeLessThanOrEqual(36);
      expect(new Set(visibleNumbers).size).toBe(visibleNumbers.length);
      expect(visibleNumbers).toContain(winnerNumber);
      expect(visibleNumbers.every((number) => before.availableNumbers.some((person: { number: string }) => person.number === number))).toBe(true);
      expect(visibleNumbers.every((number) => !winners.has(number))).toBe(true);
      rosters.add([...visibleNumbers].sort().join(','));

      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: ' ' });
      expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(drawIndex + 1);

      for (const delay of [2500, 3000, 1500]) act(() => { vi.advanceTimersByTime(delay); });
      const finalists = screen.getAllByRole('listitem');
      expect(finalists).toHaveLength(3);
      expect(finalists.map((lantern) => lantern.getAttribute('data-number'))).toContain(winnerNumber);
      expect(finalists.every((lantern) => lantern.getAttribute('data-finalist') === 'true')).toBe(true);
      trios.add(finalists.map((lantern) => lantern.getAttribute('data-number')).sort().join(','));

      act(() => { vi.advanceTimersByTime(1500); });
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      expect(document.querySelectorAll('.flying-number-lantern--finalist-leaving')).toHaveLength(2);

      act(() => { vi.advanceTimersByTime(1200); });
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByRole('listitem').getAttribute('data-number')).toBe(winnerNumber);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(document.querySelector('.flying-number-lantern--charging')).toHaveAttribute('data-number', winnerNumber);
      act(() => { vi.advanceTimersByTime(500); });
      expect(screen.queryByTestId('flying-number-lanterns__emergence')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('lantern-burst-fragment')).toHaveLength(20);
      act(() => { vi.advanceTimersByTime(200); });
      expect(screen.getByTestId('flying-number-lanterns__emergence')).toHaveTextContent(winnerNumber);
      act(() => { vi.advanceTimersByTime(600); });

      const winnerScreen = screen.getByRole('region', { name: /幸运抽奖结果/ });
      expect(winnerScreen).toHaveTextContent(winnerNumber);
      winners.add(winnerNumber);
      fireEvent.click(screen.getByRole('button', { name: /下一轮抽奖/ }));
      expect(screen.queryByTestId('flying-number-lanterns')).not.toBeInTheDocument();
    }
    expect(winners.size).toBe(20);
    expect(rosters.size).toBe(20);
    expect(trios.size).toBe(20);
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(20);
  });

  it('uses browser cryptographic randomness when reserving each draw', () => {
    const cryptoRandom = vi.spyOn(window.crypto, 'getRandomValues');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /draw a lucky lantern|开始抽奖/i }));
    expect(cryptoRandom).toHaveBeenCalled();
  });
});
