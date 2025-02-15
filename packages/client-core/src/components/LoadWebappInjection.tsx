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

import config from '@etherealengine/common/src/config'
import { clientSettingPath } from '@etherealengine/common/src/schema.type.module'
import { NO_PROXY } from '@etherealengine/hyperflux'
import { loadWebappInjection } from '@etherealengine/projects/loadWebappInjection'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'
import { useHookstate } from '@hookstate/core'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export const LoadWebappInjection = (props: { children: React.ReactNode }) => {
  const { t } = useTranslation()

  const clientSettingQuery = useFind(clientSettingPath)
  const clientSettings = clientSettingQuery.data[0] ?? null
  useEffect(() => {
    config.client.key8thWall = clientSettings?.key8thWall
    config.client.mediaSettings = clientSettings?.mediaSettings
  }, [clientSettings])

  const projectComponents = useHookstate(null as null | any[])

  useEffect(() => {
    loadWebappInjection().then((result) => {
      projectComponents.set(result)
    })
  }, [])

  if (!projectComponents.value)
    return <LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.authenticating')} />

  return (
    <>
      {projectComponents.get(NO_PROXY)!.map((Component, i) => (
        <Component key={i} />
      ))}
      {props.children}
    </>
  )
}
