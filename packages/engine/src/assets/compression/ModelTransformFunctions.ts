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

import {
  BufferUtils,
  Document,
  Format,
  Buffer as glBuffer,
  Material,
  Mesh,
  Node,
  Primitive,
  Texture,
  Transform
} from '@gltf-transform/core'
import { EXTMeshGPUInstancing, EXTMeshoptCompression, KHRTextureBasisu } from '@gltf-transform/extensions'
import {
  dedup,
  draco,
  flatten,
  join,
  palette,
  partition,
  prune,
  reorder,
  simplify,
  textureResize,
  TextureResizeOptions,
  weld
} from '@gltf-transform/functions'
import { createHash } from 'crypto'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { getPixels } from 'ndarray-pixels'
import { LoaderUtils } from 'three'
import { v4 as uuidv4 } from 'uuid'

import { API } from '@etherealengine/common'
import config from '@etherealengine/common/src/config'
import { fileBrowserPath } from '@etherealengine/common/src/schema.type.module'
import { baseName, pathJoin } from '@etherealengine/common/src/utils/miscUtils'
import {
  ExtractedImageTransformParameters,
  extractParameters,
  ModelTransformParameters
} from '@etherealengine/engine/src/assets/classes/ModelTransform'
import { getMutableState, NO_PROXY } from '@etherealengine/hyperflux'
import { KTX2Encoder } from '@etherealengine/xrui/core/textures/KTX2Encoder'

import { UploadRequestState } from '../state/UploadRequestState'
import { EEMaterial, EEMaterialExtension } from './extensions/EE_MaterialTransformer'
import { EEResourceID, EEResourceIDExtension } from './extensions/EE_ResourceIDTransformer'
import ModelTransformLoader from './ModelTransformLoader'

/**
 *
 * @param doc
 * @param batchExtension
 * @param mesh
 * @param count
 * @returns
 */
const createBatch = (doc: Document, batchExtension: EXTMeshGPUInstancing, mesh: Mesh, count) => {
  return mesh.listPrimitives().map((prim) => {
    const buffer = prim.getAttribute('POSITION')?.getBuffer() ?? doc.createBuffer()

    const batchTranslation = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array(3 * count))
      .setBuffer(buffer)
    const batchRotation = doc
      .createAccessor()
      .setType('VEC4')
      .setArray(new Float32Array(4 * count))
      .setBuffer(buffer)
    const batchScale = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array(3 * count))
      .setBuffer(buffer)

    return batchExtension
      .createInstancedMesh()
      .setAttribute('TRANSLATION', batchTranslation)
      .setAttribute('ROTATION', batchRotation)
      .setAttribute('SCALE', batchScale)
  })
}

function pruneUnusedNodes(nodes: Node[], logger) {
  let node: Node | undefined
  let unusedNodes = 0
  while ((node = nodes.pop())) {
    if (
      node.listChildren().length ||
      node.getCamera() ||
      node.getMesh() ||
      node.getSkin() ||
      node.listExtensions().length
    ) {
      continue
    }
    const nodeParent = node.getParentNode() as Node
    if (nodeParent instanceof Node) {
      nodes.push(nodeParent)
    }
    node.dispose()
    unusedNodes++
    console.log(`Pruned ${unusedNodes} nodes.`)
  }
}

function removeUVsOnUntexturedMeshes(document: Document) {
  document
    .getRoot()
    .listMeshes()
    .map((mesh) => {
      const prims = mesh.listPrimitives()
      if (prims.length === 1) {
        const prim = prims[0]
        const material = prim.getMaterial()
        if (
          material &&
          (material.getBaseColorTexture() ||
            material.getNormalTexture() ||
            material.getEmissiveTexture() ||
            material.getOcclusionTexture() ||
            material.getMetallicRoughnessTexture())
        ) {
          return
        }
        prim.setAttribute('TEXCOORD_0', null)
        prim.setAttribute('TEXCOORD_1', null)
      }
    })
}

const split = async (document: Document) => {
  const root = document.getRoot()
  const scene = root.listScenes()[0]
  const toSplit = root.listNodes().filter((node) => {
    const mesh = node.getMesh()
    const prims = mesh?.listPrimitives()
    return mesh && prims && prims.length > 1
  })
  const primMeshes = new Map()
  toSplit.map((node) => {
    const mesh = node.getMesh()!
    const nuNodes: Node[] = []
    mesh.listPrimitives().map((prim, primIdx) => {
      if (!primMeshes.has(prim)) {
        primMeshes.set(prim, document.createMesh(mesh.getName() + '-' + primIdx).addPrimitive(prim))
      } else {
        console.log('found cached prim')
      }
      const nuNode = document.createNode(node.getName() + '-' + primIdx).setMesh(primMeshes.get(prim))
      node.getSkin() && nuNode.setSkin(node.getSkin())
      ;(node.getParentNode() ?? scene).addChild(nuNode)
      nuNode.setMatrix(node.getMatrix())
      nuNodes.push(nuNode)
    })
    node.listChildren().map((child) => {
      nuNodes[0]?.addChild(child)
    })
    node.detach()
  })
  toSplit.map((node) => {
    const mesh = node.getMesh()!
    mesh.listPrimitives().map((prim, primIdx) => {
      if (primIdx > 0) {
        mesh.removePrimitive(prim)
      }
    })
    node.setMesh(null)
  })
}

const myInstance = async (document: Document) => {
  const root = document.getRoot()
  const scene = root.listScenes()[0]
  const batchExtension = document.createExtension(EXTMeshGPUInstancing)
  const meshes = root.listMeshes()
  console.log('meshes:', meshes)
  const nodes = root.listNodes().filter((node) => node.getMesh())
  const table = nodes.reduce(
    (_table, node) => {
      const mesh = node.getMesh()
      const idx = meshes.findIndex((mesh2) => mesh?.equals(mesh2))
      _table[idx] = _table[idx] ?? []
      _table[idx].push(node)
      return _table
    },
    {} as Record<number, any[]>
  )
  console.log('table:', table)
  const modifiedNodes = new Set<Node>()
  Object.entries(table)
    .filter(([_, _nodes]) => _nodes.length > 1)
    .map(([meshIdx, _nodes]) => {
      const mesh = meshes[meshIdx]
      console.log('mesh:', mesh, 'nodes:', nodes)
      const batches = createBatch(document, batchExtension, mesh, _nodes.length)
      batches.map((batch) => {
        const batchTranslate = batch.getAttribute('TRANSLATION')!
        const batchRotate = batch.getAttribute('ROTATION')!
        const batchScale = batch.getAttribute('SCALE')!
        const batchNode = document.createNode().setMesh(mesh).setExtension('EXT_mesh_gpu_instancing', batch)
        scene.addChild(batchNode)
        _nodes.map((node, i) => {
          batchTranslate.setElement(i, node.getWorldTranslation())
          batchRotate.setElement(i, node.getWorldRotation())
          batchScale.setElement(i, node.getWorldScale())
          node.setMesh(null)
          modifiedNodes.add(node)
        })
      })
      console.log('modified nodes: ', modifiedNodes)
      pruneUnusedNodes([...modifiedNodes], document.getLogger())
    })
}

function unInstanceSingletons(document: Document) {
  const root = document.getRoot()
  root
    .listNodes()
    .filter((node) => (node.getExtension('EXT_mesh_gpu_instancing') as any)?.listAttributes()?.[0].getCount() === 1)
    .map((node) => {
      console.log('removed instanced singleton', node.getName())
      node.setExtension('EXT_mesh_gpu_instancing', null) //delete instancing
    })
}

export type ModelTransformArguments = {
  src: string
  dst: string
  resourceUri: string
  parms: ModelTransformParameters
}

export async function combineMaterials(document: Document) {
  const root = document.getRoot()
  const cache: Material[] = []
  console.log('combining materials...')
  root.listMaterials().map((material) => {
    const eeMat = material.getExtension<EEMaterial>('EE_material')
    const dupe = cache.find((cachedMaterial) => {
      const cachedEEMat = cachedMaterial.getExtension<EEMaterial>('EE_material')
      if (eeMat !== null && cachedEEMat !== null) {
        return (
          eeMat.prototype === cachedEEMat.prototype &&
          ((eeMat.args === cachedEEMat.args && eeMat.args === null) ||
            (cachedEEMat.args && eeMat.args?.equals(cachedEEMat.args)))
        )
      } else return material.equals(cachedMaterial)
    })
    if (dupe !== undefined) {
      console.log('found duplicate material...')
      let dupeCount = 0
      root
        .listMeshes()
        .flatMap((mesh) => mesh.listPrimitives())
        .map((prim) => {
          if (prim.getMaterial() === material) {
            prim.setMaterial(dupe)
            dupeCount++
          }
        })
      console.log('replaced ' + dupeCount + ' materials')
    } else {
      cache.push(material)
    }
  })
}

export async function combineMeshes(document: Document) {
  const root = document.getRoot()
  const prims = root.listMeshes().flatMap((mesh) => mesh.listPrimitives())
  const matMap = new Map<Material, Primitive[]>()
  for (const prim of prims) {
    const material = prim.getMaterial()
    if (material) {
      if (!matMap.has(material)) {
        matMap.set(material, [])
      }
      const matPrims = matMap.get(material)
      matPrims?.push(prim)
    }
  }
  const nuPrims = [...matMap.entries()].map(([material, prims]) => {
    const nuPrim = document.createPrimitive()
    nuPrim.setMaterial(material)
    prims.map((prim) => {
      prim.listSemantics().map((key) => {
        const accessor = prim.getAttribute(key)!
        let nuAttrib = nuPrim.getAttribute(key)
        if (!nuAttrib) {
          nuPrim.setAttribute(key, accessor)
          nuAttrib = accessor
        } else {
          nuAttrib.setArray(
            BufferUtils.concat([Uint8Array.from(nuAttrib.getArray()!), Uint8Array.from(accessor.getArray()!)])
          )
        }
      })
    })
    return nuPrim
  })
  root.listNodes().map((node) => {
    if (node.getMesh()) {
      node.setMesh(null)
    }
  })
  nuPrims.map((nuPrim) => {
    root.listScenes()[0].addChild(document.createNode().setMesh(document.createMesh().addPrimitive(nuPrim)))
  })
}

function hashBuffer(buffer: Uint8Array): string {
  const hash = createHash('sha256')
  hash.update(buffer)
  return hash.digest('hex')
}

export async function transformModel(
  args: ModelTransformParameters,
  onMetadata: (key: string, data: any) => void = (key, data) => {}
): Promise<string> {
  const parms = args

  /**
   *
   * @param {string} mimeType
   * @returns
   */
  const mimeToFileType = (mimeType) => {
    switch (mimeType) {
      case 'image/jpg':
      case 'image/jpeg':
        return 'jpg'
      case 'image/png':
        return 'png'
      case 'image/ktx2':
        return 'ktx2'
      default:
        return null
    }
  }

  const fileTypeToMime = (fileType) => {
    switch (fileType) {
      case 'jpg':
        return 'image/jpg'
      case 'png':
        return 'image/png'
      case 'ktx2':
        return 'image/ktx2'
      default:
        return null
    }
  }

  const resourceName = baseName(args.src).slice(0, baseName(args.src).lastIndexOf('.'))
  const resourcePath = pathJoin(LoaderUtils.extractUrlBase(args.src), args.resourceUri || resourceName + '_resources')

  const toValidFilename = (name: string) => {
    const result = name.replace(/[\s]/g, '-')
    return result
  }
  let pathIndex = 0
  const toPath = (element: Texture | glBuffer, index?: number) => {
    if (element instanceof Texture) {
      if (element.getURI()) {
        return baseName(element.getURI())
      } else {
        pathIndex++
        return `${toValidFilename(element.getName())}-${pathIndex}-.${mimeToFileType(element.getMimeType())}`
      }
    } else if (element instanceof glBuffer) {
      return `buffer-${index}-${Date.now()}.bin`
    } else throw new Error('invalid element to find path')
  }

  const fileUploadPath = (fUploadPath: string) => {
    const relativePath = fUploadPath.replace(config.client.fileServer, '')
    const pathCheck = /projects\/([^/]+)\/assets\/([\w\d\s\-|_./]*)$/
    const [_, projectName, fileName] =
      pathCheck.exec(fUploadPath) ?? pathCheck.exec(pathJoin(LoaderUtils.extractUrlBase(args.src), fUploadPath))!
    return [projectName, fileName]
  }

  const doUpload = async (buffer, uri) => {
    const [projectName, fileName] = fileUploadPath(uri)
    const file = new File([buffer], fileName)
    const uploadRequestState = getMutableState(UploadRequestState)
    const queue = uploadRequestState.queue.get(NO_PROXY)
    let resolver
    const promise = new Promise((resolve) => {
      resolver = resolve
    })
    uploadRequestState.queue.set([...queue, { file, projectName, callback: resolver }])
    await promise
  }

  const { io } = await ModelTransformLoader()

  let initialSrc = args.src
  /* Meshopt Compression */
  /*
  if (args.meshoptCompression.enabled) {
    const segments = args.src.split('.')
    const ext = segments.pop()
    const base = segments.join('.')
    initialSrc = `${base}-meshopt.${ext}`
    let packArgs = `-i ${args.src} -o ${initialSrc} -noq `
    if (!args.meshoptCompression.options.mergeMaterials) {
      packArgs += `-km `
    }
    if (!args.meshoptCompression.options.mergeNodes) {
      packArgs += `-kn `
    }
    if (args.meshoptCompression.options.compression) {
      packArgs += `-cc `
    }
    execFileSync(
      GLTF_PACK,
      packArgs.split(/\s+/).filter((x) => !!x)
    )
  }
  */
  /* /Meshopt Compression */

  const document = await io.read(initialSrc)
  const root = document.getRoot()

  await MeshoptEncoder.ready
  /*
  let primitives = root.listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
  primitives = primitives.filter((primitive, index) => 
    primitives.findIndex((primitive2) => primitive2.equals(primitive)) === index
  )
  for(const primitive of primitives) {
    //STEP 1: Pre-process the mesh to improve index and vertex locality which increases compression ratio
    const indices = new Uint32Array(primitive.getIndices()!.getArray()!)
    const [remap, unique] = MeshoptEncoder.reorderMesh(indices, true, true)
    const attributes = primitive.listAttributes()
    for (const attribute of attributes) {
      const oldAttributeArray = attribute.getArray()!
      const reorderedAttributeArray = new Uint8Array(unique)
      for (let i = 0; i < unique; i++) {
        reorderedAttributeArray[i] = oldAttributeArray[remap[i]]
      }
      attribute.setArray(reorderedAttributeArray)
      //STEP 2: Quantize data, either manually using integer or normalized integer format as a target, or using filter encoders
  
      //STEP 3: Encode data

    }
    
  }
  */

  if (args.meshoptCompression.enabled) {
    const meshoptCompression = document.createExtension(EXTMeshoptCompression).setRequired(true)
    meshoptCompression.setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.FILTER
    })
  }

  /* ID unnamed resources */
  unInstanceSingletons(document)
  args.split && (await split(document))
  args.combineMaterials && (await combineMaterials(document))
  args.instance && (await myInstance(document))
  args.dedup && (await document.transform(dedup()))
  args.flatten && (await document.transform(flatten()))
  args.join.enabled && (await document.transform(join(args.join.options)))
  if (args.palette.enabled) {
    removeUVsOnUntexturedMeshes(document)
    await document.transform(palette(args.palette.options))
  }
  args.prune && (await document.transform(prune()))

  /* Separate Instanced Geometry */
  const instancedNodes = root
    .listNodes()
    .filter((node) => !!node.getMesh()?.getExtension('EXT_mesh_gpu_instancing'))
    .map((node) => [node, node.getParent()])
  instancedNodes.map(([node, parent]) => {
    node instanceof Node && parent?.removeChild(node)
  })

  /* PROCESS MESHES */
  if (args.weld.enabled) {
    await document.transform(weld({ tolerance: args.weld.tolerance }))
  }

  if (args.simplifyRatio < 1) {
    const simplifyTransforms = [] as Transform[]
    //gltfTransform documentation recommends doing a weld before simply
    if (!args.weld.enabled) simplifyTransforms.push(weld({ tolerance: 0.0001 }))
    simplifyTransforms.push(
      simplify({ simplifier: MeshoptSimplifier, ratio: args.simplifyRatio, error: args.simplifyErrorThreshold })
    )
    await document.transform(...simplifyTransforms)
  }

  if (args.reorder) {
    await document.transform(
      reorder({
        encoder: MeshoptEncoder,
        target: 'performance'
      })
    )
  }

  /* Draco Compression */
  if (args.dracoCompression.enabled) {
    await document.transform(draco(args.dracoCompression.options))
  }
  /* /Draco Compression */

  /* /PROCESS MESHES */

  /* Return Instanced Geometry to Scene Graph */
  instancedNodes.map(([node, parent]) => {
    node instanceof Node && parent?.addChild(node)
  })

  const textures = root.listTextures()
  const eeMaterialExtension: EEMaterialExtension | undefined = root
    .listExtensionsUsed()
    .find((ext) => ext.extensionName === 'EE_material') as EEMaterialExtension
  if (eeMaterialExtension) {
    for (let i = 0; i < eeMaterialExtension.textures.length; i++) {
      const texture = eeMaterialExtension.textures[i]
      const extensions = eeMaterialExtension.textureExtensions[i]
      for (const extension of extensions) {
        texture.setExtension(extension.extensionName, extension)
      }
    }

    textures.push(...eeMaterialExtension.textures)
  }

  /* PROCESS TEXTURES */
  if (parms.textureFormat !== 'default') {
    let ktx2Encoder: KTX2Encoder | null = null
    for (const texture of textures) {
      console.log('considering texture ' + texture.getURI())
      if (texture.getMimeType() === 'image/ktx2') continue
      const oldImg = texture.getImage()
      if (!oldImg) continue
      const oldSize = texture.getSize()
      if (!oldSize) continue
      const resourceId = texture.getExtension<EEResourceID>(EEResourceIDExtension.EXTENSION_NAME)?.resourceId
      const resourceParms = parms.resources.images.find(
        (resource) => resource.enabled && resource.resourceId === resourceId
      )
      const mergedParms = {
        ...args,
        ...(resourceParms ? extractParameters(resourceParms) : {})
      } as ExtractedImageTransformParameters

      if (
        mimeToFileType(texture.getMimeType()) === mergedParms.textureFormat &&
        oldSize.reduce((x, y) => Math.max(x, y))! < mergedParms.maxTextureSize
      )
        continue

      if (oldSize.reduce((x, y) => Math.max(x, y))! > mergedParms.maxTextureSize) {
        const imgDoc = new Document()
        const nuTexture = imgDoc.createTexture(texture.getName())
        nuTexture.setExtras(texture.getExtras())
        nuTexture.setImage(oldImg!)
        nuTexture.setMimeType(texture.getMimeType())
        const resizeParms: TextureResizeOptions = {
          size: [mergedParms.maxTextureSize, mergedParms.maxTextureSize]
        }
        await imgDoc.transform(textureResize(resizeParms))
        const originalName = texture.getName()
        const originalURI = texture.getURI()
        const [_, fileName, extension] = /(.*)\.([^.]+)$/.exec(originalURI) ?? []
        const quality = mergedParms.textureCompressionType === 'uastc' ? mergedParms.uastcLevel : mergedParms.compLevel
        const nuURI = `${fileName}-${mergedParms.maxTextureSize}x${quality}.${extension}`
        texture.copy(nuTexture)
        texture.setName(originalName)
        texture.setURI(nuURI)
      }

      if (mergedParms.textureFormat === 'ktx2' && texture.getMimeType() !== 'image/ktx2') {
        if (!ktx2Encoder) {
          ktx2Encoder = new KTX2Encoder()
        }
        const texturePixels = await getPixels(texture.getImage()!, texture.getMimeType())
        const clampedData = new Uint8ClampedArray(texturePixels.data as Uint8Array)
        const imgSize = texture.getSize() ?? texturePixels.shape.slice(0, 2)
        const imgData = new ImageData(clampedData, imgSize[0], imgSize[1])

        const compressedData = await ktx2Encoder.encode(imgData, {
          uastc: mergedParms.textureCompressionType === 'uastc',
          qualityLevel: mergedParms.textureCompressionQuality,
          srgb: !mergedParms.linear,
          mipmaps: mergedParms.mipmap,
          yFlip: mergedParms.flipY
        })

        document.createExtension(KHRTextureBasisu).setRequired(true)

        texture.setImage(new Uint8Array(compressedData))
        texture.setMimeType('image/ktx2')
        texture.setURI(texture.getURI().replace(/\.[^.]+$/, '.ktx2'))
        console.log('compressed image ' + texture.getURI() + ' to ktx2')
      } else {
        console.log('skipping texture ' + texture.getURI())
      }

      /*

      Old command line processing for image resizing

      const fileName = toPath(texture)
      const oldPath = toTmp(fileName)
      const resizeExtension = mergedParms.textureFormat === 'ktx2' ? 'png' : mergedParms.textureFormat
      const resizedPath = oldPath.replace(
        new RegExp(`\\.${mimeToFileType(texture.getMimeType())}$`),
        `-resized.${resizeExtension}`
      )
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir)
      }
      fs.writeFileSync(oldPath, oldImg!)
      const xResizedName = fileName.replace(
        new RegExp(`\\.${mimeToFileType(texture.getMimeType())}$`),
        `-resized.${mergedParms.textureFormat}`
      )
      const nuFileName = fileName.replace(
        new RegExp(`\\.${mimeToFileType(texture.getMimeType())}$`),
        `-transformed.${mergedParms.textureFormat}`
      )
      const nuPath = `${tmpDir}/${nuFileName}`

      try {
        if (path.extname(oldPath) === '.ktx2') {
          console.warn('cannot resize ktx2 compressed image at ' + oldPath)
          continue
        }
        const img = await sharp(oldPath)
        const metadata = await img.metadata()
        let resizedDimension = 2
        while (
          resizedDimension * 2 <=
          Math.min(mergedParms.maxTextureSize, Math.max(metadata.width, metadata.height))
        ) {
          resizedDimension *= 2
        }
        //resize the image to be no larger than the max texture size
        await img
          .resize(resizedDimension, resizedDimension, {
            fit: 'fill'
          })
          .toFormat(resizeExtension)
          .toFile(resizedPath.replace(/\.[\w\d]+$/, `.${resizeExtension}`))
        console.log('handled image file ' + oldPath)
      } catch (e) {
        console.error('error while handling image ' + oldPath)
        console.error(e)
      }*/

      /*
      if (mergedParms.textureFormat === 'ktx2') {
        //KTX2 Basisu Compression
        document.createExtension(KHRTextureBasisu).setRequired(true)

        
        const basisArgs = `-ktx2 ${resizedPath} -q ${mergedParms.textureCompressionQuality} ${
          mergedParms.textureCompressionType === 'uastc' ? '-uastc' : ''
        } ${mergedParms.textureCompressionType === 'uastc' ? '-uastc_level ' + mergedParms.uastcLevel : ''} ${
          mergedParms.textureCompressionType === 'etc1' ? '-comp_level ' + mergedParms.compLevel : ''
        } ${
          mergedParms.textureCompressionType === 'etc1' && mergedParms.maxCodebooks
            ? '-max_endpoints 16128 -max_selectors 16128'
            : ''
        } ${mergedParms.linear ? '-linear' : ''} ${mergedParms.flipY ? '-y_flip' : ''} ${
          mergedParms.mipmap ? '-mipmap' : ''
        }`
          .split(/\s+/)
          .filter((x) => !!x)
        execFileSync(BASIS_U, basisArgs)
        execFileSync('mv', [`${serverDir}/${xResizedName}`, nuPath])
        console.log('loaded ktx2 image ' + nuPath)
      } else {
        execFileSync('mv', [resizedPath, nuPath])
      }
      texture.setImage(fs.readFileSync(nuPath))
      texture.setMimeType(fileTypeToMime(mergedParms.textureFormat) ?? texture.getMimeType())
      */
    }
  }
  if (eeMaterialExtension) {
    for (const texture of eeMaterialExtension.textures) {
      document.createTexture().copy(texture)
    }
  }

  let maxTextureSize = 0
  for (const texture of textures) {
    const size = texture.getSize()
    if (size && size[0] > maxTextureSize) maxTextureSize = size[0]
  }
  onMetadata('maxTextureSize', maxTextureSize)

  let result
  if (['glb', 'vrm'].includes(parms.modelFormat)) {
    const data = await io.writeBinary(document)
    let finalPath = args.dst.replace(/\.[^.]*$/, `.${parms.modelFormat}`)
    if (!finalPath.endsWith(`.${parms.modelFormat}`)) {
      finalPath += `.${parms.modelFormat}`
    }
    await doUpload(data, finalPath)

    /*
    const uploadArgs = {
      path: savePath,
      fileName,
      body: data,
      contentType: (await getContentType(args.dst)) || ''
    }
    result = await API.instance.service('file-browser').patch(null, uploadArgs)
    */
    /*dispatchAction(
      BufferHandlerExtension.saveBuffer({
        {
          name: fileName,
          byteLength: data.byteLength,

        }
      })
    )*/
    result = finalPath
    console.log('Handled glb file')
  } else if (parms.modelFormat === 'gltf') {
    await Promise.all(
      [root.listBuffers(), root.listMeshes(), root.listTextures()].map(
        async (elements) =>
          await Promise.all(
            elements.map(async (element: Texture | Mesh | glBuffer) => {
              let elementName = ''
              if (element instanceof Texture) {
                elementName = hashBuffer(element.getImage()!)
              } else if (element instanceof Mesh) {
                elementName = hashBuffer(
                  Uint8Array.from(element.listPrimitives()[0].getAttribute('POSITION')!.getArray()!)
                )
              } else if (element instanceof glBuffer) {
                const bufferPath = pathJoin(LoaderUtils.extractUrlBase(args.src), element.getURI())
                const response = await fetch(bufferPath)
                const arrayBuffer = await response.arrayBuffer()
                const bufferData = new Uint8Array(arrayBuffer)
                elementName = hashBuffer(bufferData)
              }
              element.setName(elementName)
            })
          )
      )
    )
    document.transform(
      partition({
        animations: true,
        meshes: root.listMeshes().map((mesh) => mesh.getName())
      })
    )
    const { json, resources } = await io.writeJSON(document, { format: Format.GLTF, basename: resourceName })
    const folderURL = resourcePath.replace(config.client.fileServer, '')
    //await API.instance.service(fileBrowserPath).remove(folderURL)
    await API.instance.service(fileBrowserPath).create(folderURL)

    json.images?.map((image) => {
      const nuURI = pathJoin(
        args.resourceUri ? args.resourceUri : resourceName + '_resources',
        `${image.uri ? image.uri.split('.')[0] : image.name}.${mimeToFileType(image.mimeType)}`
      )
      resources[nuURI] = resources[image.uri!]
      delete resources[image.uri!]
      image.uri = nuURI
    })
    const defaultBufURI = uuidv4() + '.bin'
    json.buffers?.map((buffer) => {
      buffer.uri = pathJoin(
        args.resourceUri ? args.resourceUri : resourceName + '_resources',
        baseName(buffer.uri ?? defaultBufURI)
      )
    })
    Object.keys(resources).map((uri) => {
      const localPath = pathJoin(resourcePath, baseName(uri))
      resources[localPath] = resources[uri]
      delete resources[uri]
    })
    /*
    const doUpload = async (uri, data) => {
      const [savePath, fileName] = fileUploadPath(uri)
      const args = {
        path: savePath,
        fileName,
        body: data,
        contentType: (await getContentType(uri)) || ''
      }
      return API.instance.service(fileBrowserPath).patch(null, args)
    }
    await Promise.all(Object.entries(resources).map(([uri, data]) => doUpload(uri, data)))
    result = await doUpload(args.dst.replace(/\.glb$/, '.gltf'), Buffer.from(JSON.stringify(json)))
    */

    await Promise.all(
      Object.entries(resources).map(async ([uri, data]) => {
        const blob = new Blob([data], { type: fileTypeToMime(uri.split('.').pop()!)! })
        await doUpload(blob, uri)
      })
    )
    let finalPath = args.dst.replace(/\.[^.]*$/, '.gltf')
    if (!finalPath.endsWith('.gltf')) {
      finalPath += '.gltf'
    }
    await doUpload(new Blob([JSON.stringify(json)], { type: 'application/json' }), finalPath)
    result = finalPath
    console.log('Handled gltf file')
  }

  let totalVertexCount = 0
  const meshes = root.listMeshes()
  for (const mesh of meshes) {
    const primitives = mesh.listPrimitives()
    for (const primitive of primitives) {
      const indices = primitive.getIndices()
      if (indices) totalVertexCount += indices.getCount()
    }
  }
  onMetadata('vertexCount', totalVertexCount)
  result = pathJoin(LoaderUtils.extractUrlBase(args.src), result)
  return result
}
