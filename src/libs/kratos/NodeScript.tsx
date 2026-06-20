'use client';

import type { UiNode } from '@ory/client';

export function NodeScript({ node }: { node: UiNode }) {
  const src = (node.attributes as any).src;
  const async = (node.attributes as any).async;
  if (!src) return null;
  return <script async={async} src={src} />;
}
