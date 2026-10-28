import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthLockedDatePicker } from '../components/MonthLockedDatePicker';

describe('MonthLockedDatePicker Component', () => {
  it('renders trigger button with current value and locked month badge', () => {
    const handleChange = vi.fn();
    render(<MonthLockedDatePicker value="2026-01-02" onChange={handleChange} />);

    expect(screen.getByTestId('month-locked-date-trigger')).toHaveTextContent('2026-01-02');
    expect(screen.getByText("Jan '26")).toBeInTheDocument();
  });

  it('opens calendar popover and locks header to January 2026 with disabled navigation', () => {
    const handleChange = vi.fn();
    render(<MonthLockedDatePicker value="2026-01-02" onChange={handleChange} />);

    // Initially closed
    expect(screen.queryByTestId('month-locked-calendar-popover')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByTestId('month-locked-date-trigger'));

    expect(screen.getByTestId('month-locked-calendar-popover')).toBeInTheDocument();
    expect(screen.getByText('January 2026')).toBeInTheDocument();
    expect(screen.getByText(/scope constrained: jan 1–31, 2026/i)).toBeInTheDocument();

    // Chevrons must be disabled
    const prevBtn = screen.getByLabelText('Previous month disabled');
    const nextBtn = screen.getByLabelText('Next month disabled');
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('renders all 31 days of January 2026 as interactive buttons', () => {
    const handleChange = vi.fn();
    render(<MonthLockedDatePicker value="2026-01-02" onChange={handleChange} />);

    fireEvent.click(screen.getByTestId('month-locked-date-trigger'));

    for (let day = 1; day <= 31; day++) {
      const dayBtn = screen.getByTestId(`calendar-day-${day}`);
      expect(dayBtn).toBeInTheDocument();
      expect(dayBtn).not.toBeDisabled();
    }
  });

  it('calls onChange with YYYY-MM-DD formatted date and closes popover on selection', () => {
    const handleChange = vi.fn();
    render(<MonthLockedDatePicker value="2026-01-02" onChange={handleChange} />);

    fireEvent.click(screen.getByTestId('month-locked-date-trigger'));

    const day15 = screen.getByTestId('calendar-day-15');
    fireEvent.click(day15);

    expect(handleChange).toHaveBeenCalledWith('2026-01-15');
    expect(screen.queryByTestId('month-locked-calendar-popover')).not.toBeInTheDocument();
  });

  it('closes calendar when Escape key is pressed', () => {
    const handleChange = vi.fn();
    render(<MonthLockedDatePicker value="2026-01-02" onChange={handleChange} />);

    fireEvent.click(screen.getByTestId('month-locked-date-trigger'));
    expect(screen.getByTestId('month-locked-calendar-popover')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('month-locked-calendar-popover')).not.toBeInTheDocument();
  });
});
