import { Handle, Position } from '@xyflow/react';
import React from 'react';

interface SimpleNodeProps {
  data: {
    label: string;
    isAncestor: boolean;
  };
}

export default function SimpleNode({ data: {label, isAncestor} }: SimpleNodeProps) {
  return (
    <React.Fragment>
      <Handle type="target" position={Position.Right} style={{ background: '#fff' }} />
        <div className="p-1">
          <div className={`${isAncestor ? 'font-bold' : ''}`}>
            {label}
          </div>
        </div>
      <Handle type="source" position={Position.Left} style={{ background: '#fff' }} />
    </React.Fragment>
  );
}