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
import { useTranslation } from 'react-i18next'

import InputSelect, { InputMenuItem } from '@etherealengine/client-core/src/common/components/InputSelect'
import InputSwitch from '@etherealengine/client-core/src/common/components/InputSwitch'
import InputText from '@etherealengine/client-core/src/common/components/InputText'
import {
  assetPath,
  LocationData,
  LocationID,
  locationPath,
  LocationType
} from '@etherealengine/common/src/schema.type.module'
import { AssetType } from '@etherealengine/common/src/schemas/assets/asset.schema'
import { getMutableState, getState, NO_PROXY, useHookstate } from '@etherealengine/hyperflux'
import { useFind, useGet, useMutation } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import Button from '@etherealengine/ui/src/primitives/mui/Button'
import Container from '@etherealengine/ui/src/primitives/mui/Container'
import DialogActions from '@etherealengine/ui/src/primitives/mui/DialogActions'
import DialogTitle from '@etherealengine/ui/src/primitives/mui/DialogTitle'
import Grid from '@etherealengine/ui/src/primitives/mui/Grid'

import { EntityUUID } from '@etherealengine/ecs'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { saveSceneGLTF, setCurrentEditorScene } from '../../../../../editor/src/functions/sceneFunctions'
import { NotificationService } from '../../../common/services/NotificationService'
import { AuthState } from '../../../user/services/AuthService'
import styles from '../../old-styles/admin.module.scss'
import DrawerView from '../DrawerView'
import { validateForm } from '../validation/formValidation'
import ConfirmSubmitDialog from './ConfirmSubmitDialog'

export enum LocationDrawerMode {
  Create,
  ViewEdit
}

interface Props {
  open: boolean
  mode: LocationDrawerMode
  selectedLocation?: LocationType
  onClose: () => void
  selectedScene?: string | null
}

const defaultState = {
  name: '',
  maxUsers: 20,
  scene: '',
  type: 'public',
  videoEnabled: true,
  audioEnabled: true,
  screenSharingEnabled: true,
  // faceStreamingEnabled: false,
  // isLobby: false,
  // isFeatured: false,
  formErrors: {
    name: '',
    maxUsers: '',
    scene: '',
    type: ''
  }
}

const LocationDrawer = ({ open, mode, selectedLocation, selectedScene, onClose }: Props) => {
  const { t } = useTranslation()
  const editMode = useHookstate(false)
  const state = useHookstate({ ...defaultState })
  const confirmWindowOpen = useHookstate(false)

  const scenes = useFind(assetPath)
  // const locationTypes = useFind(locationTypePath).data
  const user = useHookstate(getMutableState(AuthState).user)

  const locationMutation = useMutation(locationPath)

  const hasWriteAccess = user.scopes.get(NO_PROXY)?.find((item) => item?.type === 'location:write')
  const viewMode = mode === LocationDrawerMode.ViewEdit && !editMode.value

  const selectedSceneData = useGet(assetPath, selectedScene!)

  useEffect(() => {
    if (selectedScene) state.scene.set(selectedScene)
  }, [selectedScene])

  const sceneMenu: InputMenuItem[] = selectedSceneData.data
    ? [
        {
          value: selectedSceneData.data.id,
          label: selectedSceneData.data.assetURL
        }
      ]
    : scenes.data.map((el: AssetType) => {
        return {
          value: el.id,
          label: el.assetURL
        }
      })

  // const locationTypesMenu: InputMenuItem[] = locationTypes.map((el) => {
  //   return {
  //     value: el.type,
  //     label: el.type
  //   }
  // })

  useEffect(() => {
    loadSelectedLocation()
  }, [selectedLocation])

  const loadSelectedLocation = () => {
    if (selectedLocation) {
      state.set({
        ...defaultState,
        name: selectedLocation.name,
        maxUsers: selectedLocation.maxUsersPerInstance,
        scene: selectedLocation.sceneId,
        type: selectedLocation.locationSetting?.locationType,
        videoEnabled: selectedLocation.locationSetting?.videoEnabled,
        audioEnabled: selectedLocation.locationSetting?.audioEnabled,
        screenSharingEnabled: selectedLocation.locationSetting?.screenSharingEnabled
        // faceStreamingEnabled: selectedLocation.locationSetting?.faceStreamingEnabled,
        // isLobby: selectedLocation.isLobby,
        // isFeatured: selectedLocation.isFeatured
      })
    }
  }

  const handleCancel = () => {
    if (editMode.value) {
      loadSelectedLocation()
      editMode.set(false)
    } else handleClose()
  }

  const handleConfirmWindowOpen = () => {
    confirmWindowOpen.set(true)
  }

  const handleConfirmCancel = () => {
    confirmWindowOpen.set(false)
  }

  const handleClose = () => {
    onClose()
    state.set({ ...defaultState })
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    switch (name) {
      case 'name':
        state.formErrors.merge({ name: value.length < 2 ? t('admin:components.location.nameRequired') : '' })
        break
      case 'maxUsers':
        state.formErrors.merge({ maxUsers: value.length < 1 ? t('admin:components.location.maxUsersRequired') : '' })
        break
      case 'scene':
        state.formErrors.merge({ scene: value.length < 2 ? t('admin:components.location.sceneRequired') : '' })
        break
      case 'type':
        state.formErrors.merge({ type: value.length < 2 ? t('admin:components.location.typeRequired') : '' })
        break
      default:
        break
    }

    state.merge({ [name]: value })
  }

  const handleSubmit = async () => {
    confirmWindowOpen.set(false)

    state.formErrors.merge({
      name: state.name.value ? '' : t('admin:components.location.nameCantEmpty'),
      maxUsers: state.maxUsers.value ? '' : t('admin:components.location.maxUserCantEmpty'),
      scene: state.scene.value ? '' : t('admin:components.location.sceneCantEmpty'),
      type: state.type.value ? '' : t('admin:components.location.typeCantEmpty')
    })

    if (!validateForm(state.value, state.formErrors.value)) {
      NotificationService.dispatchNotify(t('admin:components.common.fillRequiredFields'), { variant: 'error' })
      return
    }

    // TODO: new checkbox
    const isBaked = true

    // TODO: Present blocking modal to user "Are you sure you want to Publish?"

    await publishScene(isBaked)

    // TODO: After publish succeeds or fails, restore original scene and close blocking modal

    handleClose()
  }

  const publishScene = async (bake: boolean) => {
    // TODO: Save current scene in place, and create new version to publish
    const { sceneAssetID, projectName, sceneName, scenePath } = getState(EditorState)

    if (projectName && sceneName && scenePath) {
      const sceneQuery = useFind(assetPath, { query: { assetURL: scenePath ?? '' } }).data
      const sceneURL = sceneQuery?.[0]?.assetURL
      const abortController = new AbortController()

      // TODO: Bake implementation
      if (bake) {
        await saveSceneGLTF(sceneAssetID, projectName, sceneName + '-optimized', abortController.signal)
      }

      setCurrentEditorScene(sceneURL, sceneQuery[0].id! as EntityUUID)
    }

    // TODO: In duplicated scene, perform mesh baking to de-reference all models in the scene (saving scene as GLTF & fuse/compress scenes)
    // TODO: Publish the duplicated scene

    const locationData: LocationData = {
      name: state.name.value,
      slugifiedName: '',
      sceneId: state.scene.value,
      maxUsersPerInstance: state.maxUsers.value,
      locationSetting: {
        id: '',
        locationId: '' as LocationID,
        locationType: state.type.value as 'private' | 'public' | 'showroom',
        audioEnabled: state.audioEnabled.value,
        screenSharingEnabled: state.screenSharingEnabled.value,
        faceStreamingEnabled: false, //state.faceStreamingEnabled.value,
        videoEnabled: state.videoEnabled.value,
        createdAt: '',
        updatedAt: ''
      },
      isLobby: false, //state.isLobby.value,
      isFeatured: false //state.isFeatured.value
    }

    const onError = (error) => NotificationService.dispatchNotify(error.message, { variant: 'error' })

    if (mode === LocationDrawerMode.Create) {
      await locationMutation.create(locationData).catch(onError)
    } else if (selectedLocation) {
      await locationMutation.patch(selectedLocation.id, locationData).catch(onError)
      editMode.set(false)
    }
  }

  return (
    <DrawerView open={open} onClose={onClose}>
      <Container maxWidth="sm" className={styles.mt20}>
        <DialogTitle className={styles.textAlign}>
          {mode === LocationDrawerMode.Create && t('admin:components.location.createLocation')}
          {mode === LocationDrawerMode.ViewEdit &&
            editMode.value &&
            `${t('admin:components.common.update')} ${selectedLocation?.name}`}
          {mode === LocationDrawerMode.ViewEdit && !editMode.value && selectedLocation?.name}
        </DialogTitle>

        <InputText
          name="name"
          label={t('admin:components.location.lbl-name')}
          value={state?.value?.name || ''}
          error={state?.value?.formErrors?.name}
          disabled={viewMode}
          onChange={handleChange}
        />

        <InputText
          name="maxUsers"
          label={t('admin:components.location.lbl-maxuser')}
          value={state?.value?.maxUsers}
          error={state?.value?.formErrors?.maxUsers}
          type="number"
          disabled={viewMode}
          onChange={handleChange}
        />

        <InputSelect
          name="scene"
          label={t('admin:components.location.lbl-scene')}
          value={state?.value?.scene}
          error={state?.value?.formErrors?.scene}
          menu={sceneMenu}
          disabled={viewMode || selectedScene !== undefined}
          onChange={handleChange}
        />

        {/* <InputSelect
          name="type"
          label={t('admin:components.location.type')}
          value={state?.value?.type}
          menu={locationTypesMenu}
          disabled={viewMode}
          onChange={handleChange}
        /> */}

        <Grid container spacing={5} className={styles.mb15px}>
          <Grid item xs={6}>
            <InputSwitch
              name="videoEnabled"
              label={t('admin:components.location.lbl-ve')}
              checked={state?.value?.videoEnabled}
              disabled={viewMode}
              onChange={(e) => state.merge({ videoEnabled: e.target.checked })}
            />

            <InputSwitch
              name="audioEnabled"
              label={t('admin:components.location.lbl-ae')}
              checked={state?.value?.audioEnabled}
              disabled={viewMode}
              onChange={(e) => state.merge({ audioEnabled: e.target.checked })}
            />

            <InputSwitch
              name="screenSharingEnabled"
              label={t('admin:components.location.lbl-se')}
              checked={state?.value?.screenSharingEnabled}
              disabled={viewMode}
              onChange={(e) => state.merge({ screenSharingEnabled: e.target.checked })}
            />
          </Grid>
        </Grid>
        <DialogActions>
          <Button className={styles.outlinedButton} onClick={handleCancel}>
            {t('admin:components.common.cancel')}
          </Button>
          {(mode === LocationDrawerMode.Create || editMode.value) && (
            <Button className={styles.gradientButton} onClick={handleConfirmWindowOpen}>
              {t('admin:components.common.submit')}
            </Button>
          )}
          {mode === LocationDrawerMode.ViewEdit && !editMode.value && (
            <Button className={styles.gradientButton} disabled={!hasWriteAccess} onClick={() => editMode.set(true)}>
              {t('admin:components.common.edit')}
            </Button>
          )}
        </DialogActions>
      </Container>

      <ConfirmSubmitDialog
        open={confirmWindowOpen.value}
        onConfirm={handleSubmit}
        handleCancel={handleConfirmCancel}
        onClose={handleConfirmCancel}
      />
    </DrawerView>
  )
}

export default LocationDrawer
