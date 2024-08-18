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
import { FileThumbnailJobState } from '@etherealengine/client-core/src/common/services/FileThumbnailJobState'
import { NotificationService } from '@etherealengine/client-core/src/common/services/NotificationService'
import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import {
  FileBrowserContentType,
  StaticResourceType,
  UserID,
  fileBrowserPath,
  projectPath,
  staticResourcePath
} from '@etherealengine/common/src/schema.type.module'
import { CommonKnownContentTypes } from '@etherealengine/common/src/utils/CommonKnownContentTypes'
import { bytesToSize } from '@etherealengine/common/src/utils/btyesToSize'
import { unique } from '@etherealengine/common/src/utils/miscUtils'
import { AssetSelectionChangePropsType } from '@etherealengine/editor/src/components/assets/AssetsPreviewPanel'
import { FileDataType } from '@etherealengine/editor/src/components/assets/FileBrowser/FileDataType'
import ImageCompressionPanel from '@etherealengine/editor/src/components/assets/ImageCompressionPanel'
import ModelCompressionPanel from '@etherealengine/editor/src/components/assets/ModelCompressionPanel'
import { DndWrapper } from '@etherealengine/editor/src/components/dnd/DndWrapper'
import { SupportedFileTypes } from '@etherealengine/editor/src/constants/AssetTypes'
import { handleUploadFiles, inputFileWithAddToScene } from '@etherealengine/editor/src/functions/assetFunctions'
import { ProjectDownloadProgress, handleDownloadProject } from '@etherealengine/editor/src/panels/files/download'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import {
  FilesViewModeSettings,
  FilesViewModeState,
  availableTableColumns
} from '@etherealengine/editor/src/services/FilesState'
import { ClickPlacementState } from '@etherealengine/editor/src/systems/ClickPlacementSystem'
import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import { ImmutableArray, NO_PROXY, getMutableState, useHookstate, useMutableState } from '@etherealengine/hyperflux'
import {
  useFind,
  useMutation,
  useRealtime,
  useSearch
} from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import React, { Fragment, useEffect, useRef } from 'react'
import { useDrop } from 'react-dnd'
import { useTranslation } from 'react-i18next'
import { FaList } from 'react-icons/fa'
import { FiDownload, FiGrid, FiRefreshCcw } from 'react-icons/fi'
import { HiOutlineFolder, HiOutlinePlusCircle } from 'react-icons/hi'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { IoArrowBack, IoSettingsSharp } from 'react-icons/io5'
import { PiFolderPlusBold } from 'react-icons/pi'
import { twMerge } from 'tailwind-merge'
import Button from '../../../../../primitives/tailwind/Button'
import Input from '../../../../../primitives/tailwind/Input'
import LoadingView from '../../../../../primitives/tailwind/LoadingView'
import Slider from '../../../../../primitives/tailwind/Slider'
import Tooltip from '../../../../../primitives/tailwind/Tooltip'
import { ContextMenu } from '../../../../tailwind/ContextMenu'
import { Popup } from '../../../../tailwind/Popup'
import BooleanInput from '../../../input/Boolean'
import InputGroup from '../../../input/Group'
import { FileBrowserItem, FileTableWrapper, canDropItemOverFolder } from '../browserGrid'
import DeleteFileModal from '../browserGrid/DeleteFileModal'
import FilePropertiesModal from '../browserGrid/FilePropertiesModal'
import { FileUploadProgress } from '../upload/FileUploadProgress'

type FileBrowserContentPanelProps = {
  projectName?: string
  onSelectionChanged: (assetSelectionChange: AssetSelectionChangePropsType) => void
  disableDnD?: boolean
  originalPath: string
  folderName?: string
  nestingDirectory?: string
}

export type DnDFileType = {
  dataTransfer: DataTransfer
  files: File[]
  items: DataTransferItemList
}

export const FILES_PAGE_LIMIT = 100

export type FileType = FileDataType

export const createFileDigest = (files: ImmutableArray<FileType>): FileType => {
  const digest: FileType = {
    key: '',
    path: '',
    name: '',
    fullName: '',
    url: '',
    type: '',
    isFolder: false
  }
  for (const key in digest) {
    const allValues = new Set(files.map((file) => file[key]))
    if (allValues.size === 1) {
      digest[key] = Array.from(allValues).pop()
    }
  }
  return digest
}

export const createStaticResourceDigest = (staticResources: ImmutableArray<StaticResourceType>): StaticResourceType => {
  const digest: StaticResourceType = {
    id: '',
    key: '',
    mimeType: '',
    hash: '',
    type: '',
    project: '',
    // dependencies: '',
    attribution: '',
    licensing: '',
    description: '',
    // stats: '',
    thumbnailKey: '',
    thumbnailMode: '',
    updatedBy: '' as UserID,
    createdAt: '',
    updatedAt: '',

    url: '',
    userId: '' as UserID
  }
  for (const key in digest) {
    const allValues = new Set(staticResources.map((resource) => resource[key]))
    if (allValues.size === 1) {
      digest[key] = Array.from(allValues).pop()
    }
  }
  const allTags: string[] = Array.from(new Set(staticResources.flatMap((resource) => resource.tags))).filter(
    (tag) => tag != null
  ) as string[]
  const commonTags = allTags.filter((tag) => staticResources.every((resource) => resource.tags?.includes(tag)))
  digest.tags = commonTags
  return digest
}

export const filesConsistOfContentType = function (files: ImmutableArray<FileType>, contentType: string): boolean {
  return files.every((file) => {
    if (file.isFolder) {
      return contentType.startsWith('image')
    } else {
      const guessedType: string = CommonKnownContentTypes[file.type]
      return guessedType?.startsWith(contentType)
    }
  })
}

export function isFileDataType(value: any): value is FileDataType {
  return value && value.key
}

const viewModes = [
  { mode: 'list', icon: <FaList /> },
  { mode: 'icons', icon: <FiGrid /> }
]

function extractDirectoryWithoutOrgName(directory: string, orgName: string) {
  if (!orgName) return directory

  return directory.replace(`projects/${orgName}`, 'projects/')
}

/**
 * Gets the project name that may or may not have a single slash it in from a list of valid project names
 * @todo will be optimized away once orgname is fully supported
 */
export const useValidProjectForFileBrowser = (path: string) => {
  const [orgName, projectName] = path.split('/').slice(2, 4)
  const projects = useFind(projectPath, {
    query: {
      $or: [
        {
          name: `${orgName}/${projectName}`
        },
        {
          name: orgName
        }
      ],
      action: 'studio',
      allowed: true
    }
  })
  return (
    projects.data.find((project) => project.name === orgName || project.name === `${orgName}/${projectName}`)?.name ??
    ''
  )
}

function GeneratingThumbnailsProgress() {
  const { t } = useTranslation()
  const thumbnailJobState = useMutableState(FileThumbnailJobState)

  if (!thumbnailJobState.length) return null

  return (
    <LoadingView
      titleClassname="mt-0"
      containerClassname="flex-row mt-1"
      className="mx-2 my-auto h-6 w-6"
      title={t('editor:layout.filebrowser.generatingThumbnails', { count: thumbnailJobState.length })}
    />
  )
}

export const ViewModeSettings = () => {
  const { t } = useTranslation()

  const filesViewMode = useMutableState(FilesViewModeState).viewMode

  const viewModeSettings = useHookstate(getMutableState(FilesViewModeSettings))
  return (
    <Popup
      contentStyle={{ background: '#15171b', border: 'solid', borderColor: '#5d646c' }}
      position={'bottom left'}
      trigger={
        <Tooltip content={t('editor:layout.filebrowser.view-mode.settings.name')}>
          <Button startIcon={<IoSettingsSharp />} className="h-7 w-7 rounded-lg bg-[#2F3137] p-0" />
        </Tooltip>
      }
    >
      {filesViewMode.value === 'icons' ? (
        <InputGroup label={t('editor:layout.filebrowser.view-mode.settings.iconSize')}>
          <Slider
            min={10}
            max={100}
            step={0.5}
            value={viewModeSettings.icons.iconSize.value}
            onChange={viewModeSettings.icons.iconSize.set}
            onRelease={viewModeSettings.icons.iconSize.set}
          />
        </InputGroup>
      ) : (
        <>
          <InputGroup label={t('editor:layout.filebrowser.view-mode.settings.fontSize')}>
            <Slider
              min={10}
              max={100}
              step={0.5}
              value={viewModeSettings.list.fontSize.value}
              onChange={viewModeSettings.list.fontSize.set}
              onRelease={viewModeSettings.list.fontSize.set}
            />
          </InputGroup>

          <div>
            <div className="mt-1 flex flex-auto text-white">
              <label>{t('editor:layout.filebrowser.view-mode.settings.select-listColumns')}</label>
            </div>
            <div className="flex-col">
              {availableTableColumns.map((column) => (
                <InputGroup label={t(`editor:layout.filebrowser.table-list.headers.${column}`)}>
                  <BooleanInput
                    value={viewModeSettings.list.selectedTableColumns[column].value}
                    onChange={(value) => viewModeSettings.list.selectedTableColumns[column].set(value)}
                  />
                </InputGroup>
              ))}
            </div>
          </div>
        </>
      )}
    </Popup>
  )
}
/**
 * FileBrowserPanel used to render view for AssetsPanel.
 */
const FileBrowserContentPanel: React.FC<FileBrowserContentPanelProps> = (props) => {
  const { t } = useTranslation()

  const selectedDirectory = useHookstate(props.originalPath)

  const downloadState = useHookstate({
    total: 0,
    progress: 0,
    isDownloading: false
  })

  const projectName = useValidProjectForFileBrowser(selectedDirectory.value)
  const orgName = projectName.includes('/') ? projectName.split('/')[0] : ''

  const fileProperties = useHookstate<FileType[]>([])
  const anchorEl = useHookstate<HTMLButtonElement | null>(null)

  const filesViewMode = useMutableState(FilesViewModeState).viewMode

  const page = useHookstate(0)

  const fileQuery = useFind(fileBrowserPath, {
    query: {
      $skip: page.value,
      $limit: FILES_PAGE_LIMIT * 100,
      directory: selectedDirectory.value
    }
  })
  const isLoading = fileQuery.status === 'pending'
  const searchText = useHookstate('')
  useSearch(
    fileQuery,
    {
      key: {
        $like: `%${searchText.value}%`
      }
    },
    searchText.value
  )
  const files = fileQuery.data.map((file: FileBrowserContentType) => {
    const isFolder = file.type === 'folder'
    const fullName = isFolder ? file.name : file.name + '.' + file.type

    return {
      ...file,
      size: file.size ? bytesToSize(file.size) : '0',
      path: isFolder ? file.key.split(file.name)[0] : file.key.split(fullName)[0],
      fullName,
      isFolder
    }
  })

  useRealtime(staticResourcePath, fileQuery.refetch)

  FileThumbnailJobState.useGenerateThumbnails(fileQuery.data)

  const fileService = useMutation(fileBrowserPath)

  useEffect(() => {
    refreshDirectory()
  }, [selectedDirectory])

  const refreshDirectory = async () => {
    await fileQuery.refetch()
  }

  const changeDirectoryByPath = (path: string) => {
    selectedDirectory.set(path)
    fileQuery.setPage(0)
  }

  const onSelect = (event, params: FileDataType) => {
    if (params.isFolder && event.detail === 2) {
      const newPath = `${selectedDirectory.value}${params.name}/`
      changeDirectoryByPath(newPath)
    } else {
      props.onSelectionChanged({
        resourceUrl: params.url,
        name: params.name,
        contentType: params.type,
        size: params.size
      })

      ClickPlacementState.setSelectedAsset(params.url)
    }
  }

  const createNewFolder = async () => {
    fileService.create(`${selectedDirectory.value}New_Folder`)
  }

  const dropItemsOnPanel = async (
    data: FileDataType | DnDFileType,
    dropOn?: FileDataType,
    selectedFileKeys?: string[]
  ) => {
    if (isLoading) return
    const destinationPath = dropOn?.isFolder ? `${dropOn.key}/` : selectedDirectory.value

    if (selectedFileKeys && selectedFileKeys.length > 0) {
      await Promise.all(
        selectedFileKeys.map(async (fileKey) => {
          const file = files.find((f) => f.key === fileKey)
          if (file) {
            const newName = file.isFolder ? file.name : `${file.name}${file.type ? '.' + file.type : ''}`
            await moveContent(file.fullName, newName, file.path, destinationPath, false)
          }
        })
      )
    } else if (isFileDataType(data)) {
      if (dropOn?.isFolder) {
        const newName = data.isFolder ? data.name : `${data.name}${data.type ? '.' + data.type : ''}`
        await moveContent(data.fullName, newName, data.path, destinationPath, false)
      }
    } else {
      const path = selectedDirectory.get(NO_PROXY).slice(1)
      const toUpload = [] as File[]

      await Promise.all(
        data.files.map(async (file) => {
          const assetType = !file.type || file.type.length === 0 ? AssetLoader.getAssetType(file.name) : file.type
          if (!assetType || assetType === file.name) {
            // creating directory
            await fileService.create(`${destinationPath}${file.name}`)
          } else {
            toUpload.push(file)
          }
        })
      )

      if (toUpload.length) {
        try {
          await handleUploadFiles(projectName, path, toUpload)
        } catch (err) {
          NotificationService.dispatchNotify(err.message, { variant: 'error' })
        }
      }
    }

    await refreshDirectory()
  }

  const onBackDirectory = () => {
    const pattern = /([^/]+)/g
    const result = selectedDirectory.value.match(pattern)
    if (!result || result.length === 1 || (orgName && result.length === 2)) return
    let newPath = '/'
    for (let i = 0; i < result.length - 1; i++) {
      newPath += result[i] + '/'
    }
    changeDirectoryByPath(newPath)
  }

  const moveContent = async (
    oldName: string,
    newName: string,
    oldPath: string,
    newPath: string,
    isCopy = false
  ): Promise<void> => {
    if (isLoading) return
    try {
      await fileService.update(null, {
        oldProject: projectName,
        newProject: projectName,
        oldName,
        newName,
        oldPath,
        newPath,
        isCopy
      })

      await refreshDirectory()
    } catch (error) {
      console.error('Error moving file:', error)
      NotificationService.dispatchNotify((error as Error).message, { variant: 'error' })
    }
  }

  const currentContentRef = useRef(null! as { item: FileDataType; isCopy: boolean })

  const showDownloadButtons = selectedDirectory.value.startsWith('/projects/' + projectName + '/')
  const showUploadButtons =
    selectedDirectory.value.startsWith('/projects/' + projectName + '/public/') ||
    selectedDirectory.value.startsWith('/projects/' + projectName + '/assets/')
  const showBackButton = selectedDirectory.value.split('/').length > props.originalPath.split('/').length

  const BreadcrumbItems = () => {
    const handleBreadcrumbDirectoryClick = (targetFolder: string) => {
      if (orgName && targetFolder === 'projects') return
      const pattern = /([^/]+)/g
      const result = selectedDirectory.value.match(pattern)
      if (!result) return
      let newPath = '/'
      for (const folder of result) {
        newPath += folder + '/'
        if (folder === targetFolder) {
          break
        }
      }
      changeDirectoryByPath(newPath)
    }
    let breadcrumbDirectoryFiles = extractDirectoryWithoutOrgName(selectedDirectory.value, orgName)
      .slice(1, -1)
      .split('/')

    const nestedIndex = breadcrumbDirectoryFiles.indexOf('projects')

    breadcrumbDirectoryFiles = breadcrumbDirectoryFiles.filter((_, idx) => idx >= nestedIndex)

    return (
      <div className="flex h-[28px] w-96 items-center gap-1 rounded-lg border border-theme-input bg-[#141619] px-2 ">
        <HiOutlineFolder className="text-sm text-[#A3A3A3]" />
        {breadcrumbDirectoryFiles.map((file, index, arr) => (
          <Fragment key={index}>
            {index !== 0 && <span className="cursor-default items-center text-sm text-[#A3A3A3]"> {'>'} </span>}
            {index === arr.length - 1 || (orgName && index === 0) ? (
              <span className="cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap text-xs text-[#A3A3A3] hover:underline">
                {file}
              </span>
            ) : (
              <a
                className="inline-flex cursor-pointer items-center overflow-hidden text-sm text-[#A3A3A3] hover:text-theme-highlight hover:underline focus:text-theme-highlight"
                onClick={() => handleBreadcrumbDirectoryClick(file)}
              >
                <span className="cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap text-xs text-[#A3A3A3] hover:underline">
                  {file}
                </span>
              </a>
            )}
          </Fragment>
        ))}
      </div>
    )
  }

  const DropArea = () => {
    const [{ isFileDropOver }, fileDropRef] = useDrop({
      accept: [...SupportedFileTypes],
      canDrop: (item: Record<string, unknown>) => 'key' in item || canDropItemOverFolder(selectedDirectory.value),
      drop: (dropItem) => dropItemsOnPanel(dropItem as any),
      collect: (monitor) => ({ isFileDropOver: monitor.canDrop() && monitor.isOver() })
    })

    const isListView = filesViewMode.value === 'list'
    const staticResourceData = useFind(staticResourcePath, {
      query: {
        key: {
          $in: isListView ? files.map((file) => file.key) : []
        },
        project: props.projectName,
        $select: ['key', 'updatedAt'] as any,
        $limit: FILES_PAGE_LIMIT
      }
    })
    const staticResourceModifiedDates = useHookstate<Record<string, string>>({})

    useEffect(() => {
      if (staticResourceData.status !== 'success') return
      const modifiedDates: Record<string, string> = {}
      staticResourceData.data.forEach((data) => {
        modifiedDates[data.key] = new Date(data.updatedAt).toLocaleString()
      })
      staticResourceModifiedDates.set(modifiedDates)
    }, [staticResourceData.status])

    const handleFileBrowserItemClick = (e: React.MouseEvent, currentFile: FileDataType) => {
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey) {
        fileProperties.set((prevFileProperties) =>
          prevFileProperties.some((file) => file.key === currentFile.key)
            ? prevFileProperties.filter((file) => file.key !== currentFile.key)
            : [...prevFileProperties, currentFile]
        )
      } else if (e.shiftKey) {
        const lastIndex = files.findIndex((file) => file.key === fileProperties.value.at(-1)?.key)
        const clickedIndex = files.findIndex((file) => file.key === currentFile.key)
        const newSelectedFiles = files.slice(Math.min(lastIndex, clickedIndex), Math.max(lastIndex, clickedIndex) + 1)
        fileProperties.set((prevFileProperties) => [
          ...prevFileProperties,
          ...newSelectedFiles.filter((newFile) => !prevFileProperties.some((file) => newFile.key === file.key))
        ])
      } else {
        if (fileProperties.value.some((file) => file.key === currentFile.key)) {
          fileProperties.set([])
        } else {
          fileProperties.set([currentFile])
        }
      }
    }

    const resetSelection = () => {
      fileProperties.set([])
      ClickPlacementState.resetSelectedAsset()
    }

    const [anchorEvent, setAnchorEvent] = React.useState<undefined | React.MouseEvent<HTMLDivElement>>(undefined)
    const handleClose = () => {
      setAnchorEvent(undefined)
    }

    const pasteContent = async () => {
      handleClose()
      if (isLoading) return

      fileService.update(null, {
        oldProject: projectName,
        newProject: projectName,
        oldName: currentContentRef.current.item.fullName,
        newName: currentContentRef.current.item.fullName,
        oldPath: currentContentRef.current.item.path,
        newPath: currentContentRef.current.item.path,
        isCopy: currentContentRef.current.isCopy
      })
    }

    return (
      <div
        className="h-full"
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setAnchorEvent(event)
        }}
      >
        <div
          ref={fileDropRef}
          className={twMerge(
            'mb-2 h-auto px-3 pb-6 text-gray-400 ',
            isListView ? '' : 'flex py-8',
            isFileDropOver ? 'border-2 border-gray-300' : ''
          )}
          onClick={(event) => {
            event.stopPropagation()
            resetSelection()
          }}
        >
          <div className={twMerge(!isListView && 'flex flex-wrap gap-2')}>
            <FileTableWrapper wrap={isListView}>
              <>
                {unique(files, (file) => file.key).map((file) => (
                  <FileBrowserItem
                    key={file.key}
                    item={file}
                    disableDnD={props.disableDnD}
                    projectName={projectName}
                    onClick={(event) => {
                      handleFileBrowserItemClick(event, file)
                      onSelect(event, file)
                    }}
                    onContextMenu={(event, currentFile) => {
                      if (!fileProperties.value.length) {
                        fileProperties.set([file])
                      }
                    }}
                    currentContent={currentContentRef}
                    handleDropItemsOnPanel={(data, dropOn) =>
                      dropItemsOnPanel(
                        data,
                        dropOn,
                        fileProperties.value.map((file) => file.key)
                      )
                    }
                    openFileProperties={(item) => {
                      /** If the file is not in the list of files, add it */
                      if (!(fileProperties.get(NO_PROXY) as FileDataType[]).includes(item)) {
                        if (fileProperties.value.length > 1) {
                          fileProperties.merge([item])
                        } else {
                          fileProperties.set([item])
                        }
                      }
                      PopoverState.showPopupover(
                        <FilePropertiesModal projectName={projectName} files={fileProperties.value} />
                      )
                    }}
                    openDeleteFileModal={() => {
                      PopoverState.showPopupover(
                        <DeleteFileModal
                          files={fileProperties.value as FileDataType[]}
                          onComplete={(err) => {
                            resetSelection()
                          }}
                        />
                      )
                    }}
                    openImageCompress={() => {
                      if (filesConsistOfContentType(fileProperties.value, 'image')) {
                        PopoverState.showPopupover(
                          <ImageCompressionPanel
                            selectedFiles={fileProperties.value}
                            refreshDirectory={refreshDirectory}
                          />
                        )
                      }
                    }}
                    openModelCompress={() => {
                      if (filesConsistOfContentType(fileProperties.value, 'model')) {
                        PopoverState.showPopupover(
                          <ModelCompressionPanel
                            selectedFiles={fileProperties.value}
                            refreshDirectory={refreshDirectory}
                          />
                        )
                      }
                    }}
                    isFilesLoading={isLoading}
                    addFolder={createNewFolder}
                    isListView={isListView}
                    staticResourceModifiedDates={staticResourceModifiedDates.value}
                    isSelected={fileProperties.value.some(({ key }) => key === file.key)}
                    refreshDirectory={refreshDirectory}
                    selectedFileKeys={fileProperties.value.map((file) => file.key)}
                  />
                ))}
              </>
            </FileTableWrapper>
            {/*   
              {total > 0 && validFiles.value.length < total && (
              <TablePagination
                className={styles.pagination}
                component="div"
                count={total}
                page={page}
                rowsPerPage={FILES_PAGE_LIMIT}
                rowsPerPageOptions={[]}
                onPageChange={handlePageChange}
              />
            )}*/}
          </div>

          <ContextMenu anchorEvent={anchorEvent} onClose={handleClose}>
            <Button variant="outline" size="small" fullWidth onClick={() => createNewFolder()}>
              {t('editor:layout.filebrowser.addNewFolder')}
            </Button>
            <Button
              variant="outline"
              size="small"
              fullWidth
              disabled={!currentContentRef.current}
              onClick={pasteContent}
            >
              {t('editor:layout.filebrowser.pasteAsset')}
            </Button>
          </ContextMenu>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-1 flex h-9 items-center gap-2 bg-theme-surface-main">
        <div className="ml-2"></div>
        {showBackButton && (
          <div id="backDir" className={`pointer-events-auto flex h-7 w-7 items-center rounded-lg bg-[#2F3137]`}>
            <Tooltip content={t('editor:layout.filebrowser.back')} className="left-1">
              <Button variant="transparent" startIcon={<IoArrowBack />} className={`p-0`} onClick={onBackDirectory} />
            </Tooltip>
          </div>
        )}

        <div id="refreshDir" className="flex h-7 w-7 items-center rounded-lg bg-[#2F3137]">
          <Tooltip content={t('editor:layout.filebrowser.refresh')}>
            <Button variant="transparent" startIcon={<FiRefreshCcw />} className="p-0" onClick={refreshDirectory} />
          </Tooltip>
        </div>

        <ViewModeSettings />

        <div className="w-30 flex h-7 flex-row items-center gap-1 rounded-lg bg-[#2F3137] px-2 py-1 ">
          {viewModes.map(({ mode, icon }) => (
            <Button
              key={mode}
              variant="transparent"
              startIcon={icon}
              className={`p-0 ${filesViewMode.value !== mode ? 'opacity-50' : ''}`}
              onClick={() => filesViewMode.set(mode as 'icons' | 'list')}
            />
          ))}
        </div>

        <div className="align-center flex h-7 w-full justify-center gap-2 sm:px-2 md:px-4 lg:px-6 xl:px-10">
          <BreadcrumbItems />
          <Input
            placeholder={t('editor:layout.filebrowser.search-placeholder')}
            value={searchText.value}
            onChange={(e) => {
              searchText.set(e.target.value)
            }}
            labelClassname="text-sm text-red-500"
            containerClassname="flex h-full w-auto"
            className="h-7 rounded-lg border border-theme-input bg-[#141619] px-2 py-0 text-xs text-[#A3A3A3] placeholder:text-[#A3A3A3] focus-visible:ring-0"
            startComponent={<HiMagnifyingGlass className="h-[14px] w-[14px] text-[#A3A3A3]" />}
          />
        </div>

        <div id="downloadProject" className="flex h-7 w-7 items-center rounded-lg bg-[#2F3137]">
          <Tooltip content={t('editor:layout.filebrowser.downloadProject')}>
            <Button
              variant="transparent"
              startIcon={<FiDownload />}
              className="p-0"
              onClick={() => handleDownloadProject(projectName, selectedDirectory.value)}
              disabled={!showDownloadButtons}
            />
          </Tooltip>
        </div>

        <div id="newFolder" className="flex h-7 w-7 items-center rounded-lg bg-[#2F3137]">
          <Tooltip content={t('editor:layout.filebrowser.addNewFolder')}>
            <Button variant="transparent" startIcon={<PiFolderPlusBold />} className="p-0" onClick={createNewFolder} />
          </Tooltip>
        </div>

        <Button
          id="uploadFiles"
          startIcon={<HiOutlinePlusCircle />}
          disabled={!showUploadButtons}
          rounded="none"
          className="h-full whitespace-nowrap bg-theme-highlight px-2"
          size="small"
          onClick={() =>
            inputFileWithAddToScene({ projectName, directoryPath: selectedDirectory.get(NO_PROXY).slice(1) })
              .then(refreshDirectory)
              .catch((err) => {
                NotificationService.dispatchNotify(err.message, { variant: 'error' })
              })
          }
        >
          {t('editor:layout.filebrowser.uploadFiles')}
        </Button>
        <Button
          id="uploadFiles"
          startIcon={<HiOutlinePlusCircle />}
          disabled={!showUploadButtons}
          rounded="none"
          className="h-full whitespace-nowrap bg-theme-highlight px-2"
          size="small"
          onClick={() =>
            inputFileWithAddToScene({
              projectName,
              directoryPath: selectedDirectory.get(NO_PROXY).slice(1),
              preserveDirectory: true
            })
              .then(refreshDirectory)
              .catch((err) => {
                NotificationService.dispatchNotify(err.message, { variant: 'error' })
              })
          }
        >
          {t('editor:layout.filebrowser.uploadFolder')}
        </Button>
      </div>
      <FileUploadProgress />
      <ProjectDownloadProgress />
      {isLoading && (
        <LoadingView title={t('editor:layout.filebrowser.loadingFiles')} fullSpace className="block h-12 w-12" />
      )}
      <GeneratingThumbnailsProgress />
      <div id="file-browser-panel" className="h-full overflow-auto">
        <DndWrapper id="file-browser-panel">
          <DropArea />
        </DndWrapper>
      </div>
    </>
  )
}

export default function FilesPanelContainer() {
  const assetsPreviewPanelRef = React.useRef()
  const originalPath = useMutableState(EditorState).projectName.value

  const onSelectionChanged = (props: AssetSelectionChangePropsType) => {
    ;(assetsPreviewPanelRef as any).current?.onSelectionChanged?.(props)
  }

  return (
    <FileBrowserContentPanel
      originalPath={'/projects/' + originalPath + '/assets/'}
      onSelectionChanged={onSelectionChanged}
    />
  )
}
