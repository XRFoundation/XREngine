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
import React from 'react'
import { useTranslation } from 'react-i18next'

import { useWorldNetwork } from '@etherealengine/client-core/src/common/services/LocationInstanceConnectionService'
import { LoadingCircle } from '@etherealengine/client-core/src/components/LoadingCircle'
import {
  SocketWebRTCClientNetwork,
  leaveNetwork
} from '@etherealengine/client-core/src/transports/SocketWebRTCClientFunctions'
import { getMutableState } from '@etherealengine/hyperflux'

import DirectionsRun from '@mui/icons-material/DirectionsRun'
import DoneIcon from '@mui/icons-material/Done'

import { NetworkState } from '@etherealengine/network'
import { EditorState } from '../../services/EditorServices'
import SelectInput from '../inputs/SelectInput'
import { InfoTooltip } from '../layout/Tooltip'
import * as styles from '../toolbar/styles.module.scss'
import { EditorActiveInstanceState } from './EditorActiveInstanceService'

export const WorldInstanceConnection = () => {
  const { t } = useTranslation()
  const activeInstanceState = useHookstate(getMutableState(EditorActiveInstanceState))
  const activeInstances = [
    {
      label: t('editor:toolbar.instance.none'),
      value: 'None'
    }
  ].concat(
    activeInstanceState.activeInstances.value.map((instance) => {
      return {
        label: `${instance.id} (${instance.currentUsers} ${
          instance.currentUsers === 1 ? t('editor:toolbar.instance.user') : t('editor:toolbar.instance.users')
        })`,
        value: instance.id
      }
    })
  )

  const editorState = useHookstate(getMutableState(EditorState))
  const sceneId = editorState.sceneID.value!

  const onSelectInstance = (selectedInstance: string) => {
    if (selectedInstance === 'None' || (worldNetworkHostId && selectedInstance !== worldNetworkHostId)) {
      /** @todo reassess if this is still necessary */
      if (worldNetworkHostId) leaveNetwork(NetworkState.worldNetwork as SocketWebRTCClientNetwork)
      return
    }
    const instance = activeInstanceState.activeInstances.value.find(({ id }) => id === selectedInstance)
    if (!instance) return
    EditorActiveInstanceState.provisionServer(instance.locationId!, instance.id, sceneId)
  }
  // const decrementPage = () => { }
  // const incrementPage = () => { }

  const worldNetworkHostId = NetworkState.worldNetwork?.id
  const networkState = useWorldNetwork()

  const getIcon = () => {
    if (networkState?.value) {
      if (!networkState.ready.value) return <LoadingCircle message={t('common:loader.connectingToWorld')} />
      return <DoneIcon fontSize="small" />
    }
    return <DirectionsRun fontSize="small" />
  }

  return (
    <div className={styles.toolbarInputGroup} id="transform-space">
      <InfoTooltip title="Active Instances">{getIcon()}</InfoTooltip>
      <SelectInput
        className={styles.selectInput}
        onChange={onSelectInstance}
        options={activeInstances}
        value={'None'}
        creatable={false}
        isSearchable={false}
      />
      {/* <button onClick={decrementPage} className={styles.toolButton} >Previous Page</button>
      <button onClick={incrementPage} className={styles.toolButton} >Next Page</button> */}
    </div>
  )
}
