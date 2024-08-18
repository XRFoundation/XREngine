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

import React, { useEffect } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeList } from 'react-window'

import { API } from '@etherealengine/common'
import { staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { pathJoin } from '@etherealengine/common/src/utils/miscUtils'
import { EntityUUID, getComponent, getOptionalComponent, useQuery, UUIDComponent } from '@etherealengine/ecs'
import { uploadProjectFiles } from '@etherealengine/editor/src/functions/assetFunctions'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { ImportSettingsState } from '@etherealengine/editor/src/services/ImportSettingsState'
import { SelectionState } from '@etherealengine/editor/src/services/SelectionServices'
import exportMaterialsGLTF from '@etherealengine/engine/src/assets/functions/exportMaterialsGLTF'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { getMaterialsFromScene } from '@etherealengine/engine/src/scene/materials/functions/materialSourcingFunctions'
import { MaterialSelectionState } from '@etherealengine/engine/src/scene/materials/MaterialLibraryState'
import { getMutableState, getState, useHookstate, useMutableState, useState } from '@etherealengine/hyperflux'
import { MaterialStateComponent } from '@etherealengine/spatial/src/renderer/materials/MaterialComponent'
import { useTranslation } from 'react-i18next'
import { HiFilter, HiGlobeAlt } from 'react-icons/hi'
import Button from '../../../../../primitives/tailwind/Button'
import InputGroup from '../../../input/Group'
import StringInput from '../../../input/String'
import { MaterialPreviewPanel } from '../../preview/material'
import MaterialLibraryEntry from '../node'

export default function MaterialLibraryPanel() {
  const { t } = useTranslation()
  const srcPath = useState('/mat/material-test')
  const materialPreviewPanelRef = React.useRef()

  const materialQuery = useQuery([MaterialStateComponent])
  const nodes = useHookstate([] as string[])
  const selected = useHookstate(getMutableState(SelectionState).selectedEntities)
  const selectedMaterial = useMutableState(MaterialSelectionState).selectedMaterial
  const hasSelectedMaterial = useState(false)
  const useSelected = useState(false)

  useEffect(() => {
    const materials =
      selected.value.length && useSelected.value
        ? getMaterialsFromScene(UUIDComponent.getEntityByUUID(selected.value[0]))
        : materialQuery
            .map((entity) => getComponent(entity, UUIDComponent))
            .filter((uuid) => uuid !== MaterialStateComponent.fallbackMaterial)

    const materialsBySource = {} as Record<string, EntityUUID[]>
    for (const uuid of materials) {
      const source = getOptionalComponent(UUIDComponent.getEntityByUUID(uuid as EntityUUID), SourceComponent) ?? ''
      materialsBySource[source] = materialsBySource[source] ? [...materialsBySource[source], uuid] : [uuid]
    }
    const materialsBySourceArray = Object.entries(materialsBySource)
    const flattenedMaterials = materialsBySourceArray.reduce(
      (acc: (EntityUUID | string)[], [source, uuids]) => acc.concat([source], uuids),
      []
    )
    nodes.set(flattenedMaterials)
  }, [materialQuery.length, selected, useSelected])

  useEffect(() => {
    hasSelectedMaterial.set(selectedMaterial.value !== null)
  }, [selectedMaterial.value])

  const onClick = (e: MouseEvent, node) => {
    getMutableState(MaterialSelectionState).selectedMaterial.set(node)
  }

  const MaterialList = ({ height, width }) => (
    <FixedSizeList
      height={height - 32}
      width={width}
      itemSize={32}
      itemCount={nodes.length}
      itemData={{
        nodes: nodes.value,
        onClick
      }}
      itemKey={(index, _) => index}
      innerElementType="ul"
    >
      {MaterialLibraryEntry}
    </FixedSizeList>
  )

  return (
    <div className="h-full overflow-scroll">
      <div className="w-full rounded-[5px] p-3">
        <div className="rounded-lg bg-zinc-800 p-2">
          <MaterialPreviewPanel ref={materialPreviewPanelRef} />
        </div>
        <div className="mt-4 flex h-5 items-center gap-2">
          <InputGroup name="File Path" label="Save to" className="flex-grow">
            <StringInput value={srcPath.value} onChange={srcPath.set} />
          </InputGroup>
          <Button
            className="flex w-5 flex-grow items-center justify-center text-xs"
            variant="outline"
            onClick={async () => {
              const projectName = getState(EditorState).projectName!
              const materialUUID = getState(MaterialSelectionState).selectedMaterial ?? ('' as EntityUUID)
              let libraryName = srcPath.value
              if (!libraryName.endsWith('.material.gltf')) {
                libraryName += '.material.gltf'
              }
              const relativePath = pathJoin('assets', libraryName)
              const gltf = (await exportMaterialsGLTF([UUIDComponent.getEntityByUUID(materialUUID)], {
                binary: false,
                relativePath
              })!) as { [key: string]: any }
              const blob = [JSON.stringify(gltf)]
              const file = new File(blob, libraryName)
              const importSettings = getState(ImportSettingsState)
              const urls = await Promise.all(
                uploadProjectFiles(projectName, [file], [`projects/${projectName}${importSettings.importFolder}`])
                  .promises
              )
              const adjustedLibraryName = libraryName.length > 0 ? libraryName.substring(1) : ''
              const key = `projects/${projectName}${importSettings.importFolder}${adjustedLibraryName}`
              const resources = await API.instance.service(staticResourcePath).find({
                query: { key: key }
              })
              if (resources.data.length === 0) {
                throw new Error('User not found')
              }
              const resource = resources.data[0]
              const tags = ['Material']
              await API.instance.service(staticResourcePath).patch(resource.id, { tags: tags, project: projectName })
              console.log('exported material data to ', ...urls)
            }}
          >
            Save
          </Button>
          <div className="mx-2 h-full border-l"></div>
          <Button
            className="flex w-10 flex-grow items-center justify-center text-xs"
            variant="outline"
            onClick={() => {
              useSelected.set(!useSelected.value)
            }}
          >
            {useSelected.value ? <HiFilter /> : <HiGlobeAlt />}
          </Button>
        </div>
      </div>
      <div id="material-panel" className="h-full overflow-hidden">
        <AutoSizer onResize={MaterialList}>{MaterialList}</AutoSizer>
      </div>
    </div>
  )
}
