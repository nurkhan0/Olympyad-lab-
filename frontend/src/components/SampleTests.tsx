import { useState } from 'react';

import type { TestCasePublic } from '../types/problem';

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
    >
      {copied ? 'Скопировано!' : 'Копировать'}
    </button>
  );
}

interface Props {
  tests: TestCasePublic[];
}

export default function SampleTests({ tests }: Props) {
  if (tests.length === 0) {
    return <p className="text-sm text-gray-500">Примеры не предоставлены</p>;
  }

  return (
    <div className="space-y-6">
      {tests.map((test, index) => (
        <div key={index} className="flex flex-col gap-4 sm:flex-col md:flex-row">
          <div className="flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Входные данные {index + 1}
              </span>
              <CopyButton text={test.input} />
            </div>
            <pre className="overflow-x-auto rounded bg-slate-900 p-3 font-mono text-sm text-slate-100">
              {test.input}
            </pre>
          </div>

          <div className="flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Ожидаемый вывод {index + 1}
              </span>
              <CopyButton text={test.expected_output} />
            </div>
            <pre className="overflow-x-auto rounded bg-slate-900 p-3 font-mono text-sm text-slate-100">
              {test.expected_output}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}
