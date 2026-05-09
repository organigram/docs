'use strict'

const fs = require('node:fs')
const path = require('node:path')
const mdxLoader = require('@mdx-js/loader')
const { remarkCodeHike } = require('@code-hike/mdx')

const codeHikeOptions = {
  theme: 'github-light',
  lineNumbers: false,
  showCopyButton: true
}

let remarkGfmPromise

const getRemarkGfm = async () => {
  remarkGfmPromise ??= import('remark-gfm').then(module => module.default)
  return await remarkGfmPromise
}

const inlineCodeHikeExternalFiles = (source, resourcePath, addDependency) => {
  if (resourcePath == null) {
    return source
  }

  const resourceDir = path.dirname(resourcePath)

  return source.replace(
    /```([^\n`]*)\n\s*\/\/ from ([^\s\n]+)(?:\s+([0-9]+:[0-9]+))?\s*\n```/g,
    (match, meta, codepath, range) => {
      const absoluteCodepath = path.resolve(resourceDir, codepath)
      addDependency?.(absoluteCodepath)

      let content = fs.readFileSync(absoluteCodepath, 'utf8')

      if (range != null) {
        const [start, end] = range.split(':').map(Number)
        content = content
          .split('\n')
          .slice(start - 1, end)
          .join('\n')
      }

      return `\`\`\`${meta}\n${content.replace(/\s*$/, '')}\n\`\`\``
    }
  )
}

module.exports = function codehikeMdxLoader(value) {
  const callback = this.async()

  getRemarkGfm()
    .then(remarkGfm => {
      const loaderContext = Object.create(this)
      const getOptions = this.getOptions?.bind(this)
      const source = inlineCodeHikeExternalFiles(
        value,
        this.resourcePath,
        this.addDependency?.bind(this)
      )

      loaderContext.getOptions = schema => {
        const options = getOptions?.(schema) ?? {}

        return {
          ...options,
          remarkPlugins: [
            ...(options.remarkPlugins ?? []),
            [remarkCodeHike, codeHikeOptions],
            remarkGfm
          ]
        }
      }

      return mdxLoader.call(loaderContext, source)
    })
    .catch(callback)
}
