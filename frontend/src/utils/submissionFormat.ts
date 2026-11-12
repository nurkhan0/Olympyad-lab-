const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python 3',
  cpp: 'C++17',
  java: 'Java 17',
};

export function formatLanguage(language: string): string {
  return LANGUAGE_LABELS[language] ?? language;
}

export function formatTime(timeMs: number | null, verdict: string | null): string {
  if (timeMs == null) {
    return '—';
  }
  const value = `${timeMs} ms`;
  return verdict === 'AC' ? value : value;
}

export function formatTimeClass(verdict: string | null): string {
  return verdict === 'AC' ? 'text-gray-900' : 'text-gray-400';
}

export function formatMemory(memoryKb: number | null): string {
  if (memoryKb == null) {
    return '—';
  }
  const mb = memoryKb / 1024;
  return `${mb.toFixed(1)} MB`;
}
