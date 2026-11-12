import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useState } from 'react';

import type { EditorLanguage } from './constants';
import { MONACO_LANGUAGE } from './constants';
import EditorToolbar, { type EditorTheme } from './EditorToolbar';

export interface CodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  onSubmit: () => void;
  language: EditorLanguage;
  onLanguageChange: (lang: string) => void;
  onTest?: () => void;
}

export default function CodeEditor({
  value,
  onChange,
  onSubmit,
  language,
  onLanguageChange,
  onTest,
}: CodeEditorProps) {
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<EditorTheme>('vs-dark');

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onSubmit();
      });
    },
    [onSubmit],
  );

  const handleThemeToggle = () => {
    setTheme((current) => (current === 'vs-dark' ? 'light' : 'vs-dark'));
  };

  return (
    <div className="flex min-h-[400px] flex-col overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
      <EditorToolbar
        language={language}
        fontSize={fontSize}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onFontSizeChange={setFontSize}
        onThemeToggle={handleThemeToggle}
        onTest={onTest}
        onSubmit={onSubmit}
      />

      <div className="h-[360px]">
        <Editor
          height="360px"
          language={MONACO_LANGUAGE[language]}
          theme={theme}
          value={value}
          onChange={(next) => onChange(next ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize,
            tabSize: 4,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
