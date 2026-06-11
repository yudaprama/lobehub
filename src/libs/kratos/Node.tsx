'use client';

import type { UiNode, UiNodeInputAttributes } from '@ory/client';
import { isUiNodeInputAttributes } from '@ory/integrations/ui';

import { NodeAnchor } from './NodeAnchor';
import { NodeImage } from './NodeImage';
import { NodeInput } from './NodeInput';
import { NodeScript } from './NodeScript';
import { NodeText } from './NodeText';

interface NodeProps {
  disabled: boolean;
  dispatchSubmit: (submitter: HTMLInputElement) => void;
  node: UiNode;
  setValue: (value: (v: any) => any) => void;
  value: any;
}

export function Node({ node, value, disabled, dispatchSubmit, setValue }: NodeProps) {
  if (isUiNodeInputAttributes(node.attributes)) {
    return (
      <NodeInput
        disabled={disabled}
        dispatchSubmit={dispatchSubmit}
        messages={node.messages}
        node={node as UiNode & { attributes: UiNodeInputAttributes }}
        setValue={setValue}
        value={value}
      />
    );
  }

  switch (node.type) {
    case 'text': {
      return <NodeText node={node} />;
    }
    case 'img': {
      return <NodeImage node={node} />;
    }
    case 'script': {
      return <NodeScript node={node} />;
    }
    case 'a': {
      return <NodeAnchor node={node} />;
    }
    default: {
      return <div style={{ color: 'red' }}>Unknown node type: {node.type}</div>;
    }
  }
}
