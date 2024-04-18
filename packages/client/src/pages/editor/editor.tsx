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

import { useHookstate } from '@hookstate/core'
import { t } from 'i18next'
import React, { Suspense, useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'

import { RouterState } from '@etherealengine/client-core/src/common/services/RouterService'
import { LoadingCircle } from '@etherealengine/client-core/src/components/LoadingCircle'
import { PopupMenuInline } from '@etherealengine/client-core/src/user/components/UserMenu/PopupMenuInline'
import { AuthState } from '@etherealengine/client-core/src/user/services/AuthService'
import { userHasAccess } from '@etherealengine/client-core/src/user/userHasAccess'
import { SceneDataType, scenePath } from '@etherealengine/common/src/schema.type.module'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { EditorPage, useStudioEditor } from '@etherealengine/editor/src/pages/EditorPage'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { getMutableState } from '@etherealengine/hyperflux'

const RedirectStudio = () => {
  const { projectName, sceneName } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    Engine.instance.api
      .service(scenePath)
      .get('', { query: { project: projectName, name: sceneName, metadataOnly: true } })
      .then((result) => {
        const sceneResult = result as SceneDataType
        getMutableState(EditorState).merge({
          sceneName,
          projectName,
          sceneID: sceneResult.scenePath
        })
        navigate(`/studio?scenePath=${sceneResult.scenePath}`)
      })
  }, [])

  return <></>
}

const EditorRouter = () => {
  const ready = useStudioEditor()

  if (!ready) return <LoadingCircle message={t('common:loader.loadingEditor')} />

  return (
    <Suspense fallback={<LoadingCircle message={t('common:loader.loadingEditor')} />}>
      <PopupMenuInline />
      <Routes>
        <Route path=":projectName/:sceneName" element={<RedirectStudio />} />
        <Route path="*" element={<EditorPage />} />
      </Routes>
    </Suspense>
  )
}

const EditorProtectedRoutes = () => {
  const location = useLocation()
  const authState = useHookstate(getMutableState(AuthState))
  const user = authState.user
  const [isAuthorized, setAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    if (user.scopes.value) {
      const hasAccess = userHasAccess('editor:write')
      if (!hasAccess) {
        RouterState.navigate('/', { redirectUrl: location.pathname })
        setAuthorized(false)
      } else setAuthorized(true)
    }
  }, [user.scopes])

  if (!isAuthorized) return <LoadingCircle message={t('common:loader.auth')} />

  return <EditorRouter />
}

export default EditorProtectedRoutes
