import { blockForCodepoint, type UnicodeBlock } from "./unicode-data";

/**
 * Unicode coverage is derived entirely from the font's own cmap, so a block
 * only appears if the font actually maps characters in it.
 */

export type BlockCoverage = {
  block: UnicodeBlock;
  /** Characters the font maps inside this block. */
  covered: number;
  /** Size of the block, i.e. the number of code points it spans. */
  total: number;
  /** `covered / total`, 0 when the block is empty (never 0 for a real block). */
  ratio: number;
  codepoints: number[];
};

export type CoverageSummary = {
  blocks: BlockCoverage[];
  totalCodepoints: number;
  /** Blocks the font covers completely. */
  completeBlocks: number;
  /** Blocks with no assigned code points, such as a reserved range. */
  unassignedBlocks: number;
  /** Highest code point the font maps. */
  highestCodepoint: number;
};

export function buildCoverage(mapping: Map<number, number>): CoverageSummary {
  const byBlock = new Map<UnicodeBlock, number[]>();

  for (const codepoint of mapping.keys()) {
    const block = blockForCodepoint(codepoint);
    if (!block) continue;
    const list = byBlock.get(block) ?? [];
    list.push(codepoint);
    byBlock.set(block, list);
  }

  const blocks: BlockCoverage[] = [];
  let completeBlocks = 0;
  let unassignedBlocks = 0;
  let highestCodepoint = 0;

  for (const [block, codepoints] of byBlock) {
    const total = block.end - block.start + 1;
    const covered = codepoints.length;
    const ratio = total > 0 ? covered / total : 0;
    codepoints.sort((a, b) => a - b);
    if (ratio === 1) completeBlocks++;
    if (covered === 0) unassignedBlocks++;

    for (const codepoint of codepoints) {
      if (codepoint > highestCodepoint) highestCodepoint = codepoint;
    }

    blocks.push({ block, covered, total, ratio, codepoints });
  }

  blocks.sort(
    (a, b) => a.block.start - b.block.start || a.block.end - b.block.end,
  );

  return {
    blocks,
    totalCodepoints: mapping.size,
    completeBlocks,
    unassignedBlocks,
    highestCodepoint,
  };
}

/** Percentage with one decimal, or "Not available" when the block is empty. */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return "Not available";
  return `${(ratio * 100).toFixed(1)}%`;
}
