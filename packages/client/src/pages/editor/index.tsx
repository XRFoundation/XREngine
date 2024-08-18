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

import { t } from 'i18next'
import React, { Suspense, useEffect } from 'react'

import '../../engine'

import { RouterState } from '@etherealengine/client-core/src/common/services/RouterService'
import Debug from '@etherealengine/client-core/src/components/Debug'
import { PopupMenuInline } from '@etherealengine/client-core/src/user/components/UserMenu/PopupMenuInline'
import { AuthState } from '@etherealengine/client-core/src/user/services/AuthService'
import { userHasAccess } from '@etherealengine/client-core/src/user/userHasAccess'
import { EditorPage, useStudioEditor } from '@etherealengine/editor/src/pages/EditorPage'
import { getMutableState, useHookstate } from '@etherealengine/hyperflux'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'
import { Route, Routes, useLocation } from 'react-router-dom'

export const EditorRouter = () => {
  const ready = useStudioEditor()

  if (!ready) return <LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.loadingStudio')} />

  return (
    <Suspense
      fallback={<LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.loadingStudio')} />}
    >
      <PopupMenuInline />
      <Routes>
        <Route path="*" element={<EditorPage />} />
      </Routes>
    </Suspense>
  )
}

const EditorProtectedRoutes = () => {
  const location = useLocation()
  const authState = useHookstate(getMutableState(AuthState))
  const user = authState.user
  const isAuthorized = useHookstate<boolean | null>(null)

  useEffect(() => {
    if (user.scopes.value) {
      const hasAccess = userHasAccess('editor:write')
      if (!hasAccess) {
        RouterState.navigate('/', { redirectUrl: location.pathname })
        isAuthorized.set(false)
      } else isAuthorized.set(true)
    }
  }, [user.scopes])

  if (!isAuthorized.value) return <LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.auth')} />

  return (
    <>
      <EditorRouter />
      <Debug />
    </>
  )
}

export default EditorProtectedRoutes
