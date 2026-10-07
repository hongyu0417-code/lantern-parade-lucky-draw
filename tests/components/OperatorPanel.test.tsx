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

    expect(screen.getByRole('dialog', { name: '抽奖设置' })).toBeInTheDocument();
    expect(screen.getByLabelText('起始号码')).toHaveValue('001');
    expect(screen.getByLabelText('结束号码')).toHaveValue('300');
    expect(screen.getAllByText('300')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('起始号码'), { target: { value: '010' } });
    fireEvent.click(screen.getByLabelText('防止重复中奖'));
    fireEvent.click(screen.getByRole('button', { name: '保存抽奖名单' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ startNumber: '010', endNumber: '300', preventDuplicates: false, participants: null }));
  });

  it('uses an imported CSV as the active pool and reports malformed rows', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={settings} remainingCount={300} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);
    const textarea = screen.getByLabelText('导入参与者名单');
    fireEvent.change(textarea, { target: { value: 'NUMBER,NAME\n001,Amina\n002,Ben' } });
    fireEvent.click(screen.getByRole('button', { name: '保存抽奖名单' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: [{ number: '001', name: 'Amina' }, { number: '002', name: 'Ben' }] }));

    fireEvent.change(textarea, { target: { value: 'NUMBER,NAME\n001,"Amina\n002,Ben' } });
    fireEvent.click(screen.getByRole('button', { name: '保存抽奖名单' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/引号未闭合/i);
    expect(actions.onSave).toHaveBeenCalledTimes(1);
  });

  it('preserves imported names containing commas when settings are reopened', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={{ ...settings, participants: [{ number: '007', name: 'Amina, Lee' }] }} remainingCount={1} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: '保存抽奖名单' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: [{ number: '007', name: 'Amina, Lee' }] }));
  });

  it('keeps full Instagram usernames in the admin import and export field', () => {
    const actions = callbacks();
    const username = '@thisisaverylongusername';
    render(<OperatorPanel settings={{ ...settings, participants: [{ number: username }, { number: 'jason_tan03' }] }} remainingCount={2} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);
    const textarea = screen.getByLabelText('导入参与者名单');

    expect(textarea).toHaveValue(`${username}\njason_tan03`);
    fireEvent.click(screen.getByRole('button', { name: '保存抽奖名单' }));
    expect(actions.onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: [{ number: username }, { number: 'jason_tan03' }] }));
  });

  it('shows parent validation errors and confirms reset actions', () => {
    const actions = callbacks();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);
    render(<OperatorPanel settings={settings} remainingCount={299} winnerCount={1} isDrawActive={false} validationErrors={['无法保存抽奖数据。']} {...actions} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无法保存抽奖数据。');
    fireEvent.click(screen.getByRole('button', { name: '撤销上一轮' }));
    expect(actions.onUndo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '重置中奖记录' }));
    expect(actions.onResetHistory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重置中奖记录' }));
    expect(actions.onResetHistory).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '全部重置' }));
    expect(actions.onResetAll).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('disables state-changing controls during an active draw', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={settings} remainingCount={299} winnerCount={1} isDrawActive validationErrors={[]} {...actions} />);
    expect(screen.getByRole('button', { name: '保存抽奖名单' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '撤销上一轮' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重置中奖记录' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '全部重置' })).toBeDisabled();
  });

  it('shows an inline range-cap error and does not submit an oversized range', () => {
    const actions = callbacks();
    render(<OperatorPanel settings={settings} remainingCount={300} winnerCount={0} isDrawActive={false} validationErrors={[]} {...actions} />);
    fireEvent.change(screen.getByLabelText('起始号码'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('结束号码'), { target: { value: '10001' } });
    fireEvent.click(screen.getByRole('button', { name: '保存抽奖名单' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/10,?000/);
    expect(actions.onSave).not.toHaveBeenCalled();
  });

  it('starts keyboard focus inside the panel and keeps Tab within it', () => {
    render(<OperatorPanel settings={settings} remainingCount={300} winnerCount={0} isDrawActive={false} validationErrors={[]} {...callbacks()} />);
    const close = screen.getByRole('button', { name: '关闭抽奖设置' });
    const resetAll = screen.getByRole('button', { name: '全部重置' });
    expect(close).toHaveFocus();
    resetAll.focus();
    fireEvent.keyDown(resetAll, { key: 'Tab' });
    expect(close).toHaveFocus();
  });
});
