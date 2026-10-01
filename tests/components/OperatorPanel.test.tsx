import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrawSettings } from '../../src/draw/types';
import { OperatorPanel } from '../../src/components/OperatorPanel';

const settings: DrawSettings = {
  startNumber: '001', endNumber: '300', participants: null,
  preventDuplicates: true, soundEnabled: true,
};

const callbacks = () => ({
  onSave: vi.fn(), onUndo: vi.fn(), onResetHistory: vi.fn(), onResetAll: vi.fn(), onClose: vi.fn(),
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('OperatorPanel', () => {
  it('labels fields, shows counts, and saves a valid range and duplicate choice', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={settings} remainingCount={300} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);

    expect(screen.getByRole('dialog', { name: 'Operator settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start number')).toHaveValue('001');
    expect(screen.getByLabelText('End number')).toHaveValue('300');
    expect(screen.getAllByText('300')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Start number'), { target: { value: '010' } });
    fireEvent.click(screen.getByLabelText('Prevent duplicate winners'));
    fireEvent.click(screen.getByRole('button', { name: 'Save draw pool' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ startNumber: '010', endNumber: '300', preventDuplicates: false, participants: null }));
  });

  it('uses an imported CSV as the active pool and reports malformed rows', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={settings} remainingCount={300} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);
    const textarea = screen.getByLabelText('Participants CSV');
    fireEvent.change(textarea, { target: { value: 'NUMBER,NAME\n001,Amina\n002,Ben' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draw pool' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: [{ number: '001', name: 'Amina' }, { number: '002', name: 'Ben' }] }));

    fireEvent.change(textarea, { target: { value: 'NUMBER,NAME\n001,"Amina\n002,Ben' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draw pool' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/unclosed quote/i);
    expect(actions.onSave).toHaveBeenCalledTimes(1);
  });

  it('preserves imported names containing commas when settings are reopened', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={{ ...settings, participants: [{ number: '007', name: 'Amina, Lee' }] }} remainingCount={1} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save draw pool' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: [{ number: '007', name: 'Amina, Lee' }] }));
  });

  it('shows parent validation errors and confirms reset actions', () => {
    const actions = callbacks();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);
    render(<OperatorPanel settings={settings} remainingCount={299} winnerCount={1} isDrawActive={false} validationErrors={['Could not save draw data.']} {...actions} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save draw data.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last draw' }));
    expect(actions.onUndo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Reset draw history' }));
    expect(actions.onResetHistory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset draw history' }));
    expect(actions.onResetHistory).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all draw data' }));
    expect(actions.onResetAll).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('disables state-changing controls during an active draw', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={settings} remainingCount={299} winnerCount={1} isDrawActive validationErrors={[]} {...actions} />);
    expect(screen.getByRole('button', { name: 'Save draw pool' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo last draw' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset draw history' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset all draw data' })).toBeDisabled();
  });

  it('starts keyboard focus inside the panel and keeps Tab within it', () => {
    render(<OperatorPanel settings={settings} remainingCount={300} winnerCount={0} isDrawActive={false} validationErrors={[]} {...callbacks()} />);
    const close = screen.getByRole('button', { name: 'Close operator settings' });
    const resetAll = screen.getByRole('button', { name: 'Reset all draw data' });
    expect(close).toHaveFocus();
    resetAll.focus();
    fireEvent.keyDown(resetAll, { key: 'Tab' });
    expect(close).toHaveFocus();
  });
});
