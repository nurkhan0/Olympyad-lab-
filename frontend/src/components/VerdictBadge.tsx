interface Props {
  verdict: string | null;
  status?: 'pending' | 'judging' | 'done' | 'error';
}

const VERDICT_CONFIG: Record<
  string,
  { label: string; className: string; pulse?: boolean }
> = {
  AC: {
    label: 'Accepted',
    className: 'border border-green-300 bg-green-100 text-green-800',
  },
  WA: {
    label: 'Wrong Answer',
    className: 'border border-red-300 bg-red-100 text-red-800',
  },
  TLE: {
    label: 'Time Limit',
    className: 'bg-orange-100 text-orange-800',
  },
  MLE: {
    label: 'Memory Limit',
    className: 'bg-orange-100 text-orange-800',
  },
  RE: {
    label: 'Runtime Error',
    className: 'bg-red-100 text-red-800',
  },
  CE: {
    label: 'Compile Error',
    className: 'bg-yellow-100 text-yellow-800',
  },
  pending: {
    label: 'Pending',
    className: 'bg-gray-100 text-gray-500',
    pulse: true,
  },
  judging: {
    label: 'Judging...',
    className: 'bg-blue-100 text-blue-700',
    pulse: true,
  },
};

export default function VerdictBadge({ verdict, status }: Props) {
  const key =
    verdict ??
    (status === 'pending' || status === 'judging' ? status : null) ??
    (status === 'error' ? 'RE' : null);

  if (!key) {
    return (
      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
        —
      </span>
    );
  }

  const config = VERDICT_CONFIG[key] ?? {
    label: key,
    className: 'bg-gray-100 text-gray-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${config.className} ${
        config.pulse ? 'animate-pulse' : ''
      }`}
    >
      {config.label}
    </span>
  );
}
