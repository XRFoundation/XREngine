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

import getImagePalette from 'image-palette-core'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { SceneSettingsComponent } from '@etherealengine/engine/src/scene/components/SceneSettingsComponent'

import { LoadingCircle } from '@etherealengine/client-core/src/components/LoadingCircle'
import {
  blurAndScaleImageData,
  convertImageDataToKTX2Blob,
  imageDataToBlob
} from '@etherealengine/engine/src/scene/classes/ImageUtils'
import { getState } from '@etherealengine/hyperflux'
import { useHookstate } from '@hookstate/core'
import { Color } from 'three'
import { uploadProjectFiles } from '../../functions/assetFunctions'
import { takeScreenshot } from '../../functions/takeScreenshot'
import { generateEnvmapBake } from '../../functions/uploadEnvMapBake'
import { EditorState } from '../../services/EditorServices'
import { PropertiesPanelButton } from '../inputs/Button'
import ColorInput from '../inputs/ColorInput'
import ImagePreviewInput from '../inputs/ImagePreviewInput'
import InputGroup from '../inputs/InputGroup'
import NumericInputGroup from '../inputs/NumericInputGroup'
import PropertyGroup from './PropertyGroup'
import { EditorComponentType, commitProperties, commitProperty, updateProperty } from './Util'

export const SceneSettingsEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const sceneSettingsComponent = useComponent(props.entity, SceneSettingsComponent)
  const state = useHookstate({
    thumbnailURL: null as string | null,
    thumbnail: null as File | null,
    uploadingThumbnail: false,
    loadingScreenURL: null as string | null,
    loadingScreenImageData: null as ImageData | null,
    uploadingLoadingScreen: false,
    resolution: 2048
  })

  const createThumbnail = async () => {
    const thumbnailBlob = await takeScreenshot(512, 320, 'jpeg')
    if (!thumbnailBlob) return
    const thumbnailURL = URL.createObjectURL(thumbnailBlob)
    const file = new File([thumbnailBlob!], getState(EditorState).sceneName + '.thumbnail.jpg')
    state.merge({
      thumbnailURL,
      thumbnail: file
    })
  }

  const uploadThumbnail = async () => {
    if (!state.thumbnail.value) return
    state.uploadingThumbnail.set(true)
    const editorState = getState(EditorState)
    const projectName = editorState.projectName!
    const { promises } = uploadProjectFiles(projectName, [state.thumbnail.value])
    const [[savedThumbnailURL]] = await Promise.all(promises)
    commitProperty(SceneSettingsComponent, 'thumbnailURL')(savedThumbnailURL)
    state.merge({
      thumbnailURL: null,
      thumbnail: null,
      uploadingThumbnail: false
    })
  }

  const createLoadingScreen = async () => {
    const envmapImageData = generateEnvmapBake(state.resolution.value)
    const blob = await imageDataToBlob(envmapImageData)
    state.merge({
      loadingScreenURL: URL.createObjectURL(blob!),
      loadingScreenImageData: envmapImageData
    })
  }

  const uploadLoadingScreen = async () => {
    const envmapImageData = state.loadingScreenImageData.value
    if (!envmapImageData) return
    state.uploadingLoadingScreen.set(true)

    const loadingScreenImageData = blurAndScaleImageData(envmapImageData, 2048, 2048, 6, 512)

    const [envmap, loadingScreen] = await Promise.all([
      convertImageDataToKTX2Blob(envmapImageData),
      convertImageDataToKTX2Blob(loadingScreenImageData)
    ])

    if (!envmap || !loadingScreen) return null!

    const editorState = getState(EditorState)
    const sceneName = editorState.sceneName!
    const projectName = editorState.projectName!
    const envmapFilename = `${sceneName}.envmap.ktx2`
    const loadingScreenFilename = `${sceneName}.loadingscreen.ktx2`

    const promises = uploadProjectFiles(projectName, [
      new File([envmap], envmapFilename),
      new File([loadingScreen], loadingScreenFilename)
    ])

    const [[envmapURL], [loadingScreenURL]] = await Promise.all(promises.promises)

    commitProperty(SceneSettingsComponent, 'loadingScreenURL')(loadingScreenURL)
    state.merge({
      loadingScreenURL: null,
      loadingScreenImageData: null,
      uploadingLoadingScreen: false
    })
  }

  const generateColors = () => {
    const url = state.thumbnailURL.value ?? sceneSettingsComponent.thumbnailURL.value
    if (!url) return
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.onload = () => {
      const palette = getImagePalette(image)
      if (palette) {
        commitProperties(SceneSettingsComponent, {
          primaryColor: palette.color,
          backgroundColor: palette.backgroundColor,
          alternativeColor: palette.alternativeColor
        })
      }
    }
    image.src = url
  }

  return (
    <PropertyGroup
      name={t('editor:properties.sceneSettings.name')}
      description={t('editor:properties.sceneSettings.description')}
    >
      <InputGroup
        name="Thumbnail"
        label={t('editor:properties.sceneSettings.lbl-thumbnail')}
        info={t('editor:properties.sceneSettings.info-thumbnail')}
      >
        <div>
          <ImagePreviewInput value={state.thumbnailURL.value ?? sceneSettingsComponent.thumbnailURL.value} />

          <PropertiesPanelButton onClick={createThumbnail}>
            {t('editor:properties.sceneSettings.generate')}
          </PropertiesPanelButton>
          {state.uploadingThumbnail.value ? (
            <LoadingCircle />
          ) : (
            <PropertiesPanelButton onClick={uploadThumbnail} disabled={!state.thumbnail.value}>
              {t('editor:properties.sceneSettings.save')}
            </PropertiesPanelButton>
          )}
        </div>
      </InputGroup>
      <InputGroup
        name="Loading Screen"
        label={t('editor:properties.sceneSettings.lbl-loading')}
        info={t('editor:properties.sceneSettings.info-loading')}
      >
        <div>
          <ImagePreviewInput value={state.loadingScreenURL.value ?? sceneSettingsComponent.loadingScreenURL.value} />
          <PropertiesPanelButton onClick={createLoadingScreen}>
            {t('editor:properties.sceneSettings.generate')}
          </PropertiesPanelButton>
          {state.uploadingLoadingScreen.value ? (
            <LoadingCircle />
          ) : (
            <PropertiesPanelButton onClick={uploadLoadingScreen} disabled={!state.loadingScreenImageData.value}>
              {t('editor:properties.sceneSettings.save')}
            </PropertiesPanelButton>
          )}
        </div>
      </InputGroup>
      <InputGroup name="Primary Color" label={t('editor:properties.sceneSettings.lbl-colors')}>
        <div>
          <ColorInput
            disabled={!state.thumbnailURL.value && !sceneSettingsComponent.thumbnailURL.value}
            value={new Color(sceneSettingsComponent.primaryColor.value)}
            onSelect={(val) => updateProperty(SceneSettingsComponent, 'primaryColor')('#' + val.getHexString())}
            onChange={(val) => updateProperty(SceneSettingsComponent, 'primaryColor')('#' + val.getHexString())}
            onRelease={(val) => commitProperty(SceneSettingsComponent, 'primaryColor')('#' + val.getHexString())}
          />
          <ColorInput
            disabled={!state.thumbnailURL.value && !sceneSettingsComponent.thumbnailURL.value}
            value={new Color(sceneSettingsComponent.backgroundColor.value)}
            onSelect={(val) => updateProperty(SceneSettingsComponent, 'backgroundColor')('#' + val.getHexString())}
            onChange={(val) => updateProperty(SceneSettingsComponent, 'backgroundColor')('#' + val.getHexString())}
            onRelease={(val) => commitProperty(SceneSettingsComponent, 'backgroundColor')('#' + val.getHexString())}
          />
          <ColorInput
            disabled={!state.thumbnailURL.value && !sceneSettingsComponent.thumbnailURL.value}
            value={new Color(sceneSettingsComponent.alternativeColor.value)}
            onSelect={(val) => updateProperty(SceneSettingsComponent, 'alternativeColor')('#' + val.getHexString())}
            onChange={(val) => updateProperty(SceneSettingsComponent, 'alternativeColor')('#' + val.getHexString())}
            onRelease={(val) => commitProperty(SceneSettingsComponent, 'alternativeColor')('#' + val.getHexString())}
          />
          <PropertiesPanelButton onClick={generateColors}>
            {t('editor:properties.sceneSettings.generate')}
          </PropertiesPanelButton>
        </div>
      </InputGroup>
      <NumericInputGroup
        name="Kill Height"
        label={t('editor:properties.sceneSettings.lbl-killHeight')}
        value={sceneSettingsComponent.sceneKillHeight.value}
        onChange={updateProperty(SceneSettingsComponent, 'sceneKillHeight')}
        onRelease={commitProperty(SceneSettingsComponent, 'sceneKillHeight')}
      />
    </PropertyGroup>
  )
}
