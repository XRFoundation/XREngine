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

import { NotificationService } from '@etherealengine/client-core/src/common/services/NotificationService'
import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { RouterState } from '@etherealengine/client-core/src/common/services/RouterService'
import { GLTFModifiedState } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'
import ContextMenu from '@etherealengine/ui/src/components/editor/layout/ContextMenu'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import { t } from 'i18next'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { PiSquaresFourThin } from 'react-icons/pi'
import { inputFileWithAddToScene } from '../../functions/assetFunctions'
import { onNewScene } from '../../functions/sceneFunctions'
import { cmdOrCtrlString } from '../../functions/utils'
import { EditorState } from '../../services/EditorServices'
import ImportSettingsPanel from '../dialogs/ImportSettingsPanelDialog2'
import { SaveNewSceneDialog, SaveSceneDialog } from '../dialogs/SaveSceneDialog2'

const onImportAsset = async () => {
  const { projectName } = getState(EditorState)

  if (projectName) {
    try {
      await inputFileWithAddToScene({ projectName })
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  }
}

const onCloseProject = () => {
  const editorState = getMutableState(EditorState)
  getMutableState(GLTFModifiedState).set({})
  editorState.projectName.set(null)
  editorState.scenePath.set(null)
  editorState.sceneName.set(null)
  RouterState.navigate('/studio')

  const parsed = new URL(window.location.href)
  const query = parsed.searchParams

  query.delete('project')
  query.delete('scenePath')

  parsed.search = query.toString()
  if (typeof history.pushState !== 'undefined') {
    window.history.replaceState({}, '', parsed.toString())
  }
}

const generateToolbarMenu = () => {
  return [
    {
      name: t('editor:menubar.newScene'),
      action: onNewScene
    },
    {
      name: t('editor:menubar.saveScene'),
      hotkey: `${cmdOrCtrlString}+s`,
      action: () => PopoverState.showPopupover(<SaveSceneDialog />)
    },
    {
      name: t('editor:menubar.saveAs'),
      action: () => PopoverState.showPopupover(<SaveNewSceneDialog />)
    },
    {
      name: t('editor:menubar.importSettings'),
      action: () => PopoverState.showPopupover(<ImportSettingsPanel />)
    },
    {
      name: t('editor:menubar.importAsset'),
      action: onImportAsset
    },
    {
      name: t('editor:menubar.quit'),
      action: onCloseProject
    }
  ]
}

const toolbarMenu = generateToolbarMenu()

export default function Toolbar() {
  const { t } = useTranslation()
  const anchorEl = useHookstate<HTMLElement | null>(null)
  const anchorPosition = useHookstate({ left: 0, top: 0 })
  const anchorOpen = useHookstate(false)

  return (
    <>
      <div className="bg-theme-primary flex items-center justify-between">
        <Button
          variant="outline"
          rounded="none"
          startIcon={<PiSquaresFourThin />}
          className="border-0 bg-transparent"
          onClick={(event) => {
            anchorOpen.set(true)
            anchorPosition.set({ left: event.clientX - 5, top: event.clientY - 2 })
            anchorEl.set(event.currentTarget)
          }}
        />
        <div className="bg-theme-surface-main flex items-center gap-2.5 rounded-full p-0.5">
          <div className="rounded-2xl px-2.5">{t('editor:toolbar.lbl-simple')}</div>
          <div className="bg-blue-primary rounded-2xl px-2.5">{t('editor:toolbar.lbl-advanced')}</div>
        </div>
        <Button rounded="none">{t('editor:toolbar.lbl-publish')}</Button>
      </div>
      <ContextMenu
        anchorEl={anchorEl.value}
        anchorPosition={anchorPosition.value}
        open={anchorOpen.value}
        panelId="toolbar-menu"
        onClose={() => anchorOpen.set(false)}
      >
        {toolbarMenu.map(({ name, action, hotkey }, index) => (
          <div key={index} className="m-1">
            <Button size="small" variant="outline" fullWidth onClick={action} endIcon={hotkey}>
              {name}
            </Button>
          </div>
        ))}
      </ContextMenu>
    </>
  )
}
