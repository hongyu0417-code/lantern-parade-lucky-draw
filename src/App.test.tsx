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
  for (const delay of [1100, 2200, 1400, 1400]) act(() => { vi.advanceTimersByTime(delay); });
}

describe('App draw controls', () => {
  it('reserves before animation, prevents rapid duplicate starts, and restores a winner after refresh', () => {
    const { unmount } = render(<App />);
    const start = screen.getByRole('button', { name: /draw a lucky lantern/i });
    fireEvent.click(start);
    fireEvent.click(start);
    const first = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(first.winnerHistory).toHaveLength(1);
    expect(first.activeWinner).toEqual(first.winnerHistory[0]);
    finishDraw();
    expect(screen.getByRole('region', { name: /lucky draw winner/i })).toBeInTheDocument();
    unmount();
    render(<App />);
    expect(screen.getByRole('region', { name: /lucky draw winner/i })).toHaveTextContent(first.activeWinner.number);
    fireEvent.click(screen.getByRole('button', { name: /next draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /draw a lucky lantern/i }));
    finishDraw();
    const second = JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!);
    expect(second.winnerHistory).toHaveLength(2);
    expect(second.winnerHistory[1].number).not.toBe(first.activeWinner.number);
  });

  it('blocks drawing and shows an inline error if storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /draw a lucky lantern/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/save|storage/i);
    expect(screen.queryByLabelText(/drawing in progress/i)).not.toBeInTheDocument();
  });

  it('shows a save failure inside operator settings without changing the saved pool', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.change(screen.getByRole('textbox', { name: /end number/i }), { target: { value: '450' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    fireEvent.click(screen.getByRole('button', { name: /save draw pool/i }));
    expect(screen.getByRole('dialog', { name: /operator settings/i }).querySelector('[role="alert"]')).toHaveTextContent(/save|storage/i);
    expect(screen.getByRole('textbox', { name: /end number/i })).toHaveValue('450');
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
  });

  it('keeps an unsaved form draft and shows an error when confirmed reset cannot persist', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.change(screen.getByRole('textbox', { name: /participants csv/i }), { target: { value: '777,Draft' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    fireEvent.click(screen.getByRole('button', { name: /reset all draw data/i }));
    expect(screen.getByRole('textbox', { name: /participants csv/i })).toHaveValue('777,Draft');
    expect(screen.getByRole('dialog', { name: /operator settings/i }).querySelector('[role="alert"]')).toHaveTextContent(/save|storage/i);
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
  });

  it('uses shortcuts outside editable fields and ignores Space during a draw', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.getByRole('dialog', { name: /operator settings/i })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: /start number/i }), { key: ' ' });
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(1);
    finishDraw();
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByRole('button', { name: /draw a lucky lantern/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('dialog', { name: /winner history/i })).toBeInTheDocument();
  });

  it('persists sound and requests fullscreen from controls and shortcuts', () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    render(<App />);
    fireEvent.keyDown(window, { key: 'm' });
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).settings.soundEnabled).toBe(false);
    expect(screen.getByRole('button', { name: /enable sound/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /enter fullscreen/i }));
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
    expect(screen.getByRole('status')).toHaveTextContent(/change the range or reset draw history/i);
    expect(screen.getByRole('button', { name: /draw a lucky lantern/i })).toBeDisabled();
  });

  it('lets Space activate a focused History or Sound button without starting a draw', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<App />);
    screen.getByRole('button', { name: /winner history/i }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: /winner history/i })).toBeInTheDocument();
    expect(localStorage.getItem(DRAW_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /close winner history/i }));
    screen.getByRole('button', { name: /mute sound/i }).focus();
    await user.keyboard(' ');
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).settings.soundEnabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY)!).winnerHistory).toHaveLength(0);
  });

  it('clears the participant form when confirmed reset all restores default data', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.change(screen.getByRole('textbox', { name: /participants csv/i }), {
      target: { value: '001,Amina Lee\n002,Ben Tan' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save draw pool/i }));
    expect(screen.getByRole('textbox', { name: /participants csv/i })).toHaveValue('001,Amina Lee\n002,Ben Tan');

    fireEvent.click(screen.getByRole('button', { name: /reset all draw data/i }));

    expect(confirm).toHaveBeenCalledWith('Reset all draw data, including settings and imported participants?');
    expect(screen.getByRole('textbox', { name: /participants csv/i })).toHaveValue('');
  });

  it('shows an inline notice when the Fullscreen API is unavailable', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: undefined });
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /enter fullscreen/i })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Fullscreen is unavailable in this browser.');
  });

  it('plays a selection cue when the draw reaches the selection phase', () => {
    const selection = vi.spyOn(AudioController.prototype, 'playSelectionCue').mockImplementation(() => undefined);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /draw a lucky lantern/i }));
    act(() => { vi.advanceTimersByTime(1100); });
    expect(selection).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2200); });
    expect(selection).toHaveBeenCalledOnce();
  });
});
