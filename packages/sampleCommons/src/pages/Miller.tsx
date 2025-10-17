import React, { useState, useEffect, useRef } from 'react';
import { Center, Paper, Text, Card, Title, Divider } from '@mantine/core';
import {
  getNavPageLayoutPropsFromConfig,
  NavPageLayout,
  NavPageLayoutProps,
} from '@gen3/frontend';
import { GetServerSideProps } from 'next';
import {
  useGetDirectoryProjectsQuery,
  useGetDirectoryContentsQuery,
  DirItem,
  ProjectItem, // <-- IMPORT ProjectItem here
} from '@gen3/core';

// Define a union type for items that can appear in a column
type ColumnItem = DirItem | ProjectItem;

// --- Helper Components ---
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

// Helper to safely extract a readable message from RTK Query errors (FetchBaseQueryError | SerializedError)
const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    // Check for FetchBaseQueryError structure (has 'status')
    if ('status' in error) {
      const status = (error as { status: unknown }).status;
      const statusText =
        typeof status === 'number' ? `Status ${status}` : String(status);

      // Try to extract a message from the data object, which is common in API responses
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

    // Check for SerializedError structure (has 'message')
    if (
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
  }

  return 'An unexpected error occurred.';
};

const FileMetadataPanel = ({ file }: { file: DirItem }) => (
  <Card shadow="sm" p="lg" className="w-72 bg-white flex-shrink-0">
    <Title order={4}>File Metadata (Raw JSON)</Title>
    <Divider my="sm" />
    <Text
      size="sm"
      component="pre"
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
    >
      {JSON.stringify(file.rawData, null, 2)}
    </Text>
  </Card>
);

const SamplePage = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  const [columns, setColumns] = useState<
    { id: string; items?: ColumnItem[]; metadata?: DirItem }[] // <-- USE ColumnItem[] here
  >([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<DirItem | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use the RTK Query hook to fetch projects
  const {
    data: projectItems,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useGetDirectoryProjectsQuery();

  // Use the RTK Query hook to fetch directory contents
  const {
    data: dirContents,
    isLoading: isLoadingDirectory,
    error: dirError,
  } = useGetDirectoryContentsQuery(
    { projectId: selectedProject ?? '', path: selectedPath },
    { skip: !selectedProject },
  );

  // Effect to populate the first column once projects are loaded
  useEffect(() => {
    if (projectItems && projectItems.length > 0) {
      // projectItems is ProjectItem[], which is now assignable to ColumnItem[]
      setColumns([{ id: 'root-projects', items: projectItems }]);
    }
  }, [projectItems]);

  // Effect to add a new column when directory contents are loaded
  useEffect(() => {
    if (selectedProject && dirContents && !selectedFile) {
      setColumns((prev) => {
        const parentColumnIndex = selectedPath.length;
        const newCol = {
          id: `dir-${selectedProject}-${selectedPath.join('/') || 'root'}`,
          items: dirContents,
        };
        const next = [...prev];
        next[parentColumnIndex + 1] = newCol;
        return next.slice(0, parentColumnIndex + 2); // Keep forward, truncate deeper
      });
    }
  }, [dirContents, selectedProject, selectedPath, selectedFile]);

  // Effect to add metadata column when a file is selected
  useEffect(() => {
    if (selectedFile) {
      setColumns((prev) => {
        const newColumn = {
          id: `file-metadata-${selectedFile.id}`,
          metadata: selectedFile,
        };
        return [...prev, newColumn];
      });
    } else {
      // Clear metadata from columns when no file is selected
      setColumns((prev) => prev.filter((col) => !col.metadata));
    }
  }, [selectedFile]);

  // Effect to auto-scroll to the rightmost column when columns change
  useEffect(() => {
    if (scrollContainerRef.current && columns.length > 0) {
      const scrollWidth = scrollContainerRef.current.scrollWidth;
      scrollContainerRef.current.scrollTo({
        left: scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [columns.length]);

  const handleItemClick = (item: ColumnItem, columnIndex: number) => {
    // <-- USE ColumnItem here
    if (item.type === 'project') {
      setColumns((current) => current.slice(0, 1));
      setSelectedPath([]);
      setSelectedProject(item.name);
      setSelectedFile(null); // Clear file selection
    } else if (item.type === 'directory') {
      const pathIndex = columnIndex - 1;
      const newPath = [...selectedPath.slice(0, pathIndex), item.name];
      setColumns((current) => current.slice(0, columnIndex + 1));
      setSelectedPath(newPath);
      setSelectedFile(null); // Clear file selection
    } else if (item.type === 'file') {
      // Keep columns up to the current column index
      setColumns((current) => current.slice(0, columnIndex + 1));
      // Set the file for metadata display in a new column
      setSelectedFile(item);
      // Don't truncate selectedPath, or adjust it according to your needs
      // If you want to highlight the file's parent directory,
      // you might want to keep track of the selected file's path separately
    }
  };

  const isLoading = isLoadingProjects || isLoadingDirectory;
  const errorObject = projectsError || dirError; // Renamed to errorObject to reflect it holds the error instance

  if (errorObject) {
    const errorMessage = getErrorMessage(errorObject); // Safely get the message
    return (
      <NavPageLayout
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'CALYPR GRIPREF Page',
          content: 'CALYPR GRIPREF Page',
          key: 'calypr-gripref-page',
        }}
      >
        <Center>
          <Paper p="md">
            <Text color="red">Error loading data: {errorMessage}</Text>{' '}
            {/* Use the safely extracted message */}
          </Paper>
        </Center>
      </NavPageLayout>
    );
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR GRIPREF Page',
        content: 'CALYPR GRIPREF Page',
        key: 'calypr-gripref-page',
      }}
    >
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-7xl bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b">
            <h1 className="text-2xl font-bold text-gray-800">Finder</h1>
            <p className="text-gray-600">View directory structure </p>
          </div>
          <div
            className="flex h-[70vh] min-h-[450px] overflow-x-auto"
            ref={scrollContainerRef}
          >
            {columns.map((column, colIndex) => (
              <div
                key={`col-${column.id}-${colIndex}`}
                className="w-72 border-r overflow-y-auto flex-shrink-0 bg-white"
              >
                {column.metadata ? (
                  <FileMetadataPanel file={column.metadata} />
                ) : (
                  <ul>
                    {column.items?.map((item) => {
                      let isSelected = false;
                      if (colIndex === 0 && selectedProject) {
                        isSelected = selectedProject === item.name;
                      } else if (colIndex > 0) {
                        // DirItem checks are safe here
                        isSelected = selectedPath[colIndex - 1] === item.name;
                      }
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => handleItemClick(item, colIndex)}
                            className={`w-full text-left p-3 flex items-center justify-between transition-colors duration-150 ${
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
                                  isSelected ? 'text-white' : 'text-gray-400'
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
            ))}
            {isLoading && (
              <div className="w-72 p-4 flex-shrink-0">
                <LoadingSpinner />
              </div>
            )}
          </div>
        </div>
      </div>
    </NavPageLayout>
  );
};

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default SamplePage;
