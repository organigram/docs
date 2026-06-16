import fs from 'node:fs'
import path from 'node:path'

import { type FileTree } from '../types'
import { getDocsModule } from './modules'

export const walkPath = (dir: string): string[] => {
  let results: string[] = []
  const list = fs.readdirSync(dir)
  list.forEach(function (file) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat?.isDirectory()) {
      results = results.concat(walkPath(filePath))
    } else {
      results.push(filePath)
    }
  })

  return results
}

export const makeFileTreeFromPaths = async (
  filePaths: string[]
): Promise<FileTree[]> => {
  const addPath: (
    paths: string[],
    arr: FileTree[],
    path: string
  ) => Promise<FileTree[]> = async (paths, arr, path) => {
    const component = paths.shift()
    let current = arr.find(item => item.text === component)
    if (current == null) {
      const _path =
        paths.length !== 0
          ? path
              .split('/')
              .slice(0, -1)
              .reduce((pv, cv) => pv + '/' + cv) + '/index.mdx'
          : path
      const { metadata } = (await getDocsModule(_path)) ?? {}
      current = { text: component, path: _path, metadata: metadata ?? null }
      arr.push(current)
    }
    if (paths.length !== 0) {
      await addPath(paths, current.children ?? (current.children = []), path)
    }
    return arr
  }

  const res = await filePaths.reduce<Promise<FileTree[]>>(
    async (arr, path) =>
      await new Promise(resolve => {
        arr.then(async res => {
          resolve(await addPath(path.slice(1).split('/'), res, path))
        })
      }),
    new Promise(resolve => {
      resolve([])
    })
  )
  return res
}
