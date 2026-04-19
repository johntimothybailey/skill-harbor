import path from 'path'
import { fileURLToPath } from 'url'

const manualRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function getDocsContentDir() {
  return path.resolve(manualRoot, '../../docs')
}

export function getDocsMdxPath(slugs: string[]) {
  const slugPath = slugs.join('/')
  const contentDir = getDocsContentDir()

  return slugPath
    ? path.join(contentDir, `${slugPath}.mdx`)
    : path.join(contentDir, 'index.mdx')
}
