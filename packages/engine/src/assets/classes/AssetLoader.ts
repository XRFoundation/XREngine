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

import { AudioLoader } from 'three'

import { getState } from '@etherealengine/hyperflux'
import { isAbsolutePath } from '@etherealengine/spatial/src/common/functions/isAbsolutePath'

import { AssetExt, AssetType, FileToAssetExt, FileToAssetType } from '@etherealengine/common/src/constants/AssetType'
import { Engine } from '@etherealengine/ecs'
import loadVideoTexture from '../../scene/materials/functions/LoadVideoTexture'
import { FileLoader } from '../loaders/base/FileLoader'
import { DDSLoader } from '../loaders/dds/DDSLoader'
import { FBXLoader } from '../loaders/fbx/FBXLoader'
import { TextureLoader } from '../loaders/texture/TextureLoader'
import { TGALoader } from '../loaders/tga/TGALoader'
import { USDZLoader } from '../loaders/usdz/USDZLoader'
import { AssetLoaderState } from '../state/AssetLoaderState'

/**
 * Get asset type from the asset file extension.
 * @param assetFileName Name of the Asset file.
 * @returns Asset type of the file.
 */
const getAssetType = (assetFileName: string): AssetExt => {
  return FileToAssetExt(assetFileName)!
}

/**
 * Get asset class from the asset file extension.
 * @param assetFileName Name of the Asset file.
 * @returns Asset class of the file.
 */
const getAssetClass = (assetFileName: string): AssetType => {
  return FileToAssetType(assetFileName)
}

export const getLoader = (assetType: AssetExt) => {
  switch (assetType) {
    case AssetExt.KTX2:
      return getState(AssetLoaderState).gltfLoader.ktx2Loader!
    case AssetExt.DDS:
      return new DDSLoader()
    case AssetExt.GLTF:
    case AssetExt.GLB:
    case AssetExt.VRM:
      return getState(AssetLoaderState).gltfLoader
    case AssetExt.USDZ:
      return new USDZLoader()
    case AssetExt.FBX:
      return new FBXLoader()
    case AssetExt.TGA:
      return new TGALoader()
    case AssetExt.PNG:
    case AssetExt.JPEG:
      return new TextureLoader()
    case AssetExt.AAC:
    case AssetExt.MP3:
    case AssetExt.OGG:
    case AssetExt.M4A:
      return new AudioLoader()
    case AssetExt.MP4:
    case AssetExt.MKV:
    case AssetExt.M3U8:
      return { load: loadVideoTexture }
    default:
      return new FileLoader()
  }
}

const getAbsolutePath = (url) => (isAbsolutePath(url) ? url : Engine.instance.store.publicPath + url)

const loadAsset = async <T>(
  url: string,
  onLoad: (response: T) => void = () => {},
  onProgress: (request: ProgressEvent) => void = () => {},
  onError: (event: ErrorEvent | Error) => void = () => {},
  signal?: AbortSignal,
  loader?: ReturnType<typeof getLoader>
) => {
  if (!url) {
    onError(new Error('URL is empty'))
    return
  }
  url = getAbsolutePath(url)

  if (!loader) {
    const assetExt = getAssetType(url)
    loader = getLoader(assetExt)
  }

  try {
    return loader.load(url, onLoad, onProgress, onError, signal)
  } catch (error) {
    onError(error)
  }
}

export const AssetLoader = {
  getAbsolutePath,
  getAssetType,
  getAssetClass,
  /** @deprecated Use resourceLoaderHooks instead */
  loadAsset
}
