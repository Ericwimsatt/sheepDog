import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
export function glob(pattern, root) {
    const parts = pattern.replace(/\\/g, '/').split('/');
    return walk(parts, root, root);
}
function walk(parts, currentRoot, baseRoot) {
    const part = parts[0];
    if (!part)
        return [currentRoot];
    if (part === '**') {
        const results = [];
        const rest = parts.slice(1);
        collectRecursive(currentRoot, rest, baseRoot, results);
        return results;
    }
    if (part === '*') {
        const results = [];
        const rest = parts.slice(1);
        try {
            for (const entry of readdirSync(currentRoot)) {
                const full = join(currentRoot, entry);
                if (statSync(full).isDirectory()) {
                    results.push(...walk(rest, full, baseRoot));
                }
            }
        }
        catch { /* skip unreadable dirs */ }
        return results;
    }
    const next = join(currentRoot, part);
    try {
        if (statSync(next).isFile() || statSync(next).isDirectory()) {
            return walk(parts.slice(1), next, baseRoot);
        }
    }
    catch { /* not found */ }
    return [];
}
function collectRecursive(dir, rest, baseRoot, results) {
    try {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                results.push(...walk(rest, full, baseRoot));
                collectRecursive(full, rest, baseRoot, results);
            }
        }
    }
    catch { /* skip */ }
}
//# sourceMappingURL=fs.js.map