const SANDBOX_MODULE = '@sheepdog/sandbox'
const SANDBOX_API_VAR = '__sheepdog_sandbox_api__'

function isRelative(source: string): boolean {
  return source.startsWith('./') || source.startsWith('../')
}

function stripTypeKeyword(specifiers: string): string {
  return specifiers
    .replace(/\btype\s+(\w+)\s*,?\s*/g, '')
    .replace(/\s*,\s*type\s+\w+/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/,\s*\}/g, '}')
    .trim()
}

function stripTypeOnlyImports(source: string): string {
  return source.replace(/import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '').trim()
}

function normalizeSpecifiers(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function collectImports(source: string): Array<{ full: string; specifiers: string; source: string; isTypeOnly: boolean }> {
  const importRe = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g
  const imports: Array<{ full: string; specifiers: string; source: string; isTypeOnly: boolean }> = []
  let match
  while ((match = importRe.exec(source)) !== null) {
    imports.push({
      full: match[0],
      specifiers: normalizeSpecifiers(match[1]),
      source: match[2],
      isTypeOnly: /^import\s+type\s/.test(match[0]),
    })
  }
  return imports
}

function transformSpecifier(specifiers: string): string | null {
  const cleaned = stripTypeKeyword(specifiers)

  const namedMatch = cleaned.match(/^\{\s*([^}]+)\s*\}$/)
  if (namedMatch) return `const { ${namedMatch[1].trim()} } = ${SANDBOX_API_VAR};`

  const nsMatch = cleaned.match(/^\*\s+as\s+(\w+)$/)
  if (nsMatch) return `const ${nsMatch[1]} = ${SANDBOX_API_VAR};`

  const defaultMatch = cleaned.match(/^(\w+)$/)
  if (defaultMatch) return `const ${defaultMatch[1]} = ${SANDBOX_API_VAR};`

  const mixedMatch = cleaned.match(/^(\w+),\s*\{\s*([^}]+)\s*\}$/)
  if (mixedMatch) {
    const defaultName = mixedMatch[1]
    const namedSpecs = mixedMatch[2].trim()
    return `const ${defaultName} = ${SANDBOX_API_VAR};\nconst { ${namedSpecs} } = ${SANDBOX_API_VAR};`
  }

  return null
}

export function replaceSandboxImportsRegex(source: string): string {
  let result = source.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]@sheepdog\/sandbox['"]\s*;?/g,
    (_, specifiers: string) => {
      const cleaned = stripTypeKeyword(specifiers)
      return `const { ${cleaned} } = ${SANDBOX_API_VAR};`
    }
  )

  const imports = collectImports(result)
  const remainingSandbox = imports.filter(i => i.source === SANDBOX_MODULE)
  const nonSandbox = imports.filter(i => i.source !== SANDBOX_MODULE && !i.isTypeOnly && !isRelative(i.source))

  if (remainingSandbox.length > 0) {
    const patterns = remainingSandbox.map(i => i.full).join('; ')
    throw new Error(
      `Unsupported @sheepdog/sandbox import pattern(s): ${patterns}. The regex strategy only supports named imports (import { ... } from '${SANDBOX_MODULE}').`
    )
  }

  if (nonSandbox.length > 0) {
    const sources = [...new Set(nonSandbox.map(i => i.source))].join(', ')
    throw new Error(`Non-sandbox imports are not allowed: ${sources}`)
  }

  return result
}

export function replaceSandboxImportsAST(source: string): string {
  let result = stripTypeOnlyImports(source)

  const imports = collectImports(result)
  if (imports.length === 0) return result

  const sandboxImports = imports.filter(i => i.source === SANDBOX_MODULE)
  const nonSandbox = imports.filter(i => i.source !== SANDBOX_MODULE && !isRelative(i.source))

  if (nonSandbox.length > 0) {
    const sources = [...new Set(nonSandbox.map(i => i.source))].join(', ')
    throw new Error(`Non-sandbox imports are not allowed: ${sources}`)
  }

  if (sandboxImports.length > 1) {
    throw new Error('Multiple imports from @sheepdog/sandbox are not allowed')
  }

  if (sandboxImports.length === 0) return result

  const imp = sandboxImports[0]

  const replacement = transformSpecifier(imp.specifiers)
  if (!replacement) {
    throw new Error(`Unrecognized import pattern: ${imp.full}`)
  }

  return result.replace(imp.full, replacement)
}

export function replaceSandboxImports(source: string, filename?: string): string {
  try {
    return replaceSandboxImportsAST(source)
  } catch (e) {
    if (e instanceof Error && filename) {
      e.message = `${filename}: ${e.message}`
    }
    throw e
  }
}

export function validateImports(source: string, filename?: string): void {
  const imports = collectImports(source)
  const nonSandbox = imports.filter(i => i.source !== SANDBOX_MODULE && !i.isTypeOnly && !isRelative(i.source))

  if (nonSandbox.length > 0) {
    const sources = [...new Set(nonSandbox.map(i => i.source))].join(', ')
    const msg = `Non-sandbox imports are not allowed: ${sources}. Only "@sheepdog/sandbox" and relative imports are permitted.`
    throw new Error(filename ? `${filename}: ${msg}` : msg)
  }
}
