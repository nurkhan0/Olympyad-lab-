import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';

import type { SubmissionListItem } from '../api/submissionsApi';
import {
  formatLanguage,
  formatMemory,
  formatTime,
  formatTimeClass,
} from '../utils/submissionFormat';
import VerdictBadge from './VerdictBadge';

interface Props {
  submissions: SubmissionListItem[];
  onRowClick: (submission: SubmissionListItem) => void;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <svg
        className="mb-3 h-12 w-12 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
      <p className="text-sm font-medium">No submissions yet</p>
    </div>
  );
}

export default function SubmissionsTable({ submissions, onRowClick }: Props) {
  if (submissions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Problem</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Verdict</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Memory</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr
                key={submission.id}
                onClick={() => onRowClick(submission)}
                className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {submission.id}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link
                    to={`/problems/${submission.problem_slug}`}
                    onClick={(event) => event.stopPropagation()}
                    className="hover:text-indigo-600"
                  >
                    {submission.problem_title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatLanguage(submission.language)}
                </td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={submission.verdict} status={submission.status} />
                </td>
                <td className={`px-4 py-3 ${formatTimeClass(submission.verdict)}`}>
                  {formatTime(submission.time_ms, submission.verdict)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatMemory(submission.memory_kb)}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDistanceToNow(new Date(submission.created_at), {
                    addSuffix: true,
                    locale: enUS,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubmissionsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse gap-4 border-b border-gray-100 px-4 py-4"
        >
          <div className="h-4 w-10 rounded bg-gray-200" />
          <div className="h-4 flex-1 rounded bg-gray-200" />
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="h-5 w-24 rounded-full bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
