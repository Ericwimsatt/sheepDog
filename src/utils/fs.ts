import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export function glob(pattern: string, root: string): string[] {
  const parts = pattern.replace(/\\/g, '/').split('/')
  return walk(parts, root, root)
}

function walk(parts: string[], currentRoot: string, baseRoot: string): string[] {
  const part = parts[0]
  if (!part) return [currentRoot]

  if (part === '**') {
    const results: string[] = []
    const rest = parts.slice(1)
    collectRecursive(currentRoot, rest, baseRoot, results)
    return results
  }

  if (part === '*') {
    const results: string[] = []
    const rest = parts.slice(1)
    try {
      for (const entry of readdirSync(currentRoot)) {
        const full = join(currentRoot, entry)
        if (statSync(full).isDirectory()) {
          results.push(...walk(rest, full, baseRoot))
        }
      }
    } catch { /* skip unreadable dirs */ }
    return results
  }

  const next = join(currentRoot, part)
  try {
    if (statSync(next).isFile() || statSync(next).isDirectory()) {
      return walk(parts.slice(1), next, baseRoot)
    }
  } catch { /* not found */ }
  return []
}

function collectRecursive(dir: string, rest: string[], baseRoot: string, results: string[]): void {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        results.push(...walk(rest, full, baseRoot))
        collectRecursive(full, rest, baseRoot, results)
      }
    }
  } catch { /* skip */ }
}
