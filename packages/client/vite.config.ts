/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and
provide for limited attribution for the Original Developer. In addition,
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023
Ethereal Engine. All Rights Reserved.
*/

import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import packageRoot from 'app-root-path'
import dotenv from 'dotenv'
import fs from 'fs'
import lodash from 'lodash'
import path from 'path'
import { defineConfig, UserConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'

import appRootPath from 'app-root-path'
import manifest from './manifest.default.json'
import packageJson from './package.json'
import PWA from './pwa.config'
import { getClientSetting } from './scripts/getClientSettings'
import { getCoilSetting } from './scripts/getCoilSettings'
import importMap from './scripts/viteImportMaps'

const { isArray, mergeWith } = lodash

const parseModuleName = (moduleName: string) => {
  // // chunk medisoup-client
  if (moduleName.includes('medisoup')) {
    return `vendor_medisoup-client_${moduleName.toString().split('client/lib/')[1].split('/')[0].toString()}`
  }
  // chunk apexcharts
  if (moduleName.includes('apexcharts')) {
    return `vendor_apexcharts_${moduleName.toString().split('dist/')[1].split('/')[0].toString()}`
  }
  // chunk @feathersjs
  if (moduleName.includes('@feathersjs')) {
    return `vendor_feathersjs_${moduleName.toString().split('@feathersjs/')[1].split('/')[0].toString()}`
  }

  // chunk @reactflow
  if (moduleName.includes('@reactflow')) {
    return `vendor_reactflow_${moduleName.toString().split('@reactflow/')[1].split('/')[0].toString()}`
  }
  // chunk react-dom
  if (moduleName.includes('react-dom')) {
    return `vendor_react-dom_${moduleName.toString().split('react-dom/')[1].split('/')[0].toString()}`
  }

  // chunk react-icons
  if (moduleName.includes('react-icons')) {
    return `vendor_react-icons_${moduleName.toString().split('react-icons/')[1].split('/')[0].toString()}`
  }

  // chunk @pixiv vrm
  if (moduleName.includes('@pixiv')) {
    if (moduleName.includes('@pixiv/three-vrm')) {
      return `vendor_@pixiv_three-vrm_${moduleName.toString().split('three-vrm')[1].split('/')[0].toString()}`
    }
    return `vendor_@pixiv_${moduleName.toString().split('@pixiv/')[1].split('/')[0].toString()}`
  }
  // chunk three
  if (moduleName.includes('three')) {
    if (moduleName.includes('quarks/dist')) {
      return `vendor_three_quarks_${moduleName.toString().split('dist/')[1].split('/')[0].toString()}`
    }
    if (moduleName.includes('three')) {
      return `vendor_three_build_${moduleName.toString().split('/')[1].split('/')[0].toString()}`
    }
  }
  // chunk mui
  if (moduleName.includes('@mui')) {
    if (moduleName.includes('@mui/matererial')) {
      return `vendor_@mui_material_${moduleName.toString().split('@mui/material/')[1].split('/')[0].toString()}`
    } else if (moduleName.includes('@mui/x-date-pickers')) {
      return `vendor_@mui_x-date-pickers_${moduleName
        .toString()
        .split('@mui/x-date-pickers/')[1]
        .split('/')[0]
        .toString()}`
    }
    return `vendor_@mui_${moduleName.toString().split('@mui/')[1].split('/')[0].toString()}`
  }
  // chunk @dimforge
  if (moduleName.includes('@dimforge')) {
    return `vendor_@dimforge_${moduleName.toString().split('rapier3d-compat/')[1].split('/')[0].toString()}`
  }

  // Chunk all other node_modules
  return `vendor_${moduleName.toString().split('node_modules/')[1].split('/')[0].toString()}`
}

const merge = (src, dest) =>
  mergeWith({}, src, dest, function (a, b) {
    if (isArray(a)) {
      return b.concat(a)
    }
  })

// eslint-disable-next-line @typescript-eslint/no-var-requires
import('ts-node').then((tsnode) => {
  tsnode.register({
    project: './tsconfig.json'
  })
})

const getProjectConfigExtensions = async (config: UserConfig) => {
  const projects = fs
    .readdirSync(path.resolve(__dirname, '../projects/projects/'), { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
  for (const project of projects) {
    const staticPath = path.resolve(__dirname, `../projects/projects/`, project, 'vite.config.extension.ts')
    if (fs.existsSync(staticPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { default: viteConfigExtension } = await import(
          `../projects/projects/${project}/vite.config.extension.ts`
        )
        if (typeof viteConfigExtension === 'function') {
          const configExtension = (await viteConfigExtension(config)) as UserConfig
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (configExtension?.plugins) {
            config.plugins = [...config.plugins!, ...configExtension.plugins]
            delete configExtension.plugins
          }
          config = merge(config, configExtension)
        }
      } catch (e) {
        console.error(e)
      }
    }
  }
  return config as UserConfig
}

// https://github.com/google/mediapipe/issues/4120
function mediapipe_workaround() {
  return {
    name: 'mediapipe_workaround',
    load(id) {
      const MEDIAPIPE_EXPORT_NAMES = {
        'pose.js': [
          'POSE_LANDMARKS',
          'POSE_CONNECTIONS',
          'POSE_LANDMARKS_LEFT',
          'POSE_LANDMARKS_RIGHT',
          'POSE_LANDMARKS_NEUTRAL',
          'Pose',
          'VERSION'
        ],
        'hands.js': ['VERSION', 'HAND_CONNECTIONS', 'Hands'],
        'camera_utils.js': ['Camera'],
        'drawing_utils.js': ['drawConnectors', 'drawLandmarks', 'lerp'],
        'control_utils.js': [
          'drawConnectors',
          'FPS',
          'ControlPanel',
          'StaticText',
          'Toggle',
          'SourcePicker',

          // 'InputImage', not working with this export. Is defined in index.d.ts
          // but is not defined in control_utils.js
          'InputImage',

          'Slider'
        ]
      }

      const fileName = path.basename(id)
      if (!(fileName in MEDIAPIPE_EXPORT_NAMES)) return null
      let code = fs.readFileSync(id, 'utf-8')
      for (const name of MEDIAPIPE_EXPORT_NAMES[fileName]) {
        code += `exports.${name} = ${name};`
      }
      return { code }
    }
  }
}

// https://stackoverflow.com/a/44078347
const deleteDirFilesUsingPattern = (pattern, dirPath) => {
  // get all file names in directory
  fs.readdir(dirPath, (err, fileNames) => {
    if (err) throw err
    // iterate through the found file names
    for (const name of fileNames) {
      // if file name matches the pattern
      if (pattern.test(name)) {
        // try to remove the file and log the result
        fs.unlink(path.resolve(dirPath, name), (err) => {
          if (err) throw err
          console.log(`Deleted ${name}`)
        })
      }
    }
  })
}

const resetSWFiles = () => {
  // Delete old manifest files
  deleteDirFilesUsingPattern(/webmanifest/, './public/')
  // Delete old service worker files
  deleteDirFilesUsingPattern(/service-/, './public/')
  // Delete old workbox files
  deleteDirFilesUsingPattern(/workbox-/, './public/')
}

export default defineConfig(async () => {
  dotenv.config({
    path: packageRoot.path + '/.env.local'
  })
  const clientSetting = await getClientSetting()
  const coilSetting = await getCoilSetting()

  resetSWFiles()

  const isDevOrLocal = process.env.APP_ENV === 'development' || process.env.VITE_LOCAL_BUILD === 'true'

  let base = `https://${process.env['APP_HOST'] ? process.env['APP_HOST'] : process.env['VITE_APP_HOST']}/`

  if (process.env.SERVE_CLIENT_FROM_STORAGE_PROVIDER === 'true') {
    if (process.env.STORAGE_PROVIDER === 's3') {
      // base = `${path.join(clientSetting.url, 'client', '/')}`
    } else if (process.env.STORAGE_PROVIDER === 'local') {
      base = `https://${process.env.LOCAL_STORAGE_PROVIDER}/client/`
    }
  }

  const define = { __IR_ENGINE_VERSION__: JSON.stringify(packageJson.version) }
  for (const [key, value] of Object.entries(process.env)) {
    define[`globalThis.process.env.${key}`] = JSON.stringify(value)
  }

  const returned = {
    define: define,
    server: {
      proxy: {},
      cors: isDevOrLocal ? false : true,
      hmr:
        process.env.VITE_HMR === 'true'
          ? {
              port: process.env['VITE_APP_PORT'],
              host: process.env['VITE_APP_HOST'],
              overlay: false
            }
          : false,
      host: process.env['VITE_APP_HOST'],
      port: process.env['VITE_APP_PORT'],
      headers: {
        'Origin-Agent-Cluster': '?1'
      },
      ...(isDevOrLocal
        ? {
            https: {
              key: fs.readFileSync(path.join(packageRoot.path, process.env.KEY || 'certs/key.pem')),
              cert: fs.readFileSync(path.join(packageRoot.path, process.env.CERT || 'certs/cert.pem'))
            }
          }
        : {})
    },
    base,
    optimizeDeps: {
      entries: ['./src/main.tsx'],
      include: ['@reactflow/core', '@reactflow/minimap', '@reactflow/controls', '@reactflow/background'],
      esbuildOptions: {
        target: 'es2020'
      }
    },
    plugins: [
      svgr(),
      nodePolyfills(),
      mediapipe_workaround(),
      process.env.VITE_PWA_ENABLED === 'true' ? PWA(clientSetting) : undefined,
      ViteEjsPlugin({
        ...manifest,
        title: clientSetting.title || 'iR Engine',
        description: clientSetting?.siteDescription || 'Connected Worlds for Everyone',
        // short_name: clientSetting?.shortName || 'EE',
        // theme_color: clientSetting?.themeColor || '#ffffff',
        // background_color: clientSetting?.backgroundColor || '#000000',
        appleTouchIcon: clientSetting.appleTouchIcon || '/apple-touch-icon.png',
        favicon32px: clientSetting.favicon32px || '/favicon-32x32.png',
        favicon16px: clientSetting.favicon16px || '/favicon-16x16.png',
        icon192px: clientSetting.icon192px || '/android-chrome-192x192.png',
        icon512px: clientSetting.icon512px || '/android-chrome-512x512.png',
        webmanifestLink: clientSetting.webmanifestLink || '/manifest.webmanifest',
        siteManifest: clientSetting.siteManifest || '/site.webmanifest',
        safariPinnedTab: clientSetting.safariPinnedTab || '/safari-pinned-tab.svg',
        favicon: clientSetting.favicon || '/favicon.ico',
        swScriptLink:
          clientSetting.swScriptLink || process.env.VITE_PWA_ENABLED === 'true'
            ? process.env.APP_ENV === 'development'
              ? 'dev-sw.js?dev-sw'
              : 'service-worker.js'
            : '',
        paymentPointer: coilSetting?.paymentPointer || ''
      }),
      viteCompression({
        filter: /\.(js|mjs|json|css)$/i,
        algorithm: 'brotliCompress',
        deleteOriginFile: true
      }),
      viteCommonjs({
        include: ['use-sync-external-store']
      }),
      importMap(isDevOrLocal ? 'development' : 'production', {
        'default-project': path.resolve(appRootPath.path, 'packages/projects/projects/default-project/src/index.ts')
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        'react-json-tree': 'react-json-tree/lib/umd/react-json-tree'
      }
    },
    build: {
      target: 'esnext',
      sourcemap: process.env.VITE_SOURCEMAPS === 'true' ? true : false,
      minify: 'terser',
      terserOptions: {
        mangle: {
          // This is a work-around for a terser bug which occurs when a local variable named `fetch` is
          // used in a function that also references the global `fetch` function as a default parameter value
          // In this case, terser was mangling the local `fetch` variable a different name (which is fine),
          // however it also updated the default parameter to the same mangled name (uh-oh), causing a runtime error.
          reserved: ['fetch']
        }
      },
      dynamicImportVarsOptions: {
        warnOnError: true
      },
      rollupOptions: {
        output: {
          dir: 'dist',
          format: 'es', // 'commonjs' | 'esm' | 'module' | 'systemjs'
          // ignore files under 1mb
          experimentalMinChunkSize: 1000000,
          manualChunks: (id) => {
            // chunk dependencies
            if (id.includes('node_modules')) {
              return parseModuleName(id)
            }
          }
        }
      }
    }
  } as UserConfig

  return await getProjectConfigExtensions(returned)
})
