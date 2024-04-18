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

import React from 'react'

import MaterialLibraryIcon from '@mui/icons-material/Yard'

import DockLayout, { DockMode, TabData } from 'rc-dock'
import { useTranslation } from 'react-i18next'
import { DockContainer } from '../EditorContainer'
import { MaterialPreviewPanel } from '../assets/AssetPreviewPanels/MaterialPreviewPanel'
import { PanelDragContainer, PanelIcon, PanelTitle } from '../layout/Panel'
import MaterialLibraryPanel from './MaterialLibraryPanelContainer'

export const MaterialLibraryPanelTitle = () => {
  const { t } = useTranslation()
  const materialPreviewPanelRef = React.useRef()
  // const onLayoutChangedCallback = () => {
  //   ;(assetsPreviewPanelRef as any).current?.onLayoutChanged?.()
  // }

  // const onSelectionChanged = (props: AssetSelectionChangePropsType) => {
  //   ;(assetsPreviewPanelRef as any).current?.onSelectionChanged?.(props)
  // }
  const defaultLayout = {
    dockbox: {
      mode: 'vertical' as DockMode,
      children: [
        {
          size: 5,
          mode: 'horizontal' as DockMode,
          children: [
            {
              tabs: [
                {
                  id: 'materialLibraryPanel',
                  title: t('editor:layout.filebrowser.tab-name'),
                  content: <MaterialLibraryPanel />
                }
              ]
            }
          ]
        },
        {
          size: 5,
          tabs: [
            {
              id: 'previewPanel',
              title: t('editor:layout.scene-assets.preview'),
              cached: true,
              content: <MaterialPreviewPanel ref={materialPreviewPanelRef} />
            }
          ]
        }
      ]
    }
  }

  return (
    <>
      <DockContainer id="materialLibraryPanel" dividerAlpha={0.3}>
        <DockLayout
          defaultLayout={defaultLayout}
          style={{ pointerEvents: 'none', position: 'absolute', left: 0, top: 5, right: 5, bottom: 5 }}
          //onLayoutChange={onLayoutChangedCallback}
        />
      </DockContainer>
    </>
  )
}

export const MaterialLibraryPanelTab: TabData = {
  id: 'materialLibraryPanel',
  closable: true,
  cached: true,
  title: (
    <PanelDragContainer>
      <PanelIcon as={MaterialLibraryIcon} size={12} />
      <PanelTitle>Material Library</PanelTitle>
    </PanelDragContainer>
  ),
  content: <MaterialLibraryPanelTitle />
}
