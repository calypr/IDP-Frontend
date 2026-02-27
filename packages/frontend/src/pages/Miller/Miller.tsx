import React, { useState, useEffect, useRef } from 'react';
import {
  Center,
  Paper,
  Text,
  Card,
  Title,
  Divider,
  Group,
  Anchor,
  ActionIcon,
} from '@mantine/core';
import {
  IconFileText,
  IconLink,
  IconFile,
} from '@tabler/icons-react';
import { NavPageLayout } from '../../features/Navigation';
import type { NavPageLayoutProps } from '../../features/Navigation';
import { FaFileDownload } from 'react-icons/fa';
import {
  useGetDirectoryProjectsQuery,
  useGetDirectoryContentsQuery,
  DirItem,
  GEN3_FENCE_API,
  GEN3_API,
} from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { ColumnItem, type MillerPageProps } from './types';
import { type DocumentReferenceData } from '@gen3/core';
import { formatBytes } from '../../utils/labels';
import FileSaver from 'file-saver';

const ProjectIcon = ({ className = 'w-5 h-5 mr-3 text-purple-500' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM4 11a1 1 0 011-1h10a1 10 110 2H5a1 1 0 01-1-1zM4 15a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
  </svg>
);

const FolderIcon = ({ className = 'w-5 h-5 mr-3 text-sky-500' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const FileIcon = ({ className = 'w-5 h-5 mr-3 text-gray-400' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.414a1 1 0 00-.293-.707l-4-4A1 1 0 0011.586 3H4zm7 3.5V9h3.5L11 5.5z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-gray-400"
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
  </div>
);

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    if ('status' in error) {
      const status = (error as { status: unknown }).status;
      const statusText =
        typeof status === 'number' ? `Status ${status}` : String(status);
      let dataMessage = null;
      if (typeof error === 'string') {
        dataMessage = error;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'detail' in error &&
        typeof (error as { detail: unknown }).detail === 'string'
      ) {
        dataMessage = (error as { detail: string }).detail;
      }
      return dataMessage ? `${statusText}: ${dataMessage}` : statusText;
    }
    if (
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
  }
  return 'An unexpected error occurred.';
};

type FileMetadataPanelProps = {
  file: DirItem;
};

export const FileMetadataPanel = ({ file }: FileMetadataPanelProps) => {
  const data = file.rawData as DocumentReferenceData;
  const attachment = data?.content?.[0]?.attachment;

  const fileName = file.name || attachment?.title || 'download';
  
  const size = attachment?.size || 0;
  const url = attachment?.url || '—';
  const downloadIdentifier = data?.identifier?.[0]?.value || '—';

  const isGithubFile = !!attachment?.extension?.some(
    (ext: any) => ext.valueString === 'github'
  );

  const downloadUrl = isGithubFile
    ? url
    : `${GEN3_FENCE_API}/data/download/${downloadIdentifier}?redirect=true`;

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (isGithubFile) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }

    // 1. Chrome/Edge: True Streaming to Disk (Handles GB+ files with 0 RAM buffering)
    if ('showSaveFilePicker' in window) {
      setIsDownloading(true);
      try {
        const resp = await fetch(downloadUrl, { 
          credentials: 'include',
          redirect: 'follow',
        });

        if (!resp.ok) throw new Error('Download request failed');

        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
        });
        const writable = await handle.createWritable();
        
        if (!resp.body) throw new Error('No response body');
        
        // pipeTo is the browser's native, optimized way to stream data from 
        // network to disk without JavaScript memory buffering.
        await resp.body.pipeTo(writable);
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled the "Save As" dialog
        console.error('Streaming download failed:', err);
      } finally {
        setIsDownloading(false);
      }
    } else {
      // 2. Safari/Firefox Path: Native Download
      // Since we can't rename a stream in these browsers without buffering in RAM (bad for GB files),
      // we use a standard link. It streams to disk safely, but results in the SHA256 name.
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card shadow="sm" p="lg" className="w-80 bg-white flex-shrink-0 border-l border-gray-200 h-full">
      <Title order={4} className="mb-2">
        File Metadata
      </Title>
      
      <Divider my="sm" />
      
      <div className="space-y-3 text-sm">
        <Group gap="xs" wrap="nowrap">
          <IconFileText size={16} className="text-gray-500 flex-shrink-0" />
          <Text className="font-medium flex-shrink-0">File Name:</Text>
          <Text className="truncate" title={fileName}>
            {fileName}
          </Text>
        </Group>

        <Group gap="xs">
          <IconFile size={16} className="text-gray-500" />
          <Text className="font-medium">Size:</Text>
          <Text>{formatBytes(size)}</Text>
        </Group>

        <Group gap="xs" align={isGithubFile ? 'start' : 'center'}>
          {isGithubFile ? (
            <IconLink size={16} className="text-purple-500 mt-[2px]" />
          ) : (
            <FaFileDownload size={16} className="text-gray-500" />
          )}
          
          <Text className="font-medium text-gray-600">
            {isGithubFile ? 'Source:' : 'Download:'}
          </Text>

          {isGithubFile ? (
            <Anchor
              href={url}
              target="_blank"
              className="break-all text-blue-600 hover:underline"
            >
              {url}
            </Anchor>
          ) : (
            <ActionIcon 
              color="blue" 
              size="md" 
              variant="filled"
              onClick={handleDownload}
              loading={isDownloading}
              title={`Download ${fileName}`}
            >
              <FaFileDownload />
            </ActionIcon>
          )}
        </Group>
      </div>
    </Card>
  );
};

const MillerPage = ({
  headerProps,
  footerProps,
  errorStatus,
}: MillerPageProps) => {
  const [columns, setColumns] = useState<
    {
      id: string;
      items?: ColumnItem[];
      metadata?: DirItem;
      loading?: boolean;
    }[]
  >([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<DirItem | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch projects
  const {
    data: projectItems,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useGetDirectoryProjectsQuery();

  // Fetch directory contents (skip if no project or file selected)
  const {
    data: dirContents,
    isLoading: isLoadingDirectory,
    error: dirError,
  } = useGetDirectoryContentsQuery(
    { projectId: selectedProject ?? '', path: selectedPath },
    { skip: !selectedProject || !!selectedFile },
  );

  // Global loading flag to disable interactions during fetches (hardens against races)
  const isLoading = isLoadingProjects || isLoadingDirectory;

  // Populate first column with projects
  useEffect(() => {
    if (projectItems && projectItems.length > 0) {
      setColumns([{ id: 'root-projects', items: projectItems }]);
    }
  }, [projectItems]);

  // Replace loading column with directory contents when ready
  useEffect(() => {
    if (selectedProject && dirContents && !selectedFile) {
      setColumns((prev) => {
        const newCol = {
          id: `dir-${selectedProject}-${selectedPath.join('/') || 'root'}`,
          items: dirContents,
        };
        const next = [...prev];
        next[next.length - 1] = newCol;
        return next;
      });
    }
  }, [dirContents, selectedProject, selectedPath, selectedFile]);

  // Handle file metadata column
  useEffect(() => {
    if (selectedFile) {
      setColumns((prev) => {
        const lastCol = prev[prev.length - 1];
        // If we're already showing this exact file, do nothing
        if (lastCol?.metadata?.id === selectedFile.id) return prev;

        // Otherwise replace or add metadata column
        if (lastCol?.metadata) {
          return [
            ...prev.slice(0, -1),
            { id: `file-metadata-${selectedFile.id}`, metadata: selectedFile },
          ];
        }
        return [
          ...prev,
          { id: `file-metadata-${selectedFile.id}`, metadata: selectedFile },
        ];
      });
    } else {
      setColumns((prev) => prev.filter((col) => !col.metadata));
    }
  }, [selectedFile]);

  // Auto-scroll to newest column
  const prevColumnCountRef = useRef<number>(0);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const currentLen = columns.length;
    const prevLen = prevColumnCountRef.current;
    if (currentLen > prevLen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTo({
            left: container.scrollWidth,
            behavior: 'smooth',
          });
        });
      });
    }
    prevColumnCountRef.current = currentLen;
  }, [columns]);

  // Handle item clicks (disabled during loading)
  const handleItemClick = (item: ColumnItem, columnIndex: number) => {
    if (isLoading) return;

    if (item.type === 'project') {
      setSelectedProject(item.name);
      setSelectedPath([]);
      setSelectedFile(null);
      setColumns((prev) => [
        ...prev.slice(0, 1),
        { id: 'loading-project', loading: true },
      ]);
      return;
    }

    if (item.type === 'directory') {
      const newPath = [...selectedPath.slice(0, columnIndex - 1), item.name];
      setSelectedPath(newPath);
      setSelectedFile(null);

      // Always truncate to the clicked folder + loading column
      setColumns((prev) => [
        ...prev.slice(0, columnIndex + 1),
        { id: 'loading-dir', loading: true },
      ]);
      return;
    }

    if (item.type === 'file') {
      // THIS IS THE KEY FIX
      const parentPath = selectedPath.slice(0, columnIndex - 1); // path up to parent folder
      setSelectedPath(parentPath);
      setSelectedFile(item);

      // Collapse everything after the parent folder, then add metadata
      setColumns((prev) => {
        const keepUpToParent = columnIndex + 1; // root + project + folders up to parent
        return [
          ...prev.slice(0, keepUpToParent),
          { id: `file-metadata-${item.id}`, metadata: item },
        ];
      });
      return;
    }
  };

  // FinderPathBar (bottom path bar like macOS)
  const FinderPathBar = () => {
    const breadcrumbs: {
      label: string;
      icon: React.ReactNode;
      targetDepth: number;
    }[] = [];

    // Root
    breadcrumbs.push({
      label: 'Projects',
      icon: <ProjectIcon className="w-4 h-4" />,
      targetDepth: 1,
    });

    if (selectedProject) {
      breadcrumbs.push({
        label: selectedProject,
        icon: <ProjectIcon className="w-4 h-4" />,
        targetDepth: 2,
      });

      selectedPath.forEach((folder, idx) => {
        breadcrumbs.push({
          label: folder,
          icon: <FolderIcon className="w-4 h-4" />,
          targetDepth: 2 + idx + 1,
        });
      });

      if (selectedFile) {
        breadcrumbs.push({
          label: selectedFile.name,
          icon: <FileIcon className="w-4 h-4" />,
          targetDepth: columns.length,
        });
      }
    }

    const currentDepth = selectedFile
      ? columns.length // when file selected, depth includes metadata column
      : selectedPath.length + 2; // normal folder navigation

    const handleCrumbClick = (targetDepth: number) => {
      if (isLoading) return; // Harden: prevent races from quick clicks
      if (targetDepth >= currentDepth) {
        return;
      }

      if (targetDepth === 1) {
        setSelectedProject(null);
        setSelectedPath([]);
        setSelectedFile(null);
        setColumns([{ id: 'root-projects', items: projectItems ?? [] }]);
        return;
      }

      if (targetDepth === 2) {
        setSelectedPath([]);
        setSelectedFile(null);
        setColumns((prev) => prev.slice(0, 2));
        return;
      }

      // Navigate to folder
      const folderIndex = targetDepth - 3;
      const newPath = selectedPath.slice(0, folderIndex + 1);
      setSelectedPath(newPath);
      setSelectedFile(null);

      setColumns((prev) => {
        const lastIsMetadata = !!prev[prev.length - 1]?.metadata;
        const shouldJustTruncate =
          lastIsMetadata && prev.length === targetDepth + 1;
        if (shouldJustTruncate) {
          return prev.slice(0, targetDepth);
        }
        return prev.slice(0, targetDepth);
      });
    };

    if (breadcrumbs.length <= 1) return null;

    return (
      <div className="border-t bg-gradient-to-b from-gray-100 to-gray-50 px-6 py-3.5">
        <div className="flex items-center gap-3 overflow-x-auto">
          {breadcrumbs.map((crumb, i) => {
            const isCurrent = crumb.targetDepth === currentDepth;

            return (
              <div key={i} className="flex items-center">
                {i > 0 && (
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                  </svg>
                )}
                <button
                  onClick={() => handleCrumbClick(crumb.targetDepth)}
                  disabled={isCurrent || isLoading} // Harden: disable during loads
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all select-none
                    ${
                      isCurrent
                        ? 'bg-white shadow-sm ring-1 ring-black/10 font-semibold'
                        : 'hover:bg-white/90 hover:shadow active:scale-98 text-gray-700'
                    }
                    disabled:cursor-default disabled:opacity-60
                  `}
                >
                  {crumb.icon}
                  <span className="truncate max-w-[200px]">{crumb.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const errorObject = projectsError || dirError;
  const errorMessage = errorObject ? getErrorMessage(errorObject) : null;

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR GRIPREF Page',
        content: 'CALYPR GRIPREF Page',
        key: 'calypr-gripref-page',
      }}
    >
      <ProtectedContent errorStatus={errorStatus}>
        {errorMessage ? (
          <Center h="100%">
            <Paper p="md">
              <Text color="red">Error loading data: {errorMessage}</Text>
            </Paper>
          </Center>
        ) : (
          <div className="min-h-screen w-full flex flex-col items-center justify-start">
            <div className="w-full bg-white overflow-hidden p-2">
              <div className="p-2 border-b">
                <h1 className="text-2xl font-bold text-gray-800">Finder</h1>
                <p className="text-gray-600">View directory structure </p>
              </div>
              <div
                className="flex h-[70vh] min-h-[450px] overflow-x-auto"
                ref={scrollContainerRef}
              >
                {columns.length === 0 && isLoadingProjects ? (
                  <div className="w-72 border-r overflow-y-auto flex-shrink-0 bg-white">
                    <LoadingSpinner />
                  </div>
                ) : (
                  columns.map((column, colIndex) => (
                    <div
                      key={`col-${column.id}-${colIndex}`} // Harden: unique keys for stable rendering
                      className="w-72 border-r overflow-y-auto flex-shrink-0 bg-white"
                    >
                      {column.loading ? (
                        <LoadingSpinner />
                      ) : column.metadata ? (
                        <FileMetadataPanel file={column.metadata as DirItem} />
                      ) : (
                        <ul>
                          {column.items?.map((item) => {
                            let isSelected = false;
                            if (colIndex === 0 && selectedProject) {
                              isSelected = selectedProject === item.name;
                            } else if (colIndex > 0) {
                              isSelected =
                                selectedPath[colIndex - 1] === item.name;
                            }
                            return (
                              <li key={item.id}>
                                <button
                                  disabled={isLoading} // Harden: disable during loads
                                  onClick={() => handleItemClick(item, colIndex)}
                                  className={`w-full text-left p-3 flex items-center justify-between transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                                    isSelected
                                      ? 'bg-blue-500 text-white'
                                      : 'hover:bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center truncate">
                                    {item.type === 'project' ? (
                                      <ProjectIcon />
                                    ) : item.type === 'directory' ? (
                                      <FolderIcon />
                                    ) : (
                                      <FileIcon />
                                    )}
                                    <span className="font-medium truncate">
                                      {item.name}
                                    </span>
                                  </div>
                                  {(item.type === 'project' ||
                                    item.type === 'directory') && (
                                    <div
                                      className={
                                        isSelected
                                          ? 'text-white'
                                          : 'text-gray-400'
                                      }
                                    >
                                      <ChevronRightIcon />
                                    </div>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
              <FinderPathBar />
            </div>
          </div>
        )}
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default MillerPage;
