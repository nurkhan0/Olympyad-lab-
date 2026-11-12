import type { UserStatus } from '../types/problem';

const CONFIG: Record<NonNullable<UserStatus> | 'null', { symbol: string; className: string }> = {
  solved: { symbol: '✓', className: 'text-emerald-600' },
  attempted: { symbol: '~', className: 'text-yellow-500' },
  todo: { symbol: '⊙', className: 'text-blue-500' },
  null: { symbol: '·', className: 'text-gray-300' },
};

interface Props {
  status: UserStatus;
}

export default function StatusIcon({ status }: Props) {
  const key = status ?? 'null';
  const { symbol, className } = CONFIG[key];

  return (
    <span className={`inline-flex w-5 justify-center text-base font-semibold ${className}`} aria-hidden="true">
      {symbol}
    </span>
  );
}
