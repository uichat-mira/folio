export type HeadingIdAllocator = {
  useExplicit(id: string): string;
  allocate(base: string): string;
};

export function createHeadingIdAllocator(
  explicitIds: Iterable<string>,
): HeadingIdAllocator {
  const reserved = new Set(Array.from(explicitIds).filter(Boolean));
  const used = new Set<string>();

  return {
    useExplicit(id: string) {
      used.add(id);
      return id;
    },
    allocate(base: string) {
      let candidate = base;
      let suffix = 2;

      while (reserved.has(candidate) || used.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }

      used.add(candidate);
      return candidate;
    },
  };
}
