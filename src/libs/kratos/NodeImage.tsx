'use client';

import type { UiNode } from '@ory/client';

export function NodeImage({ node }: { node: UiNode }) {
  const src = (node.attributes as any).src;
  if (!src) return null;
  return (
    <div style={{ margin: '8px 0', textAlign: 'center' }}>
      <img alt="" src={src} style={{ maxWidth: '100%', height: 'auto' }} />
    </div>
  );
}
