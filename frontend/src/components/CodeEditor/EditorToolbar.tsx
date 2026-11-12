import type { EditorLanguage } from './constants';
import { FONT_SIZES, LANGUAGE_OPTIONS } from './constants';

export type EditorTheme = 'vs-dark' | 'light';

interface EditorToolbarProps {
  language: EditorLanguage;
  fontSize: number;
  theme: EditorTheme;
  onLanguageChange: (lang: EditorLanguage) => void;
  onFontSizeChange: (size: number) => void;
  onThemeToggle: () => void;
  onTest?: () => void;
  onSubmit: () => void;
}

export default function EditorToolbar({
  language,
  fontSize,
  theme,
  onLanguageChange,
  onFontSizeChange,
  onThemeToggle,
  onTest,
  onSubmit,
}: EditorToolbarProps) {
  const isDark = theme === 'vs-dark';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-[#252526]">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as EditorLanguage)}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-[#3c3c3c] dark:text-gray-100"
          aria-label="Language"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-[#3c3c3c] dark:text-gray-100"
          aria-label="Font size"
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onThemeToggle}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-[#3c3c3c] dark:text-gray-200 dark:hover:bg-[#4a4a4a]"
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? '☀ Light' : '🌙 Dark'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-[#3c3c3c] dark:text-gray-200 dark:hover:bg-[#4a4a4a]"
          >
            Test (sample)
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Submit ↵ Ctrl+Enter
        </button>
      </div>
    </div>
  );
}
