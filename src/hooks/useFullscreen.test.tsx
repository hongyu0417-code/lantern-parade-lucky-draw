import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFullscreen } from './useFullscreen';

function Fixture() {
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();
  return <><span>{isFullscreen ? 'full' : 'windowed'}</span><button onClick={enterFullscreen}>Enter</button><button onClick={exitFullscreen}>Exit</button></>;
}

describe('useFullscreen', () => {
  it('requests fullscreen and follows fullscreenchange', () => {
    const enter = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: enter });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    render(<Fixture />);
    fireEvent.click(screen.getByText('Enter'));
    expect(enter).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.documentElement });
    fireEvent(document, new Event('fullscreenchange'));
    expect(screen.getByText('full')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Exit'));
    expect(exit).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    fireEvent(document, new Event('fullscreenchange'));
    expect(screen.getByText('windowed')).toBeInTheDocument();
  });
});
