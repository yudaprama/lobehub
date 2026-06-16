'use client';

import type { UiNode } from '@ory/client';

export function NodeText({ node }: { node: UiNode }) {
  const text = node.meta?.label?.text || '';
  return <p style={{ margin: '8px 0', fontSize: 14, color: '#666', lineHeight: 1.5 }}>{text}</p>;
}
