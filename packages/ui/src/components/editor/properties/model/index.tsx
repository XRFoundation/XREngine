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

import { VRM } from '@pixiv/three-vrm'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineViewInAr } from 'react-icons/md'
import { Object3D, Scene } from 'three'

import { ProjectState } from '@etherealengine/client-core/src/common/services/ProjectService'
import config from '@etherealengine/common/src/config'
import { FeatureFlags } from '@etherealengine/common/src/constants/FeatureFlags'
import { STATIC_ASSET_REGEX } from '@etherealengine/common/src/regex'
import { pathJoin } from '@etherealengine/common/src/utils/miscUtils'
import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import ErrorPopUp from '@etherealengine/editor/src/components/popup/ErrorPopUp'
import { EditorComponentType, commitProperty } from '@etherealengine/editor/src/components/properties/Util'
import { exportRelativeGLTF } from '@etherealengine/editor/src/functions/exportGLTF'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { ResourceLoaderManager } from '@etherealengine/engine/src/assets/functions/resourceLoaderFunctions'
import { recursiveHipsLookup } from '@etherealengine/engine/src/avatar/AvatarBoneMatching'
import { getEntityErrors } from '@etherealengine/engine/src/scene/components/ErrorComponent'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import useFeatureFlags from '@etherealengine/engine/src/useFeatureFlags'
import { getState, useState } from '@etherealengine/hyperflux'
import Button from '../../../../primitives/tailwind/Button'
import BooleanInput from '../../input/Boolean'
import InputGroup from '../../input/Group'
import ModelInput from '../../input/Model'
import SelectInput from '../../input/Select'
import StringInput from '../../input/String'
import NodeEditor from '../nodeEditor'
import ScreenshareTargetNodeEditor from '../screenShareTarget'
import ModelTransformProperties from './transform'

/**
 * ModelNodeEditor used to create editor view for the properties of ModelNode.
 *
 * @type {class component}
 */
export const ModelNodeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const entity = props.entity
  const modelComponent = useComponent(entity, ModelComponent)
  const exporting = useState(false)
  const bonematchable = useState(false)
  const editorState = getState(EditorState)
  const projectState = getState(ProjectState)
  const loadedProjects = useState(() => projectState.projects.map((project) => project.name))
  const srcProject = useState(() => {
    const match = STATIC_ASSET_REGEX.exec(modelComponent.src.value)
    if (!match?.length) return editorState.projectName!
    const [_, orgName, projectName] = match
    return `${orgName}/${projectName}`
  })

  const [dereferenceFeatureFlag, gltfTransformFeatureFlag] = useFeatureFlags([
    FeatureFlags.Studio.Model.Dereference,
    FeatureFlags.Studio.Model.GLTFTransform
  ])

  const getRelativePath = useCallback(() => {
    const relativePath = STATIC_ASSET_REGEX.exec(modelComponent.src.value)?.[2]
    if (!relativePath) {
      return 'assets/new-model'
    } else {
      //return relativePath without file extension
      return relativePath.replace(/\.[^.]*$/, '')
    }
  }, [modelComponent.src])

  const getExportExtension = useCallback(() => {
    if (!modelComponent.src.value) return 'gltf'
    else return modelComponent.src.value.endsWith('.gltf') ? 'gltf' : 'glb'
  }, [modelComponent.src])

  const srcPath = useState(getRelativePath())

  const exportType = useState(getExportExtension())

  const errors = getEntityErrors(props.entity, ModelComponent)

  const onExportModel = () => {
    if (exporting.value) {
      console.warn('already exporting')
      return
    }
    exporting.set(true)
    const fileName = `${srcPath.value}.${exportType.value}`
    exportRelativeGLTF(entity, srcProject.value, fileName).then(() => {
      const nuPath = pathJoin(config.client.fileServer, 'projects', srcProject.value, fileName)
      commitProperty(ModelComponent, 'src')(nuPath)
      ResourceLoaderManager.updateResource(nuPath)
      exporting.set(false)
    })
  }

  useEffect(() => {
    srcPath.set(getRelativePath())
    exportType.set(getExportExtension())
  }, [modelComponent.src])

  useEffect(() => {
    if (!modelComponent.asset.value) return
    bonematchable.set(
      modelComponent.asset.value &&
        (modelComponent.asset.value instanceof VRM ||
          recursiveHipsLookup(modelComponent.asset.value.scene as Object3D | Scene))
    )
  }, [modelComponent.asset])

  return (
    <NodeEditor
      name={t('editor:properties.model.title')}
      description={t('editor:properties.model.description')}
      icon={<ModelNodeEditor.iconComponent />}
      {...props}
    >
      <InputGroup name="Model Url" label={t('editor:properties.model.lbl-modelurl')}>
        <ModelInput
          value={modelComponent.src.value}
          onRelease={(src) => {
            if (src !== modelComponent.src.value) commitProperty(ModelComponent, 'src')(src)
            else ResourceLoaderManager.updateResource(src)
          }}
        />
        {errors?.LOADING_ERROR ||
          (errors?.INVALID_SOURCE && ErrorPopUp({ message: t('editor:properties.model.error-url') }))}
      </InputGroup>
      {dereferenceFeatureFlag && (
        <Button
          className="self-end"
          onClick={() => modelComponent.dereference.set(true)}
          disabled={!modelComponent.src.value}
        >
          Dereference
        </Button>
      )}
      <InputGroup name="Camera Occlusion" label={t('editor:properties.model.lbl-cameraOcclusion')}>
        <BooleanInput
          value={modelComponent.cameraOcclusion.value}
          onChange={commitProperty(ModelComponent, 'cameraOcclusion')}
        />
      </InputGroup>
      {bonematchable.value && (
        <InputGroup name="Force VRM" label={t('editor:properties.model.lbl-convertToVRM')}>
          <BooleanInput
            value={modelComponent.convertToVRM.value}
            onChange={commitProperty(ModelComponent, 'convertToVRM')}
          />
        </InputGroup>
      )}
      {!exporting.value && (
        <div className="m-2 flex flex-col rounded-md p-1">
          <div className="property-group-header">{t('editor:properties.model.lbl-export')}</div>
          <InputGroup name="Export Project" label="Project">
            <SelectInput
              value={srcProject.value}
              options={
                loadedProjects.value.map((project) => ({
                  label: project,
                  value: project
                })) ?? []
              }
              onChange={(val) => srcProject.set(val as string)}
            />
          </InputGroup>
          <InputGroup name="File Path" label="File Path">
            <StringInput value={srcPath.value} onChange={srcPath.set} />
          </InputGroup>
          <InputGroup name="Export Type" label={t('editor:properties.model.lbl-exportType')}>
            <SelectInput
              options={[
                {
                  label: 'glB',
                  value: 'glb'
                },
                {
                  label: 'glTF',
                  value: 'gltf'
                }
              ]}
              value={exportType.value}
              onChange={(val) => exportType.set(val as string)}
            />
          </InputGroup>
          <Button className="self-end" onClick={onExportModel}>
            {t('editor:properties.model.saveChanges')}
          </Button>
        </div>
      )}
      {exporting.value && <p>Exporting...</p>}
      <ScreenshareTargetNodeEditor entity={props.entity} multiEdit={props.multiEdit} />
      {gltfTransformFeatureFlag && (
        <ModelTransformProperties entity={entity} onChangeModel={commitProperty(ModelComponent, 'src')} />
      )}
    </NodeEditor>
  )
}

ModelNodeEditor.iconComponent = MdOutlineViewInAr

export default ModelNodeEditor
