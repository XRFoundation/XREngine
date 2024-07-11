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

import { CSS_URL_REGEX } from '@etherealengine/common/src/regex/index'
import { WebRenderer } from '../WebRenderer'
import { getEmbeddedDataURL } from './getEmbeddedDataURL'

export async function getEmbeddedCSS(url: string) {
  if (WebRenderer.embeddedCSSMap.has(url)) return WebRenderer.embeddedCSSMap.get(url)!
  const res = await fetch(url, { mode: 'no-cors', headers: { accept: 'text/css' } })
  const css = await generateEmbeddedCSS(url, await res.text())
  WebRenderer.embeddedCSSMap.set(url, css)
  return WebRenderer.embeddedCSSMap.get(url)!
}

export async function generateEmbeddedCSS(url: string, css: string): Promise<string> {
  let found: RegExpExecArray | null
  const promises = [] as Promise<any>[]

  // Add classes for psuedo-classes
  css = css.replaceAll(':hover', WebRenderer.attributeCSS(WebRenderer.HOVER_ATTRIBUTE))
  css = css.replaceAll(':active', WebRenderer.attributeCSS(WebRenderer.ACTIVE_ATTRIBUTE))
  css = css.replaceAll(':focus', WebRenderer.attributeCSS(WebRenderer.FOCUS_ATTRIBUTE))
  css = css.replaceAll(':target', WebRenderer.attributeCSS(WebRenderer.TARGET_ATTRIBUTE))

  const matches = css.matchAll(CSS_URL_REGEX)

  for (const match of matches) {
    const isCSSImport = !!match[2]
    const accept = isCSSImport ? 'type/css' : undefined
    const resourceURL = match[2] || match[3]
    promises.push(
      getEmbeddedDataURL(new URL(resourceURL, url).href, accept).then((dataURL) => {
        css = css.replace(resourceURL, dataURL)
      })
    )
  }

  await Promise.all(promises)
  return css
}
