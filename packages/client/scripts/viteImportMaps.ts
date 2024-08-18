/**
 * https://github.com/vitejs/vite/issues/2483#issuecomment-1912618966
 */

import appRootPath from 'app-root-path'
import path from 'path'
import type { Plugin, UserConfig } from 'vite'

/**
 * Defines the document's import map and omits the specified entries from the bundle.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap}
 * @see {@link https://github.com/vitejs/vite/issues/2483}
 */
export default (mode: string, entries: { [key: string]: string }): Plugin => ({
  name: 'importMap',
  config: () => {
    const config: UserConfig = {
      optimizeDeps: {
        include: Object.values(entries)
      },
      build: {
        rollupOptions: {
          input: Object.fromEntries(
            Object.entries(entries).concat([['main.js', path.resolve(appRootPath.path, 'packages/client/index.html')]])
          ),
          output: {
            entryFileNames: 'entry-[name].js'
          }
          // external: Object.keys(entries)
        }
      }
    }

    if (mode === 'development') {
      config.resolve = {
        alias: entries
      }
    }

    return config
  },
  transformIndexHtml: (html) => {
    const content = Object.keys(entries)
      .map((from) => `"${from}":"/entry-${from}.js"`)
      .join(',')
    return html.replace(/^(\s*?)<title>.*?<\/title>/m, `$&$1<script type="importmap">{"imports":{${content}}}</script>`)
  }
})
