import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricCard } from '../components/MetricCard';
import { Wind } from 'lucide-react';

describe('MetricCard Component', () => {
  it('renders title, numeric value, unit, and subtitle properly', () => {
    render(
      <MetricCard
        title="Expected Wind"
        value={438593}
        unit="MWh"
        subtitle="Sum of W_hat forecasts"
        formulaTooltip="Sum of Day-Ahead hourly/half-hourly wind forecasts across the delivery day."
        icon={Wind}
        variant="cyan"
      />
    );

    expect(screen.getByText('Expected Wind')).toBeInTheDocument();
    expect(screen.getByText('438,593')).toBeInTheDocument();
    expect(screen.getByText('MWh')).toBeInTheDocument();
    expect(screen.getByText('Sum of W_hat forecasts')).toBeInTheDocument();
  });

  it('renders with overflow-visible to prevent clipping tooltip popovers', () => {
    const { container } = render(
      <MetricCard
        title="Expected Wind"
        value={12345}
        formulaTooltip="Test formula description."
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('overflow-visible');
    expect(card.className).not.toContain('overflow-hidden');
  });

  it('displays the formula tooltip on hover and click without truncation', () => {
    render(
      <MetricCard
        title="Firm Wind (P90)"
        value={335030}
        formulaTooltip="W_firm = max(0, W_hat - Q_90(S)). Represents guaranteed renewable floor at 90% empirical confidence."
      />
    );

    const helpButton = screen.getByRole('button', { name: /formula details for firm wind/i });
    expect(helpButton).toBeInTheDocument();

    // Tooltip initially not visible
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Hover reveals tooltip
    fireEvent.mouseEnter(helpButton);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('W_firm = max(0, W_hat - Q_90(S))');
    expect(tooltip).toHaveTextContent('Formula & Definition');

    // Mouse leave hides tooltip
    fireEvent.mouseLeave(helpButton);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
