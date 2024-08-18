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
import { SnackbarProvider } from 'notistack'
import React, { useEffect, useRef, useState } from 'react'

// import { useTranslation } from 'react-i18next'

// import { useLocation, useNavigate } from 'react-router-dom'

import { NotificationState } from '@etherealengine/client-core/src/common/services/NotificationService'
import { ProjectService, ProjectState } from '@etherealengine/client-core/src/common/services/ProjectService'
import { LocationState } from '@etherealengine/client-core/src/social/services/LocationService'
import { AuthService, AuthState } from '@etherealengine/client-core/src/user/services/AuthService'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { getMutableState, useMutableState } from '@etherealengine/hyperflux'
import { NetworkState } from '@etherealengine/network'
import { loadEngineInjection } from '@etherealengine/projects/loadEngineInjection'

import Component from './index'

import '@etherealengine/client/src/themes/base.css'
import '@etherealengine/client/src/themes/components.css'
import '@etherealengine/client/src/themes/utilities.css'
import 'tailwindcss/tailwind.css'

// import { useLocation } from 'react-router-dom'

const argTypes = {}
const decorators = [
  (Story) => {
    const notistackRef = useRef<SnackbarProvider>()
    const authState = useMutableState(AuthState)
    const selfUser = authState.user

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [projectComponents, setProjectComponents] = useState<Array<any>>([])
    const [fetchedProjectComponents, setFetchedProjectComponents] = useState(false)
    const projectState = useMutableState(ProjectState)

    const notificationstate = useMutableState(NotificationState)

    useEffect(() => {
      notificationstate.snackbar.set(notistackRef.current)
    }, [notistackRef.current])

    useEffect(() => {
      if (selfUser?.id.value && projectState.updateNeeded.value) {
        ProjectService.fetchProjects()
        if (!fetchedProjectComponents) {
          setFetchedProjectComponents(true)
          loadEngineInjection().then((result) => {
            LocationState.setLocationName(locationName)
            setProjectComponents(result)
          })
        }
      }
    }, [selfUser, projectState.updateNeeded.value])

    useEffect(() => {
      Engine.instance.store.userID = selfUser.id.value
    }, [selfUser.id])

    useEffect(() => {
      // Oauth callbacks may be running when a guest identity-provider has been deleted.
      // This would normally cause doLoginAuto to make a guest user, which we do not want.
      // Instead, just skip it on oauth callbacks, and the callback handler will log them in.
      // The client and auth settigns will not be needed on these routes
      if (!location.pathname.startsWith('/auth')) {
        AuthService.doLoginAuto()
      }

      getMutableState(NetworkState).config.set({
        world: true,
        media: true,
        friends: false,
        instanceID: true,
        roomID: false
      })
    }, [])

    AuthService.useAPIListeners()

    const locationName = 'default'

    // const engineState = useMutableState(EngineState)

    return (
      <div className="container mx-auto h-full w-full">
        <Story />
        {projectComponents}
      </div>
    )
  }
]
export default {
  title: 'Pages/Capture',
  component: Component,
  decorators,
  parameters: {
    reactRouter: {
      routePath: '/capture/:locationName',
      routeParams: { locationName: 'default' }
    },
    componentSubtitle: 'Capture',
    jest: 'Capture.test.tsx',
    design: {
      type: 'figma',
      url: ''
    }
  },
  argTypes
}

export const Default = { args: Component.defaultProps }
