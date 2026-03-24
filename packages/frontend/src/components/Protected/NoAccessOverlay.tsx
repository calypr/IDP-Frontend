import React, { useEffect } from 'react';
import { Button } from '@mantine/core';
import { useFileTotalCountQuery } from '../../pages/Apps/fetchFileCounts';
import { useSession } from '../../lib/session/session';

export function useHasAccess(authz: any) {
  const { data, isLoading, isError } = useFileTotalCountQuery();
  const authzMap = authz ?? {};

  const len_access_projects = Object.entries(authzMap).filter(
    ([resource, perms]) => {
      // normalize and split, remove empty segments so both "/programs/..." and "programs/..." work
      const parts = String(resource).split('/').filter(Boolean);

      // expect ["programs", "<programId>", "projects", "<projectId>"]
      if (parts.length !== 4) return false;
      if (parts[0] !== 'programs' || parts[2] !== 'projects') return false;
      if (!Array.isArray(perms)) return false;

      // require an explicit { method: "read", service: "*" } entry in the perms array
      return perms.some((p: any) => p?.method === 'read' && p?.service === '*');
    },
  ).length;

  const hasAccess = len_access_projects > 0 || (data !== undefined && data > 0);

  return { len_access_projects, fileCount: data, isLoading, isError, hasAccess };
}


export const NoAccessOverlay = () => {
  const { endSession } = useSession();

  // Silently log the user out using the proper hook
  useEffect(() => {
    if (endSession) {
      endSession(false);
    }
  }, [endSession]);

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-gray-100 py-12 px-4">
      <div className="max-w-xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden text-center p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Welcome to CALYPR
        </h2>
        <p className="text-gray-600 mb-6">
          Your account has been authenticated, but currently does not have access to any projects or files in the system.
        </p>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-8 text-sm text-left">
          <strong>Requesting Access:</strong>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Reach out to our administrators to request access to specific projects.</li>
            <li>If you believe you should already have access, contact support.</li>
          </ul>
        </div>
        <div className="flex justify-center mt-4">
          <Button 
            component="a" 
            href="/" 
            variant="outline" 
            color="gray"
            size="md"
          >
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
};

