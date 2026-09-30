import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function typescriptFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry);
    if (statSync(absolute).isDirectory()) {
      result.push(...typescriptFiles(absolute));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      result.push(absolute);
    }
  }
  return result;
}

describe('commerce architecture guardrails', () => {
  it('never uses legacy Product.stock as storefront inventory truth', () => {
    const offenders = typescriptFiles(__dirname).filter((file) =>
      /\bproduct\s*\.\s*stock\b/i.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
