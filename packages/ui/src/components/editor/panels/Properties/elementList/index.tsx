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

import { startCase } from 'lodash'
import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Component } from '@etherealengine/ecs/src/ComponentFunctions'
import { PositionalAudioComponent } from '@etherealengine/engine/src/audio/components/PositionalAudioComponent'
import { EnvMapBakeComponent } from '@etherealengine/engine/src/scene/components/EnvMapBakeComponent'
import { GroundPlaneComponent } from '@etherealengine/engine/src/scene/components/GroundPlaneComponent'
import { ImageComponent } from '@etherealengine/engine/src/scene/components/ImageComponent'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { ParticleSystemComponent } from '@etherealengine/engine/src/scene/components/ParticleSystemComponent'
import { PortalComponent } from '@etherealengine/engine/src/scene/components/PortalComponent'
import { SDFComponent } from '@etherealengine/engine/src/scene/components/SDFComponent'
import { ScenePreviewCameraComponent } from '@etherealengine/engine/src/scene/components/ScenePreviewCamera'
import { SkyboxComponent } from '@etherealengine/engine/src/scene/components/SkyboxComponent'
import { SpawnPointComponent } from '@etherealengine/engine/src/scene/components/SpawnPointComponent'
import { SplineComponent } from '@etherealengine/engine/src/scene/components/SplineComponent'
import { SplineTrackComponent } from '@etherealengine/engine/src/scene/components/SplineTrackComponent'
import { SystemComponent } from '@etherealengine/engine/src/scene/components/SystemComponent'
import { VariantComponent } from '@etherealengine/engine/src/scene/components/VariantComponent'
import { VideoComponent } from '@etherealengine/engine/src/scene/components/VideoComponent'
import { VolumetricComponent } from '@etherealengine/engine/src/scene/components/VolumetricComponent'
import { defineState, getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'
import { ColliderComponent } from '@etherealengine/spatial/src/physics/components/ColliderComponent'
import { AmbientLightComponent } from '@etherealengine/spatial/src/renderer/components/AmbientLightComponent'
import { DirectionalLightComponent } from '@etherealengine/spatial/src/renderer/components/DirectionalLightComponent'
import { GroupComponent } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { HemisphereLightComponent } from '@etherealengine/spatial/src/renderer/components/HemisphereLightComponent'
import { PointLightComponent } from '@etherealengine/spatial/src/renderer/components/PointLightComponent'
import { SpotLightComponent } from '@etherealengine/spatial/src/renderer/components/SpotLightComponent'

import PlaceHolderIcon from '@mui/icons-material/GroupAddOutlined'

import { ItemTypes } from '@etherealengine/editor/src/constants/AssetTypes'
import { ComponentEditorsState } from '@etherealengine/editor/src/functions/ComponentEditors'
import { EditorControlFunctions } from '@etherealengine/editor/src/functions/EditorControlFunctions'
import { SelectionState } from '@etherealengine/editor/src/services/SelectionServices'
import { VisualScriptComponent } from '@etherealengine/engine'
import { LoopAnimationComponent } from '@etherealengine/engine/src/avatar/components/LoopAnimationComponent'
import { GrabbableComponent } from '@etherealengine/engine/src/interaction/components/GrabbableComponent'
import { InteractableComponent } from '@etherealengine/engine/src/interaction/components/InteractableComponent'
import { AudioAnalysisComponent } from '@etherealengine/engine/src/scene/components/AudioAnalysisComponent'
import { CameraSettingsComponent } from '@etherealengine/engine/src/scene/components/CameraSettingsComponent'
import { EnvmapComponent } from '@etherealengine/engine/src/scene/components/EnvmapComponent'
import { LinkComponent } from '@etherealengine/engine/src/scene/components/LinkComponent'
import { MediaSettingsComponent } from '@etherealengine/engine/src/scene/components/MediaSettingsComponent'
import { MountPointComponent } from '@etherealengine/engine/src/scene/components/MountPointComponent'
import { PrimitiveGeometryComponent } from '@etherealengine/engine/src/scene/components/PrimitiveGeometryComponent'
import { RenderSettingsComponent } from '@etherealengine/engine/src/scene/components/RenderSettingsComponent'
import { SceneDynamicLoadTagComponent } from '@etherealengine/engine/src/scene/components/SceneDynamicLoadTagComponent'
import { SceneSettingsComponent } from '@etherealengine/engine/src/scene/components/SceneSettingsComponent'
import { ScreenshareTargetComponent } from '@etherealengine/engine/src/scene/components/ScreenshareTargetComponent'
import { ShadowComponent } from '@etherealengine/engine/src/scene/components/ShadowComponent'
import { TextComponent } from '@etherealengine/engine/src/scene/components/TextComponent'
import { InputComponent } from '@etherealengine/spatial/src/input/components/InputComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { TriggerComponent } from '@etherealengine/spatial/src/physics/components/TriggerComponent'
import { PostProcessingComponent } from '@etherealengine/spatial/src/renderer/components/PostProcessingComponent'
import { IoIosArrowDown, IoIosArrowUp } from 'react-icons/io'
import StringInput from '../../../input/String'
import { usePopoverContextClose } from '../../../util/PopoverContext'

export type SceneElementType = {
  componentJsonID: string
  label: string
  Icon: any
  type: typeof ItemTypes.Component
}

export const ComponentShelfCategoriesState = defineState({
  name: 'ee.editor.ComponentShelfCategories',
  initial: () => {
    return {
      Files: [
        ModelComponent,
        VolumetricComponent,
        PositionalAudioComponent,
        AudioAnalysisComponent,
        VideoComponent,
        ImageComponent
      ],
      'Scene Composition': [
        PrimitiveGeometryComponent,
        GroundPlaneComponent,
        GroupComponent,
        VariantComponent,
        SceneDynamicLoadTagComponent
      ],
      Physics: [ColliderComponent, RigidBodyComponent, TriggerComponent],
      Interaction: [
        SpawnPointComponent,
        PortalComponent,
        LinkComponent,
        MountPointComponent,
        InteractableComponent,
        InputComponent,
        GrabbableComponent
      ],
      Lighting: [
        AmbientLightComponent,
        PointLightComponent,
        SpotLightComponent,
        DirectionalLightComponent,
        HemisphereLightComponent
      ],
      FX: [
        LoopAnimationComponent,
        ShadowComponent,
        ParticleSystemComponent,
        EnvmapComponent,
        SDFComponent,
        PostProcessingComponent
      ],
      Scripting: [SystemComponent, VisualScriptComponent],
      Settings: [SceneSettingsComponent, RenderSettingsComponent, MediaSettingsComponent, CameraSettingsComponent],
      Misc: [
        EnvMapBakeComponent,
        ScenePreviewCameraComponent,
        SkyboxComponent,
        SplineTrackComponent,
        SplineComponent,
        TextComponent,
        ScreenshareTargetComponent
      ]
    } as Record<string, Component[]>
  }
})

const ComponentListItem = ({ item }: { item: Component }) => {
  const { t } = useTranslation()
  useHookstate(getMutableState(ComponentEditorsState).keys).value // ensure reactively updates new components
  const Icon = getState(ComponentEditorsState)[item.name]?.iconComponent ?? PlaceHolderIcon
  const handleClosePopover = usePopoverContextClose()

  return (
    <button
      className="bg-theme-primary flex w-full items-center p-4 text-white"
      onClick={() => {
        const entities = SelectionState.getSelectedEntities()
        EditorControlFunctions.addOrRemoveComponent(entities, item, true)
        handleClosePopover()
      }}
    >
      <Icon className="h-6 w-6 text-white" />
      <div className="ml-4 w-full">
        <h3 className="text-subtitle1 text-center text-white">
          {startCase((item.jsonID || item.name).replace('-', ' ').toLowerCase())}
        </h3>
        <p className="text-caption text-center text-white">
          {t(`editor:layout.assetGrid.component-detail.${item.jsonID}`)}
        </p>
      </div>
    </button>
  )
}

const SceneElementListItem = ({
  categoryTitle,
  categoryItems,
  isCollapsed
}: {
  categoryTitle: string
  categoryItems: Component[]
  isCollapsed: boolean
}) => {
  const open = useHookstate(categoryTitle === 'Misc')
  return (
    <>
      <button
        onClick={() => open.set((prev) => !prev)}
        className="bg-theme-primary flex w-full cursor-pointer items-center justify-between px-4 py-2 text-white"
      >
        <span>{categoryTitle}</span>
        {isCollapsed || open.value ? <IoIosArrowUp /> : <IoIosArrowDown />}
      </button>
      <div className={`${isCollapsed || open.value ? '' : 'hidden'}`}>
        <ul className="bg-theme-primary w-full">
          {categoryItems.map((item) => (
            <ComponentListItem key={item.jsonID || item.name} item={item} />
          ))}
        </ul>
      </div>
    </>
  )
}

const useComponentShelfCategories = (search: string) => {
  useHookstate(getMutableState(ComponentShelfCategoriesState)).value

  if (!search) {
    return Object.entries(getState(ComponentShelfCategoriesState))
  }

  const searchRegExp = new RegExp(search, 'gi')

  return Object.entries(getState(ComponentShelfCategoriesState))
    .map(([category, items]) => {
      const filteredItems = items.filter((item) => item.name.match(searchRegExp)?.length)
      return [category, filteredItems] as [string, Component[]]
    })
    .filter(([_, items]) => !!items.length)
}

export function ElementList() {
  const { t } = useTranslation()
  const search = useHookstate({ local: '', query: '' })
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shelves = useComponentShelfCategories(search.query.value)

  const onSearch = (text: string) => {
    search.local.set(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      search.query.set(text)
    }, 50)
  }

  return (
    <>
      <div className="bg-theme-primary h-auto w-full overflow-x-hidden overflow-y-scroll">
        <div className="p-2">
          <h2 className="text-center uppercase text-white">{t('editor:layout.assetGrid.components')}</h2>
          <StringInput
            placeholder={t('editor:layout.assetGrid.components-search')}
            value={search.local.value}
            onChange={(val) => onSearch(val)}
          />
        </div>
      </div>
      {shelves.map(([category, items]) => (
        <SceneElementListItem
          key={category}
          categoryTitle={category}
          categoryItems={items}
          isCollapsed={!!search.query.value}
        />
      ))}
    </>
  )
  {
    /* <List
      sx={{ width: 300, height: 600, bgcolor: 'var(--dockBackground)' }}
      subheader={
        <div style={{ padding: '0.5rem' }}>
          <Typography style={{ color: 'var(--textColor)', textAlign: 'center', textTransform: 'uppercase' }}>
            {t('editor:layout.assetGrid.components')}
          </Typography>
          <InputText
            placeholder={t('editor:layout.assetGrid.components-search')}
            value={search.local.value}
            sx={{ mt: 1 }}
            onChange={(e) => onSearch(e.target.value)}
            inputRef={inputReference}
          />
        </div>
      }
    >
      {shelves.map(([category, items]) => (
       
      ))}
    </List>*/
  }
}

export default ElementList
