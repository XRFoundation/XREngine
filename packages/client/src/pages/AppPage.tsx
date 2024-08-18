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

// import * as chapiWalletPolyfill from 'credential-handler-polyfill'

import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { initGA, logPageView } from '@etherealengine/client-core/src/common/analytics'
import { NotificationSnackbar } from '@etherealengine/client-core/src/common/services/NotificationService'
import { useSearchParamState } from '@etherealengine/client-core/src/common/services/RouterService'
import { useThemeProvider } from '@etherealengine/client-core/src/common/services/ThemeService'
import InviteToast from '@etherealengine/client-core/src/components/InviteToast'
import { LoadWebappInjection } from '@etherealengine/client-core/src/components/LoadWebappInjection'
import { useAuthenticated } from '@etherealengine/client-core/src/user/services/AuthService'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'

import './mui.styles.scss' /** @todo Remove when MUI is removed */
import './styles.scss'

const AppPage = (props: { children: React.ReactNode }) => {
  const { t } = useTranslation()
  const isLoggedIn = useAuthenticated()

  useEffect(() => {
    initGA()
    logPageView()
  }, [])

  useThemeProvider()

  useSearchParamState()

  if (!isLoggedIn) {
    return <LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.loadingApp')} />
  }

  return (
    <>
      <NotificationSnackbar />
      <LoadWebappInjection>{props.children}</LoadWebappInjection>
      <InviteToast />
    </>
  )
}

export default AppPage
