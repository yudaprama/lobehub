'use client';

import type { UiNode } from '@ory/client';

export function NodeAnchor({ node }: { node: UiNode }) {
  const href = (node.attributes as any).href;
  const text = node.meta?.label?.text || '';
  if (!href) return null;
  return (
    <div style={{ margin: '8px 0' }}>
      <a href={href} style={{ color: '#1677ff', textDecoration: 'none', fontSize: 14 }}>
        {text || href}
      </a>
    </div>
  );
}
