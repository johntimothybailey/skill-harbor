import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { getDocsContentDir, getDocsMdxPath } from '../lib/docs-content'

describe('docs-content', () => {
  it('resolves the same repo docs root used by the manual app', () => {
    const docsDir = getDocsContentDir()

    expect(path.basename(docsDir)).toBe('docs')
    expect(fs.existsSync(path.join(docsDir, 'index.mdx'))).toBe(true)
  })

  it('maps empty and nested slugs to repo docs mdx files', () => {
    expect(getDocsMdxPath([])).toBe(path.join(getDocsContentDir(), 'index.mdx'))
    expect(getDocsMdxPath(['quickstart'])).toBe(path.join(getDocsContentDir(), 'quickstart.mdx'))
    expect(getDocsMdxPath(['reference', 'commands'])).toBe(path.join(getDocsContentDir(), 'reference', 'commands.mdx'))
  })
})
