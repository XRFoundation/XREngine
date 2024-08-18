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

import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { NO_PROXY, getMutableState, useHookstate, useMutableState } from '@etherealengine/hyperflux'
import { AssetsPanelTab } from '@etherealengine/ui/src/components/editor/panels/Assets'
import { FilesPanelTab } from '@etherealengine/ui/src/components/editor/panels/Files'
import { HierarchyPanelTab } from '@etherealengine/ui/src/components/editor/panels/Hierarchy'
import { MaterialsPanelTab } from '@etherealengine/ui/src/components/editor/panels/Materials'
import { PropertiesPanelTab } from '@etherealengine/ui/src/components/editor/panels/Properties'
import { ScenePanelTab } from '@etherealengine/ui/src/components/editor/panels/Scenes'
import { ViewportPanelTab } from '@etherealengine/ui/src/components/editor/panels/Viewport'
import { VisualScriptPanelTab } from '@etherealengine/ui/src/components/editor/panels/VisualScript'

import ErrorDialog from '@etherealengine/ui/src/components/tailwind/ErrorDialog'
import PopupMenu from '@etherealengine/ui/src/primitives/tailwind/PopupMenu'
import { t } from 'i18next'
import { DockLayout, DockMode, LayoutData } from 'rc-dock'
import React, { useEffect, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import Toolbar from '../components/toolbar/Toolbar'
import { cmdOrCtrlString } from '../functions/utils'
import { EditorErrorState } from '../services/EditorErrorServices'
import { EditorState } from '../services/EditorServices'
import { SelectionState } from '../services/SelectionServices'
import { SaveSceneDialog } from './dialogs/SaveSceneDialog'
import { DndWrapper } from './dnd/DndWrapper'
import DragLayer from './dnd/DragLayer'

import { useZendesk } from '@etherealengine/client-core/src/hooks/useZendesk'
import { API } from '@etherealengine/common'
import { FeatureFlags } from '@etherealengine/common/src/constants/FeatureFlags'
import { EntityUUID } from '@etherealengine/ecs'
import useFeatureFlags from '@etherealengine/engine/src/useFeatureFlags'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import 'rc-dock/dist/rc-dock.css'
import { useTranslation } from 'react-i18next'
import { IoHelpCircleOutline } from 'react-icons/io5'
import { setCurrentEditorScene } from '../functions/sceneFunctions'
import './EditorContainer.css'

export const DockContainer = ({ children, id = 'editor-dock', dividerAlpha = 0 }) => {
  const dockContainerStyles = {
    '--dividerAlpha': dividerAlpha
  }

  return (
    <div id={id} className="dock-container" style={dockContainerStyles as React.CSSProperties}>
      {children}
    </div>
  )
}

const onEditorError = (error) => {
  console.error(error)
  if (error['aborted']) {
    PopoverState.hidePopupover()
    return
  }

  PopoverState.showPopupover(
    <ErrorDialog title={error.title || t('editor:error')} description={error.message || t('editor:errorMsg')} />
  )
}

const defaultLayout = (flags: { visualScriptPanelEnabled: boolean }): LayoutData => {
  const tabs = [ScenePanelTab, FilesPanelTab, AssetsPanelTab]
  flags.visualScriptPanelEnabled && tabs.push(VisualScriptPanelTab)

  return {
    dockbox: {
      mode: 'horizontal' as DockMode,
      children: [
        {
          mode: 'vertical' as DockMode,
          size: 8,
          children: [
            {
              tabs: [ViewportPanelTab]
            },
            {
              tabs: tabs
            }
          ]
        },
        {
          mode: 'vertical' as DockMode,
          size: 3,
          children: [
            {
              tabs: [HierarchyPanelTab, MaterialsPanelTab]
            },
            {
              tabs: [PropertiesPanelTab]
            }
          ]
        }
      ]
    }
  }
}

const EditorContainer = () => {
  const { sceneAssetID, sceneName, projectName, scenePath, uiEnabled, uiAddons } = useMutableState(EditorState)

  const currentLoadedSceneURL = useHookstate(null as string | null)

  /**
   * what is our source of truth for which scene is loaded?
   *      EditorState.scenePath
   * because we DO NOT want url hashes to trigger a scene reload
   */

  /** we don't want to use useFind here, because we don't want all static-resource query refetches to potentially reload the scene */
  useEffect(() => {
    if (!scenePath.value) return

    const abortController = new AbortController()
    API.instance
      .service(staticResourcePath)
      .find({
        query: { key: scenePath.value, type: 'scene', $limit: 1 }
      })
      .then((result) => {
        if (abortController.signal.aborted) return

        const scene = result.data[0]
        if (!scene) {
          console.error('Scene not found')
          sceneName.set(null)
          sceneAssetID.set(null)
          currentLoadedSceneURL.set(null)
          return
        }

        projectName.set(scene.project!)
        sceneName.set(scene.key.split('/').pop() ?? null)
        sceneAssetID.set(scene.id)
        currentLoadedSceneURL.set(scene.url)
      })

    return () => {
      abortController.abort()
    }
  }, [scenePath.value])

  const viewerEntity = useMutableState(EngineState).viewerEntity.value

  useEffect(() => {
    if (!sceneAssetID.value || !currentLoadedSceneURL.value || !viewerEntity) return
    return setCurrentEditorScene(currentLoadedSceneURL.value, sceneAssetID.value as EntityUUID)
  }, [viewerEntity, currentLoadedSceneURL.value])

  const errorState = useHookstate(getMutableState(EditorErrorState).error)

  const dockPanelRef = useRef<DockLayout>(null)

  useHotkeys(`${cmdOrCtrlString}+s`, (e) => {
    e.preventDefault()
    PopoverState.showPopupover(<SaveSceneDialog />)
  })

  const { initialized, isWidgetVisible, openChat } = useZendesk()
  const { t } = useTranslation()

  const [visualScriptPanelEnabled] = useFeatureFlags([FeatureFlags.Studio.Panel.VisualScript])

  useEffect(() => {
    return () => {
      getMutableState(SelectionState).selectedEntities.set([])
    }
  }, [scenePath])

  useEffect(() => {
    if (errorState.value) {
      onEditorError(errorState.value)
    }
  }, [errorState])

  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (EditorState.isModified()) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <main className="pointer-events-auto">
      <div
        id="editor-container"
        className="flex flex-col bg-black"
        style={scenePath.value ? { background: 'transparent' } : {}}
      >
        {uiEnabled.value && (
          <DndWrapper id="editor-container">
            <DragLayer />
            <Toolbar />
            <div className="mt-1 flex overflow-hidden">
              <DockContainer>
                <DockLayout
                  ref={dockPanelRef}
                  defaultLayout={defaultLayout({ visualScriptPanelEnabled })}
                  style={{ position: 'absolute', left: 5, top: 45, right: 5, bottom: 5 }}
                />
              </DockContainer>
            </div>
          </DndWrapper>
        )}
        {Object.entries(uiAddons.container.get(NO_PROXY)).map(([key, value]) => {
          return value
        })}
      </div>
      <PopupMenu />
      {!isWidgetVisible && initialized && (
        <Button
          rounded="partial"
          size="small"
          className="absolute bottom-5 right-5 z-10"
          startIcon={<IoHelpCircleOutline fontSize={20} />}
          onClick={openChat}
        >
          {t('editor:help')}
        </Button>
      )}
    </main>
  )
}

export default EditorContainer
