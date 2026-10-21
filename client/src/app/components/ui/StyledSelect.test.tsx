import { useState } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StyledSelect } from './StyledSelect';

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
afterEach(cleanup);
const options = [{ value: '', label: 'All statuses' }, { value: 'read', label: 'Read' }, { value: 'archived', label: 'Archived', disabled: true }];
function Picker() { const [value, setValue] = useState(''); return <StyledSelect value={value} onChange={setValue} label="Status" options={options} />; }
it('selects by keyboard and restores focus on Escape', async () => {
  const user = userEvent.setup(); render(<Picker />);
  await user.tab(); await user.keyboard('{Enter}');
  await screen.findByRole('listbox'); await user.keyboard('{ArrowDown}{Enter}');
  expect(screen.getByRole('combobox')).toHaveTextContent('Read');
  await user.keyboard('{Enter}{Escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  expect(screen.getByRole('combobox')).toHaveFocus();
});
it('supports the empty all-filter option and does not emit a change on open', async () => {
  const user = userEvent.setup(), change = vi.fn();
  render(<StyledSelect value="read" onChange={change} label="Status" options={options} isDark />);
  await user.tab(); await user.keyboard('{Enter}');
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole('option', { name: 'All statuses' }));
  expect(change).toHaveBeenCalledWith('');
});
