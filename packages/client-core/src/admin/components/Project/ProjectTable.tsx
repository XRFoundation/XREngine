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

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ConfirmDialog from '@etherealengine/client-core/src/common/components/ConfirmDialog'
import multiLogger from '@etherealengine/common/src/logger'
import Box from '@etherealengine/ui/src/primitives/mui/Box'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'
import IconButton from '@etherealengine/ui/src/primitives/mui/IconButton'
import Tooltip from '@etherealengine/ui/src/primitives/mui/Tooltip'

import { ProjectType, projectPath, projectPermissionPath } from '@etherealengine/common/src/schema.type.module'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import { useHookstate } from '@hookstate/core'
import InputSwitch from '../../../common/components/InputSwitch'
import { NotificationService } from '../../../common/services/NotificationService'
import { ProjectService } from '../../../common/services/ProjectService'
import { useUserHasAccessHook } from '../../../user/userHasAccess'
import TableComponent from '../../common/Table'
import { projectsColumns } from '../../common/variables/projects'
import styles from '../../styles/admin.module.scss'
import ProjectDrawer from './ProjectDrawer'
import ProjectFilesDrawer from './ProjectFilesDrawer'
import UserPermissionDrawer from './UserPermissionDrawer'

const logger = multiLogger.child({ component: 'client-core:ProjectTable' })

interface Props {
  className?: string
}

interface ConfirmData {
  open: boolean
  processing: boolean
  description: string
  onSubmit: () => void
}

const defaultConfirm: ConfirmData = {
  open: false,
  processing: false,
  description: '',
  onSubmit: () => {}
}

const ProjectTable = ({ className }: Props) => {
  const { t } = useTranslation()
  const activeProject = useHookstate<ProjectType | null>(null)
  const [processing, setProcessing] = useState(false)
  const [confirm, setConfirm] = useState({ ...defaultConfirm })
  const [showProjectFiles, setShowProjectFiles] = useState(false)
  const [openProjectDrawer, setOpenProjectDrawer] = useState(false)
  const [openUserPermissionDrawer, setOpenUserPermissionDrawer] = useState(false)
  const [changeDestination, setChangeDestination] = useState(false)

  const projectsQuery = useFind(projectPath, {
    query: {
      allowed: true,
      $limit: 100,
      action: 'admin',
      $sort: {
        name: 1
      }
    }
  })

  const projectPermissionsFindQuery = useFind(projectPermissionPath, {
    query: {
      projectId: activeProject?.value?.id,
      paginate: false
    }
  })

  const projectsData = projectsQuery.data as ProjectType[]

  useEffect(() => {
    if (activeProject.value) activeProject.set(projectsData.find((proj) => proj.name === activeProject.value!.name)!)
  }, [projectsData])

  const handleRemoveProject = async () => {
    try {
      if (activeProject.value) {
        const projectToRemove = projectsData.find((p) => p.name === activeProject.value!.name)!
        if (projectToRemove) {
          await ProjectService.removeProject(projectToRemove.id)
          handleCloseConfirmation()
        } else {
          throw new Error('Failed to find the project')
        }
      }
    } catch (err) {
      logger.error(err)
    }
  }

  const handlePushProjectToGithub = async () => {
    try {
      if (activeProject) {
        if (!activeProject.value!.repositoryPath && activeProject.value!.name !== 'default-project') return

        setProcessing(true)
        await ProjectService.pushProject(activeProject.value!.id)
        setProcessing(false)

        handleCloseConfirmation()
      }
    } catch (err) {
      setProcessing(false)
      logger.error(err)
    }
  }

  const handleInvalidateCache = async () => {
    try {
      setProcessing(true)
      await ProjectService.invalidateProjectCache(activeProject!.value!.name)
      setProcessing(false)

      handleCloseConfirmation()
    } catch (err) {
      setProcessing(false)
      logger.error(err)
    }
  }

  const handleEnabledChange = async (project: ProjectType) => {
    await ProjectService.setEnabled(activeProject.value!.id, !activeProject.value!.enabled)
    projectsQuery.refetch()
  }

  const openPushConfirmation = (row) => {
    activeProject.set(row)

    setConfirm({
      open: true,
      processing: processing,
      description: `${t('admin:components.project.confirmPushProjectToGithub')}? ${row.name} - ${row.repositoryPath}`,
      onSubmit: handlePushProjectToGithub
    })
  }

  const openInvalidateConfirmation = (row) => {
    activeProject.set(row)

    setConfirm({
      open: true,
      processing: processing,
      description: `${t('admin:components.project.confirmProjectInvalidate')} '${row.name}'?`,
      onSubmit: handleInvalidateCache
    })
  }

  const openRemoveConfirmation = (row) => {
    activeProject.set(row)

    setConfirm({
      open: true,
      processing: false,
      description: `${t('admin:components.project.confirmProjectDelete')} '${row.name}'?`,
      onSubmit: handleRemoveProject
    })
  }

  const openViewProject = (row) => {
    activeProject.set(row)
    setShowProjectFiles(true)
  }

  const handleOpenProjectDrawer = (row, changeDestination = false) => {
    activeProject.set(row)
    setChangeDestination(changeDestination)
    setOpenProjectDrawer(true)
  }

  const handleOpenUserPermissionDrawer = (row) => {
    activeProject.set(row)
    setOpenUserPermissionDrawer(true)
  }

  const handleCloseProjectDrawer = () => {
    setChangeDestination(false)
    setOpenProjectDrawer(false)
    activeProject.set(null)
  }

  const handleCloseUserPermissionDrawer = () => {
    setOpenUserPermissionDrawer(false)
    activeProject.set(null)
  }

  const handleCloseConfirmation = () => {
    setConfirm({ ...confirm, open: false })
    setConfirm({ ...defaultConfirm })
    activeProject.set(null)
  }

  const copyShaToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha)
    NotificationService.dispatchNotify(t('admin:components.project.commitSHACopied'), {
      variant: 'success'
    })
  }

  const hasProjectWritePermission = useUserHasAccessHook('projects:write')

  const createData = (el: ProjectType, name: string) => {
    const commitSHA = el.commitSHA
    return {
      el,
      name: (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <a href={`/studio/${name}`} className={`${el.needsRebuild ? styles.orangeColor : ''}`}>
            {name}
          </a>
          {Boolean(el.needsRebuild) && (
            <Tooltip title={t('admin:components.project.outdatedBuild')} arrow>
              <Icon type="ErrorOutline" sx={{ marginLeft: 1 }} className={styles.orangeColor} />
            </Tooltip>
          )}
          {Boolean(el.hasLocalChanges) && (
            <Tooltip title={t('admin:components.project.hasLocalChanges')} arrow>
              <Icon type="ErrorOutline" sx={{ marginLeft: 1 }} className={styles.goldColor} />
            </Tooltip>
          )}
        </Box>
      ),
      projectVersion: (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <span>{el.version}</span>
        </Box>
      ),
      enabled: (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <InputSwitch
            name="enabled"
            disabled={el.name === 'default-project'}
            checked={el.enabled}
            onChange={() => handleEnabledChange(el)}
          />
        </Box>
      ),
      commitSHA: (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <div className={styles.commitContents}>
            {commitSHA?.substring(0, 8)}
            {commitSHA ? <Icon type="ContentCopy" onClick={() => copyShaToClipboard(commitSHA)} /> : '-'}
          </div>
        </Box>
      ),
      commitDate: (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <span>
            {el.commitDate
              ? new Date(el.commitDate).toLocaleString('en-us', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric'
                })
              : '-'}
          </span>
        </Box>
      ),
      update: (
        <>
          {hasProjectWritePermission && name !== 'default-project' && (
            <IconButton
              className={styles.iconButton}
              name="update"
              disabled={el.repositoryPath === null}
              onClick={() => handleOpenProjectDrawer(el)}
              icon={<Icon type="Refresh" />}
            />
          )}
          {hasProjectWritePermission && name === 'default-project' && (
            <Tooltip title={t('admin:components.project.defaultProjectUpdateTooltip')} arrow>
              <IconButton className={styles.iconButton} name="update" disabled={true} icon={<Icon type="Refresh" />} />
            </Tooltip>
          )}
        </>
      ),
      push: (
        <>
          {hasProjectWritePermission && (
            <IconButton
              className={styles.iconButton}
              name="update"
              disabled={!el.hasWriteAccess || !el.repositoryPath}
              onClick={() => openPushConfirmation(el)}
              icon={<Icon type="Upload" />}
            />
          )}
        </>
      ),
      link: (
        <>
          {hasProjectWritePermission && (
            <IconButton
              className={styles.iconButton}
              name="update"
              disabled={name === 'default-project'}
              onClick={() => handleOpenProjectDrawer(el, true)}
              icon={<Icon type={!el.repositoryPath ? 'LinkOff' : 'Link'} />}
            />
          )}
        </>
      ),
      projectPermissions: (
        <>
          {hasProjectWritePermission && (
            <IconButton
              className={styles.iconButton}
              name="editProjectPermissions"
              onClick={() => handleOpenUserPermissionDrawer(el)}
              icon={<Icon type="Group" />}
            />
          )}
        </>
      ),
      invalidate: (
        <>
          {hasProjectWritePermission && (
            <IconButton
              className={styles.iconButton}
              name="invalidate"
              onClick={() => openInvalidateConfirmation(el)}
              icon={<Icon type="CleaningServices" />}
            />
          )}
        </>
      ),
      view: (
        <>
          {hasProjectWritePermission && (
            <IconButton
              className={styles.iconButton}
              name="view"
              onClick={() => openViewProject(el)}
              icon={<Icon type="Visibility" />}
            />
          )}
        </>
      ),
      action: (
        <>
          {hasProjectWritePermission && (
            <IconButton
              className={styles.iconButton}
              name="remove"
              onClick={() => openRemoveConfirmation(el)}
              icon={<Icon type="Cancel" />}
            />
          )}
        </>
      )
    }
  }

  const rows = projectsData.map((el) => {
    return createData(el, el.name)
  })

  return (
    <Box className={className}>
      <TableComponent query={projectsQuery} rows={rows} column={projectsColumns} />

      {openProjectDrawer && activeProject.value && (
        <ProjectDrawer
          open={openProjectDrawer}
          changeDestination={changeDestination}
          inputProject={activeProject.value}
          existingProject={true}
          onClose={() => handleCloseProjectDrawer()}
        />
      )}

      {activeProject.value && (
        <UserPermissionDrawer
          open={openUserPermissionDrawer}
          project={activeProject.value}
          projectPermissions={projectPermissionsFindQuery.data}
          onClose={handleCloseUserPermissionDrawer}
        />
      )}

      {showProjectFiles && activeProject.value && (
        <ProjectFilesDrawer open selectedProject={activeProject.value} onClose={() => setShowProjectFiles(false)} />
      )}

      <ConfirmDialog
        processing={processing}
        open={confirm.open}
        description={confirm.description}
        onClose={handleCloseConfirmation}
        onSubmit={confirm.onSubmit}
      />
    </Box>
  )
}

export default ProjectTable
