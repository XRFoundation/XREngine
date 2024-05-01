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
import { RouterState } from '@etherealengine/client-core/src/common/services/RouterService'
import multiLogger from '@etherealengine/common/src/logger'
import { assetPath } from '@etherealengine/common/src/schema.type.module'
import { EntityUUID, useComponent } from '@etherealengine/ecs'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { useQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { GLTFComponent } from '@etherealengine/engine/src/gltf/GLTFComponent'
import { ResourcePendingComponent } from '@etherealengine/engine/src/gltf/ResourcePendingComponent'
import { SceneState } from '@etherealengine/engine/src/scene/SceneState'
import { getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import CircularProgress from '@etherealengine/ui/src/primitives/mui/CircularProgress'
import Dialog from '@mui/material/Dialog'
import { t } from 'i18next'
import { DockLayout, DockMode, LayoutData, PanelData, TabData } from 'rc-dock'
import 'rc-dock/dist/rc-dock.css'
import React, { useEffect, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { inputFileWithAddToScene } from '../functions/assetFunctions'
import { onNewScene, saveSceneGLTF, setCurrentEditorScene } from '../functions/sceneFunctions'
import { cmdOrCtrlString } from '../functions/utils'
import { EditorErrorState } from '../services/EditorErrorServices'
import { EditorState } from '../services/EditorServices'
import { SelectionState } from '../services/SelectionServices'
import './EditorContainer.css'
import AssetDropZone from './assets/AssetDropZone'
import ImportSettingsPanel from './assets/ImportSettingsPanel'
import { ProjectBrowserPanelTab } from './assets/ProjectBrowserPanel'
import { SceneAssetsPanelTab } from './assets/SceneAssetsPanel'
import { ScenePanelTab } from './assets/ScenesPanel'
import { ControlText } from './controlText/ControlText'
import { DialogState } from './dialogs/DialogState'
import ErrorDialog from './dialogs/ErrorDialog'
import { ProgressDialog } from './dialogs/ProgressDialog'
import SaveNewSceneDialog from './dialogs/SaveNewSceneDialog'
import SaveSceneDialog from './dialogs/SaveSceneDialog'
import { DndWrapper } from './dnd/DndWrapper'
import DragLayer from './dnd/DragLayer'
import { PropertiesPanelTab } from './element/PropertiesPanel'
import { HierarchyPanelTab } from './hierarchy/HierarchyPanel'
import { MaterialLibraryPanelTab } from './materials/MaterialLibraryPanel'
import { ViewportPanelTab } from './panels/ViewportPanel'
import * as styles from './styles.module.scss'
import ToolBar from './toolbar/ToolBar'
import { VisualScriptPanelTab } from './visualScript/VisualScriptPanel'

const logger = multiLogger.child({ component: 'editor:EditorContainer' })

/**
 *component used as dock container.
 */
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

const SceneLoadingProgress = () => {
  const rootEntity = useHookstate(getMutableState(EditorState).rootEntity).value
  const progress = useComponent(rootEntity, GLTFComponent).progress.value
  const resourcePendingQuery = useQuery([ResourcePendingComponent])

  if (progress === 100) return null

  return (
    <div style={{ top: '50px', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          height: '100%',
          width: '100%',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            // default values will be overridden by theme
            fontFamily: 'Lato',
            fontSize: '12px',
            color: 'white',
            padding: '16px'
          }}
        >
          {`Scene Loading... ${progress}% - ${resourcePendingQuery.length} assets left`}
        </div>
        <CircularProgress />
      </div>
    </div>
  )
}

/**
 * Scene Event Handlers
 */

const onEditorError = (error) => {
  logger.error(error)
  if (error['aborted']) {
    DialogState.setDialog(null)
    return
  }

  DialogState.setDialog(
    <ErrorDialog
      title={error.title || t('editor:error')}
      message={error.message || t('editor:errorMsg')}
      error={error}
    />
  )
}

const onCloseProject = () => {
  const editorState = getMutableState(EditorState)
  const sceneState = getMutableState(SceneState)
  sceneState.sceneModified.set(false)
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

const onSaveAs = async () => {
  const { sceneAssetID, projectName, sceneName } = getState(EditorState)
  const { sceneModified } = getState(SceneState)

  const abortController = new AbortController()
  try {
    if (sceneName || sceneModified) {
      const result: { name: string } | void = await new Promise((resolve) => {
        DialogState.setDialog(<SaveNewSceneDialog initialName={'New Scene'} onConfirm={resolve} onCancel={resolve} />)
      })
      DialogState.setDialog(null)
      if (result?.name && projectName) {
        await saveSceneGLTF(sceneAssetID, projectName, result.name, abortController.signal)
        getMutableState(SceneState).sceneModified.set(false)
        const newSceneData = await Engine.instance.api
          .service(assetPath)
          .find({ query: { assetURL: getState(EditorState).scenePath! } })
        getMutableState(EditorState).scenePath.set(newSceneData.data[0].assetURL as any)
      }
    }
  } catch (error) {
    logger.error(error)
    DialogState.setDialog(
      <ErrorDialog title={t('editor:savingError')} message={error?.message || t('editor:savingErrorMsg')} />
    )
  }
}

const onImportSettings = () => {
  DialogState.setDialog(<ImportSettingsPanel />)
}

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

const onSaveScene = async () => {
  const { sceneAssetID, projectName, sceneName } = getState(EditorState)
  const { sceneModified } = getState(SceneState)

  if (!projectName) return

  if (!sceneName) {
    if (sceneModified) {
      onSaveAs()
    }
    return
  }

  const result = (await new Promise((resolve) => {
    DialogState.setDialog(<SaveSceneDialog onConfirm={resolve} onCancel={resolve} />)
  })) as any

  if (!result) {
    DialogState.setDialog(null)
    return
  }

  const abortController = new AbortController()

  DialogState.setDialog(
    <ProgressDialog
      message={t('editor:saving')}
      cancelable={true}
      onCancel={() => {
        abortController.abort()
        DialogState.setDialog(null)
      }}
    />
  )

  // Wait for 5ms so that the ProgressDialog shows up.
  await new Promise((resolve) => setTimeout(resolve, 5))

  try {
    await saveSceneGLTF(sceneAssetID, projectName, sceneName, abortController.signal)

    getMutableState(SceneState).sceneModified.set(false)

    DialogState.setDialog(null)
  } catch (error) {
    logger.error(error)

    DialogState.setDialog(
      <ErrorDialog title={t('editor:savingError')} message={error.message || t('editor:savingErrorMsg')} />
    )
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
      action: () => onSaveScene()
    },
    {
      name: t('editor:menubar.saveAs'),
      action: onSaveAs
    },
    {
      name: t('editor:menubar.importSettings'),
      action: onImportSettings
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

//const defaultLayout: LayoutData = useHookstate(getMutableState(EditorState).panelLayout).value

const defaultLayout: LayoutData = {
  dockbox: {
    mode: 'horizontal' as DockMode,
    children: [
      {
        mode: 'vertical' as DockMode,
        size: 3,
        children: [
          {
            tabs: [ScenePanelTab, ProjectBrowserPanelTab, SceneAssetsPanelTab]
          }
        ]
      },
      {
        mode: 'vertical' as DockMode,
        size: 8,
        children: [
          {
            id: '+5',
            tabs: [ViewportPanelTab],
            size: 1
          }
        ]
      },
      {
        mode: 'vertical' as DockMode,
        size: 2,
        children: [
          {
            tabs: [HierarchyPanelTab, MaterialLibraryPanelTab]
          },
          {
            tabs: [PropertiesPanelTab, VisualScriptPanelTab]
          }
        ]
      }
    ]
  }
}

const tabs = [
  HierarchyPanelTab,
  PropertiesPanelTab,
  VisualScriptPanelTab,
  MaterialLibraryPanelTab,
  ViewportPanelTab,
  ProjectBrowserPanelTab,
  ScenePanelTab
]

/**
 * EditorContainer class used for creating container for Editor
 */
const EditorContainer = () => {
  const { sceneAssetID, sceneName, projectName, scenePath, rootEntity } = useHookstate(getMutableState(EditorState))
  const { sceneLoaded, sceneModified } = useHookstate(getMutableState(SceneState))
  const sceneQuery = useFind(assetPath, { query: { assetURL: scenePath.value ?? '' } }).data
  const sceneURL = sceneQuery?.[0]?.assetURL

  const errorState = useHookstate(getMutableState(EditorErrorState).error)

  const dialogComponent = useHookstate(getMutableState(DialogState).dialog).value
  const dockPanelRef = useRef<DockLayout>(null)

  const panelMenu = tabs.map((tab) => {
    return {
      name: tab.title,
      action: () => {
        const currentLayout = dockPanelRef?.current?.getLayout()
        if (!currentLayout) return
        if (dockPanelRef.current!.find(tab.id!)) {
          return
        }
        //todo: add support for multiple instances of a panel type
        // let panelId = panel.id!
        // while (dockPanelRef.current!.find(panelId)) {
        //   if (/\d+$/.test(panelId)) {
        //     panelId = panelId.replace(/\d+$/, (match) => {
        //       return (parseInt(match) + 1).toString()
        //     })
        //   } else {
        //     panelId += '1'
        //   }
        // }
        // panel.id = panelId
        const targetId = tab.parent!.id! ?? currentLayout.dockbox.children[0].id
        const targetPanel = dockPanelRef.current!.find(targetId) as PanelData
        targetPanel.tabs.push(tab)
        dockPanelRef?.current?.loadLayout(currentLayout)
      }
    }
  })

  useHotkeys(`${cmdOrCtrlString}+s`, () => onSaveScene())

  useEffect(() => {
    if (!sceneModified.value) return
    const onBeforeUnload = (e) => {
      alert('You have unsaved changes. Please save before leaving.')
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [sceneModified])

  useEffect(() => {
    if (!sceneURL) return
    const [_, project, scene] = scenePath.value?.split('/') ?? []
    sceneName.set(scene ?? null)
    projectName.set(project ?? null)
    sceneAssetID.set(sceneQuery[0].id)
    return setCurrentEditorScene(sceneURL, sceneQuery[0].id! as EntityUUID)
  }, [sceneURL])

  useEffect(() => {
    return () => {
      getMutableState(SelectionState).selectedEntities.set([])
    }
  }, [scenePath])

  useEffect(() => {
    if (!dockPanelRef.current) return
    const activePanel = sceneLoaded.value ? 'filesPanel' : 'scenePanel'
    dockPanelRef.current.updateTab(activePanel, dockPanelRef.current.find(activePanel) as TabData, true)
  }, [sceneLoaded])

  useEffect(() => {
    if (errorState.value) {
      onEditorError(errorState.value)
    }
  }, [errorState])

  return (
    <>
      <div
        id="editor-container"
        className={styles.editorContainer}
        style={scenePath.value ? { background: 'transparent' } : {}}
      >
        <DndWrapper id="editor-container">
          <DragLayer />
          <ToolBar menu={toolbarMenu} panels={panelMenu} />
          <ControlText />
          {rootEntity.value && <SceneLoadingProgress key={rootEntity.value} />}
          <div className={styles.workspaceContainer}>
            <AssetDropZone />
            <DockContainer>
              <DockLayout
                ref={dockPanelRef}
                defaultLayout={defaultLayout}
                style={{ position: 'absolute', left: 5, top: 55, right: 5, bottom: 5 }}
              />
            </DockContainer>
          </div>
          <Dialog
            open={!!dialogComponent}
            onClose={() => DialogState.setDialog(null)}
            classes={{ root: styles.dialogRoot, paper: styles.dialogPaper }}
          >
            {getState(DialogState).dialog}
          </Dialog>
        </DndWrapper>
      </div>
    </>
  )
}

export default EditorContainer
