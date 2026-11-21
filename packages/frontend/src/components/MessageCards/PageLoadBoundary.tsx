import React, { type PropsWithChildren } from 'react';
import type { PageLoadProblem } from '../../lib/pageLoader';
import PageLoadErrorCard from './PageLoadErrorCard';

const PageLoadBoundary = ({
  problems = [],
  children,
}: PropsWithChildren<{ problems?: readonly PageLoadProblem[] }>) => {
  const blocking = problems.filter(({ severity }) => severity === 'error');
  const warnings = problems.filter(({ severity }) => severity === 'warning');

  if (blocking.length) {
    return (
      <div className="mx-auto w-full max-w-4xl py-4">
        {blocking.map((problem, index) => (
          <PageLoadErrorCard
            key={`${problem.source}-${problem.requestId ?? index}`}
            problem={problem}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {warnings.length ? (
        <div className="mx-auto w-full max-w-4xl py-2">
          {warnings.map((problem, index) => (
            <PageLoadErrorCard
              key={`${problem.source}-${problem.requestId ?? index}`}
              problem={problem}
            />
          ))}
        </div>
      ) : null}
      {children}
    </>
  );
};

export default PageLoadBoundary;
