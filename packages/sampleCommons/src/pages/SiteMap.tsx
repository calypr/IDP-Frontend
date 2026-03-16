import React, { memo } from 'react';
import {
  NavPageLayout,
  NavPageLayoutProps,
  getNavPageLayoutPropsFromConfig,
} from '@gen3/frontend';
import { GetServerSideProps } from 'next';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import Link from 'next/link';
import {
  MdHome,
  MdSearch,
  MdStorage,
  MdBarChart,
  MdApps,
  MdPerson,
  MdSupervisorAccount,
  MdBook,
  MdExplore,
  MdCode,
  MdBuild,
  MdLibraryBooks,
  MdSwapHoriz,
  MdInsertDriveFile,
  MdAutoAwesome,
  MdBiotech,
  MdPeople,
  MdTableChart,
  MdSettings,
  MdLock,
  MdShowChart,
  MdWork,
} from 'react-icons/md';

// ─── Node Data Types ─────────────────────────────────────────────────────────

interface RootNodeData {
  label: string;
  [key: string]: unknown;
}

interface CategoryNodeData {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  [key: string]: unknown;
}

interface PageNodeData {
  label: string;
  href: string;
  icon: React.ReactNode;
  accentColor: string;
  [key: string]: unknown;
}

// ─── Custom Node Components ──────────────────────────────────────────────────

const RootNode = memo(({ data }: { data: RootNodeData }) => (
  <div
    style={{
      background: '#2C2C54',
      border: '2px solid #474787',
      borderRadius: '12px',
      padding: '16px 28px',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '18px',
      boxShadow: '0 4px 20px rgba(44, 44, 84, 0.45)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '200px',
      justifyContent: 'center',
    }}
  >
    <MdHome size={26} />
    <span>{data.label}</span>
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
  </div>
));
RootNode.displayName = 'RootNode';

const CategoryNode = memo(({ data }: { data: CategoryNodeData }) => (
  <div
    style={{
      background: data.bgColor as string,
      border: `2px solid ${data.color as string}`,
      borderLeft: `6px solid ${data.color as string}`,
      borderRadius: '10px',
      padding: '10px 14px',
      fontWeight: '700',
      fontSize: '13px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: '170px',
    }}
  >
    <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
    <span
      style={{ color: data.color as string, display: 'flex', flexShrink: 0 }}
    >
      {data.icon as React.ReactNode}
    </span>
    <span style={{ color: '#1a1a2e' }}>{data.label as string}</span>
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
  </div>
));
CategoryNode.displayName = 'CategoryNode';

const PageNode = memo(({ data }: { data: PageNodeData }) => (
  <Link href={data.href as string} style={{ textDecoration: 'none' }}>
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e8e8e8',
        borderLeft: `4px solid ${data.accentColor as string}`,
        borderRadius: '6px',
        padding: '7px 12px',
        color: '#2c2c2c',
        fontSize: '12px',
        boxShadow: '0 1px 5px rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: '150px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseOver={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 3px 14px rgba(0,0,0,0.16)';
        el.style.borderColor = data.accentColor as string;
      }}
      onMouseOut={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 1px 5px rgba(0,0,0,0.07)';
        el.style.borderColor = '#e8e8e8';
        el.style.borderLeftColor = data.accentColor as string;
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span
        style={{
          color: data.accentColor as string,
          display: 'flex',
          flexShrink: 0,
        }}
      >
        {data.icon as React.ReactNode}
      </span>
      <span style={{ fontWeight: 500 }}>{data.label as string}</span>
    </div>
  </Link>
));
PageNode.displayName = 'PageNode';

const nodeTypes = {
  rootNode: RootNode,
  categoryNode: CategoryNode,
  pageNode: PageNode,
};

// ─── Site Structure Definition ───────────────────────────────────────────────

interface PageDef {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface SectionDef {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  x: number;
  pages: PageDef[];
}

const CATEGORY_Y = 200;
const PAGE_START_Y = 340;
const PAGE_SPACING = 62;
const CATEGORY_WIDTH = 180;
const PAGE_WIDTH = 158;
const SECTION_GAP = 240;

const sections: SectionDef[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    color: '#0d95A1',
    bgColor: '#e7f4f6',
    icon: <MdSearch size={20} />,
    x: 0 * SECTION_GAP,
    pages: [
      {
        id: 'p-discovery',
        label: 'Discovery',
        href: '/Discovery',
        icon: <MdSearch size={14} />,
      },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    color: '#255990',
    bgColor: '#e9eef4',
    icon: <MdStorage size={20} />,
    x: 1 * SECTION_GAP,
    pages: [
      {
        id: 'p-data-library',
        label: 'Data Library',
        href: '/DataLibrary',
        icon: <MdLibraryBooks size={14} />,
      },
      {
        id: 'p-data-dictionary',
        label: 'Data Dictionary',
        href: '/DataDictionary',
        icon: <MdBook size={14} />,
      },
      {
        id: 'p-crosswalk',
        label: 'Crosswalk',
        href: '/Crosswalk',
        icon: <MdSwapHoriz size={14} />,
      },
      {
        id: 'p-file-summary',
        label: 'File Summary',
        href: '/FileSummary',
        icon: <MdInsertDriveFile size={14} />,
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis & Tools',
    color: '#892115',
    bgColor: '#f3ece9',
    icon: <MdBarChart size={20} />,
    x: 2 * SECTION_GAP,
    pages: [
      {
        id: 'p-analysis',
        label: 'Analysis',
        href: '/Analysis',
        icon: <MdBarChart size={14} />,
      },
      {
        id: 'p-explorer',
        label: 'Explorer',
        href: '/Explorer',
        icon: <MdExplore size={14} />,
      },
      {
        id: 'p-query',
        label: 'Query',
        href: '/Query',
        icon: <MdShowChart size={14} />,
      },
      {
        id: 'p-configurator',
        label: 'Configurator',
        href: '/Configurator',
        icon: <MdBuild size={14} />,
      },
      {
        id: 'p-workspace',
        label: 'Workspace',
        href: '/Workspace',
        icon: <MdWork size={14} />,
      },
    ],
  },
  {
    id: 'apps',
    label: 'Apps & Notebooks',
    color: '#474787',
    bgColor: '#eeedf4',
    icon: <MdApps size={20} />,
    x: 3 * SECTION_GAP,
    pages: [
      {
        id: 'p-apps',
        label: 'Apps',
        href: '/Apps',
        icon: <MdApps size={14} />,
      },
      {
        id: 'p-ai-search',
        label: 'AI Search',
        href: '/AISearch',
        icon: <MdAutoAwesome size={14} />,
      },
      {
        id: 'p-calypr',
        label: 'CALYPR',
        href: '/Calypr',
        icon: <MdBiotech size={14} />,
      },
      {
        id: 'p-miller',
        label: 'Miller',
        href: '/Miller',
        icon: <MdTableChart size={14} />,
      },
      {
        id: 'p-notebook-lite',
        label: 'Notebook Lite',
        href: '/NotebookLite',
        icon: <MdCode size={14} />,
      },
      {
        id: 'p-cohort-builder',
        label: 'Cohort Builder',
        href: '/TabbedCohortBuilder',
        icon: <MdPeople size={14} />,
      },
      {
        id: 'p-smmart',
        label: 'SMMART',
        href: '/SMMART',
        icon: <MdBiotech size={14} />,
      },
    ],
  },
  {
    id: 'profile',
    label: 'User & Profile',
    color: '#5b5b7a',
    bgColor: '#eaeaee',
    icon: <MdPerson size={20} />,
    x: 4 * SECTION_GAP,
    pages: [
      {
        id: 'p-profile',
        label: 'Profile',
        href: '/Profile',
        icon: <MdPerson size={14} />,
      },
      {
        id: 'p-my-projects',
        label: 'My Projects',
        href: '/MyProjects',
        icon: <MdPeople size={14} />,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    color: '#b75113',
    bgColor: '#f6ede8',
    icon: <MdSupervisorAccount size={20} />,
    x: 5 * SECTION_GAP,
    pages: [
      {
        id: 'p-admin-workspace',
        label: 'Workspace Mgmt',
        href: '/Admin/Workspace',
        icon: <MdWork size={14} />,
      },
      {
        id: 'p-admin-authz',
        label: 'Authorization',
        href: '/Admin/Authz',
        icon: <MdLock size={14} />,
      },
      {
        id: 'p-admin-analysis',
        label: 'Analysis Admin',
        href: '/Admin/Analysis',
        icon: <MdSettings size={14} />,
      },
    ],
  },
];

// ─── Node & Edge Generation ──────────────────────────────────────────────────

const totalWidth = sections.length * SECTION_GAP;
const homeX = totalWidth / 2 - 100;

const nodes: Node[] = [
  {
    id: 'home',
    type: 'rootNode',
    position: { x: homeX, y: 30 },
    data: { label: 'IDP Data Platform' },
  },
  ...sections.map((section) => ({
    id: section.id,
    type: 'categoryNode',
    position: { x: section.x, y: CATEGORY_Y },
    data: {
      label: section.label,
      icon: section.icon,
      color: section.color,
      bgColor: section.bgColor,
    },
  })),
  ...sections.flatMap((section) =>
    section.pages.map((page, idx) => ({
      id: page.id,
      type: 'pageNode',
      position: {
        x: section.x + (CATEGORY_WIDTH - PAGE_WIDTH) / 2,
        y: PAGE_START_Y + idx * PAGE_SPACING,
      },
      data: {
        label: page.label,
        href: page.href,
        icon: page.icon,
        accentColor: section.color,
      },
    })),
  ),
];

const edges: Edge[] = [
  ...sections.map((section) => ({
    id: `home-to-${section.id}`,
    source: 'home',
    target: section.id,
    type: 'smoothstep',
    style: { stroke: section.color, strokeWidth: 2, opacity: 0.65 },
  })),
  ...sections.flatMap((section) =>
    section.pages.map((page) => ({
      id: `${section.id}-to-${page.id}`,
      source: section.id,
      target: page.id,
      type: 'smoothstep',
      style: { stroke: section.color, strokeWidth: 1.5, opacity: 0.45 },
    })),
  ),
];

// ─── Diagram Wrapper ─────────────────────────────────────────────────────────

const SiteMapDiagram = () => (
  <ReactFlowProvider>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.08 }}
      minZoom={0.2}
      maxZoom={2}
      zoomOnScroll
      panOnScroll
      attributionPosition="bottom-right"
    >
      <Background
        variant="dots"
        color="#d8d8e8"
        gap={22}
        size={1.5}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  </ReactFlowProvider>
);

// ─── Page Component ──────────────────────────────────────────────────────────

const SiteMapPage = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Site Map | IDP Data Platform',
        content: 'Interactive infographic site map for the IDP Data Platform',
        key: 'site-map-page',
      }}
    >
      <div
        className="w-full flex flex-col"
        style={{ height: 'calc(100vh - 120px)' }}
      >
        <div className="px-6 py-4 bg-white border-b border-gray-100 shadow-sm">
          <h1 className="text-2xl font-bold" style={{ color: '#2C2C54' }}>
            Site Map
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visual overview of all pages and features available in the IDP Data
            Platform. Click on any page node to navigate directly to that page.
            Use scroll or pinch to zoom; drag to pan.
          </p>
        </div>
        <div className="flex-1 relative">
          <SiteMapDiagram />
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

export default SiteMapPage;
