import Editor from '@monaco-editor/react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

import { getSubmission } from '../api/submissionsApi';
import { MONACO_LANGUAGE } from './CodeEditor/constants';
import {
  formatLanguage,
  formatMemory,
  formatTime,
} from '../utils/submissionFormat';
import VerdictBadge from './VerdictBadge';

interface Props {
  submissionId: number | null;
  onClose: () => void;
}

export default function SubmissionModal({ submissionId, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const { data: submission, isLoading, isError } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => getSubmission(submissionId!),
    enabled: submissionId != null,
  });

  useEffect(() => {
    if (!submissionId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [submissionId, onClose]);

  if (!submissionId) {
    return null;
  }

  const handleCopy = async () => {
    if (!submission?.code) {
      return;
    }
    await navigator.clipboard.writeText(submission.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {isError && <p className="text-sm text-red-600">Failed to load submission</p>}
            {submission && (
              <>
                <h2 className="text-lg font-semibold text-gray-900">
                  {submission.problem_title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <VerdictBadge
                    verdict={submission.verdict}
                    status={submission.status}
                  />
                  <span className="text-sm text-gray-600">
                    {formatLanguage(submission.language)}
                  </span>
                  {submission.time_ms != null && (
                    <span className="text-sm text-gray-500">
                      ⏱ {formatTime(submission.time_ms, submission.verdict)}
                    </span>
                  )}
                  {submission.memory_kb != null && (
                    <span className="text-sm text-gray-500">
                      💾 {formatMemory(submission.memory_kb)}
                    </span>
                  )}
                  <span className="text-sm text-gray-400">
                    {format(new Date(submission.created_at), 'PPpp')}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!submission?.code}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {copied ? 'Copied!' : 'Copy code'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-[360px] flex-1">
          {submission && (
            <Editor
              height="360px"
              language={MONACO_LANGUAGE[submission.language as keyof typeof MONACO_LANGUAGE] ?? 'python'}
              theme="vs-dark"
              value={submission.code}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
