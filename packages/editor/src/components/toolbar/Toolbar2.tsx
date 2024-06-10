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
import { useProjectPermissions } from '@etherealengine/client-core/src/user/useUserProjectPermission'
import { useUserHasAccessHook } from '@etherealengine/client-core/src/user/userHasAccess'
import { GLTFModifiedState } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { getMutableState, getState, useHookstate, useMutableState } from '@etherealengine/hyperflux'
import ContextMenu from '@etherealengine/ui/src/components/editor/layout/ContextMenu'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import { t } from 'i18next'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineKeyboardArrowDown } from 'react-icons/md'
import { RxHamburgerMenu } from 'react-icons/rx'
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

  const { projectName, sceneName } = useMutableState(EditorState)

  const hasLocationWriteScope = useUserHasAccessHook('location:write')
  const permission = useProjectPermissions(projectName.value!)
  const hasPublishAccess = hasLocationWriteScope || permission?.type === 'owner' || permission?.type === 'editor'

  return (
    <>
      <div className="flex items-center justify-between bg-theme-primary">
        <div className="flex items-center">
          <div className="ml-3 mr-6 cursor-pointer" onClick={onCloseProject}>
            <img src="favicon-32x32.png" alt="iR Engine Logo" className={`h-7 w-7 opacity-50`} />
          </div>
          <Button
            endIcon={<MdOutlineKeyboardArrowDown size="1em" className="-ml-3 text-[#A3A3A3]" />}
            iconContainerClassName="ml-2 mr-1"
            rounded="none"
            startIcon={<RxHamburgerMenu size={24} className="text-[#9CA0AA]" />}
            className="-mr-1 border-0 bg-transparent p-0"
            onClick={(event) => {
              anchorOpen.set(true)
              anchorPosition.set({ left: event.clientX - 5, top: event.clientY - 2 })
              anchorEl.set(event.currentTarget)
            }}
          />
        </div>
        {/* TO BE ADDED */}
        {/* <div className="flex items-center gap-2.5 rounded-full bg-theme-surface-main p-0.5">
          <div className="rounded-2xl px-2.5">{t('editor:toolbar.lbl-simple')}</div>
          <div className="rounded-2xl bg-blue-primary px-2.5">{t('editor:toolbar.lbl-advanced')}</div>
        </div> */}
        <div className="flex items-center gap-2.5">
          <span className="text-[#B2B5BD]">{projectName.value}</span>
          <span>/</span>
          <span>{sceneName.value}</span>
        </div>
        <Button rounded="none" disabled={!hasPublishAccess}>
          {t('editor:toolbar.lbl-publish')}
        </Button>
      </div>
      <ContextMenu
        anchorEl={anchorEl.value as HTMLElement}
        anchorPosition={anchorPosition.value}
        open={anchorOpen.value}
        panelId="toolbar-menu"
        onClose={() => anchorOpen.set(false)}
      >
        {toolbarMenu.map(({ name, action, hotkey }, index) => (
          <div key={index}>
            <Button
              className="px-4 py-[10px] text-left font-light text-[#9CA0AA]"
              textContainerClassName="text-xs"
              variant="sidebar"
              size="small"
              fullWidth
              onClick={action}
              endIcon={hotkey}
            >
              {name}
            </Button>
          </div>
        ))}
      </ContextMenu>
    </>
  )
}
