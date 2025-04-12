import { Handle, Position } from '@xyflow/react';
import React from 'react';

interface SimpleNodeProps {
  data: {
    label: string;
  };
}

export default function SimpleNode({ data }: SimpleNodeProps) {
  return (
    <React.Fragment>
      <Handle type="target" position={Position.Right} style={{ background: '#fff' }} />
        <div className="p-1">
          {data.label}
        </div>
      <Handle type="source" position={Position.Left} style={{ background: '#fff' }} />
    </React.Fragment>
  );
}