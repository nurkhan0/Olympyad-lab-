export type EditorLanguage = 'python' | 'cpp' | 'java';

export const DEFAULT_SNIPPETS: Record<EditorLanguage, string> = {
  python: 'def solve():\n    pass\n\nsolve()',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n}',
  java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}',
};

export const MONACO_LANGUAGE: Record<EditorLanguage, string> = {
  python: 'python',
  cpp: 'cpp',
  java: 'java',
};

export const LANGUAGE_OPTIONS: { value: EditorLanguage; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
];

export const FONT_SIZES = [12, 14, 16, 18] as const;
