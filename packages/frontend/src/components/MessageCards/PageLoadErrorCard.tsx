import React from 'react';
import type { PageLoadProblem } from '../../lib/pageLoader';

const PageLoadErrorCard = ({ problem }: { problem: PageLoadProblem }) => {
  const metadata = [
    problem.source,
    `HTTP ${problem.status}`,
    problem.code,
    problem.requestId ? `request ${problem.requestId}` : undefined,
  ].filter(Boolean);

  return (
    <section
      role={problem.severity === 'error' ? 'alert' : 'status'}
      className={`m-4 rounded border p-4 shadow-sm ${
        problem.severity === 'error'
          ? 'border-red-300 bg-red-50 text-red-950'
          : 'border-amber-300 bg-amber-50 text-amber-950'
      }`}
    >
      <h2 className="font-semibold">
        {problem.severity === 'error'
          ? 'Unable to load this page'
          : 'Some page content could not be loaded'}
      </h2>
      <p className="mt-2 whitespace-pre-wrap">{problem.message}</p>
      <p className="mt-2 text-sm opacity-75">{metadata.join(' · ')}</p>
      {problem.issues?.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">
            Configuration details
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {problem.issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {problem.retryable ? (
        <button
          type="button"
          className="mt-4 rounded border border-current px-3 py-2 font-medium"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      ) : null}
    </section>
  );
};

export default PageLoadErrorCard;
