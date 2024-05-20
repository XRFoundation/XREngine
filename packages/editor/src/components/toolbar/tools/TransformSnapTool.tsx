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

import AttractionsIcon from '@mui/icons-material/Attractions'
import BusinessIcon from '@mui/icons-material/Business'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { SnapMode } from '@etherealengine/engine/src/scene/constants/transformConstants'
import { getMutableState, useMutableState } from '@etherealengine/hyperflux'

import { toggleSnapMode } from '../../../functions/transformFunctions'
import { EditorHelperState } from '../../../services/EditorHelperState'
import { ObjectGridSnapState } from '../../../systems/ObjectGridSnapSystem'
import SelectInput from '../../inputs/SelectInput'
import { InfoTooltip } from '../../layout/Tooltip'
import * as styles from '../styles.module.scss'

const translationSnapOptions = [
  { label: '0.1m', value: 0.1 },
  { label: '0.125m', value: 0.125 },
  { label: '0.25m', value: 0.25 },
  { label: '0.5m', value: 0.5 },
  { label: '1m', value: 1 },
  { label: '2m', value: 2 },
  { label: '4m', value: 4 }
]

const rotationSnapOptions = [
  { label: '1°', value: 1 },
  { label: '5°', value: 5 },
  { label: '10°', value: 10 },
  { label: '15°', value: 15 },
  { label: '30°', value: 30 },
  { label: '45°', value: 45 },
  { label: '90°', value: 90 }
]

const TransformSnapTool = () => {
  const { t } = useTranslation()

  const editorHelperState = useMutableState(EditorHelperState)
  const objectSnapState = useMutableState(ObjectGridSnapState)
  const onChangeTranslationSnap = (snapValue: number) => {
    getMutableState(EditorHelperState).translationSnap.set(snapValue)
    if (editorHelperState.gridSnap.value !== SnapMode.Grid) {
      getMutableState(EditorHelperState).gridSnap.set(SnapMode.Grid)
    }
  }

  const onChangeRotationSnap = (snapValue: number) => {
    getMutableState(EditorHelperState).rotationSnap.set(snapValue)
    if (editorHelperState.gridSnap.value !== SnapMode.Grid) {
      getMutableState(EditorHelperState).gridSnap.set(SnapMode.Grid)
    }
  }

  const toggleAttachmentPointSnap = () => {
    objectSnapState.enabled.set(!objectSnapState.enabled.value)
  }

  // const onChangeScaleSnap = (snapValue: number) => {
  //   getMutableState(EditorHelperState).scaleSnap.set(snapValue)
  //   if (editorHelperState.snapMode.value !== SnapMode.Grid) {
  //     getMutableState(EditorHelperState).snapMode.set(SnapMode.Grid)
  //   }
  // }

  return (
    <div className={styles.toolbarInputGroup} id="transform-snap">
      <InfoTooltip title={t('editor:toolbar.transformSnapTool.toggleSnapMode')}>
        <button
          onClick={toggleAttachmentPointSnap}
          className={styles.toolButton + ' ' + (objectSnapState.enabled.value ? styles.selected : '')}
        >
          <BusinessIcon fontSize="small" />
        </button>
      </InfoTooltip>
      <InfoTooltip title={t('editor:toolbar.transformSnapTool.toggleSnapMode')}>
        <button
          onClick={toggleSnapMode}
          className={
            styles.toolButton + ' ' + (editorHelperState.gridSnap.value === SnapMode.Grid ? styles.selected : '')
          }
        >
          <AttractionsIcon fontSize="small" />
        </button>
      </InfoTooltip>
      <InfoTooltip title={t('editor:toolbar.transformSnapTool.info-translate')} placement="right">
        <div>
          <SelectInput
            key={editorHelperState.translationSnap.value}
            className={styles.selectInput}
            onChange={onChangeTranslationSnap}
            options={translationSnapOptions}
            value={editorHelperState.translationSnap.value}
            creatable={false}
            isSearchable={false}
          />
        </div>
      </InfoTooltip>
      <InfoTooltip title={t('editor:toolbar.transformSnapTool.info-rotate')} placement="right">
        <div>
          <SelectInput
            key={editorHelperState.rotationSnap.value}
            className={styles.selectInput}
            onChange={onChangeRotationSnap}
            options={rotationSnapOptions}
            value={editorHelperState.rotationSnap.value}
            creatable={false}
            isSearchable={false}
          />
        </div>
      </InfoTooltip>
    </div>
  )
}

export default TransformSnapTool
