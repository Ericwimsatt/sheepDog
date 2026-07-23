import ts from 'typescript'
import { replaceSandboxImports } from './resolver.js'

export function compileSandboxScript(source: string, filename: string): string {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      strict: false,
    },
    fileName: filename,
  })

  const jsSource = result.outputText

  const transformed = replaceSandboxImports(jsSource, filename)

  return transformed
}
