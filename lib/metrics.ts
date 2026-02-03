export type MetricChange = {
  delta: number;
  percentage: number | null;
};

export type ChangeDescriptor = {
  text: string;
  type: 'positive' | 'negative';
};

type DescribeChangeOptions = {
  descriptor: string;
  formatter?: (value: number) => string;
  fallbackText?: string;
};

export function describeChange(
  change: MetricChange | undefined,
  { descriptor, formatter, fallbackText = 'No prior data' }: DescribeChangeOptions,
): ChangeDescriptor {
  if (!change) {
    return { text: fallbackText, type: 'positive' };
  }

  const isPositive = change.delta >= 0;
  const sign = isPositive ? '+' : '-';

  if (change.percentage !== null) {
    const percentageValue = Math.abs(change.percentage).toFixed(1);
    return { text: `${sign}${percentageValue}% ${descriptor}`, type: isPositive ? 'positive' : 'negative' };
  }

  const absoluteDelta = Math.abs(change.delta);
  const formattedDelta = formatter ? formatter(absoluteDelta) : absoluteDelta.toLocaleString();

  return {
    text: `${sign}${formattedDelta} ${descriptor}`,
    type: isPositive ? 'positive' : 'negative',
  };
}
