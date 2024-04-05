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

import { ProjectType, projectPath, projectPermissionPath } from '@etherealengine/common/src/schema.type.module'
import React from 'react'
import DataTable from '../../common/Table'
import { ProjectRowType, projectsColumns } from '../../common/constants/project'

import { ProjectUpdateState } from '@etherealengine/client-core/src/admin/services/ProjectUpdateService'
import { NotificationService } from '@etherealengine/client-core/src/common/services/NotificationService'
import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { ProjectService } from '@etherealengine/client-core/src/common/services/ProjectService'
import config from '@etherealengine/common/src/config'
import multiLogger from '@etherealengine/common/src/logger'
import { getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import ConfirmDialog from '@etherealengine/ui/src/components/tailwind/ConfirmDialog'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import CopyText from '@etherealengine/ui/src/primitives/tailwind/CopyText'
import Toggle from '@etherealengine/ui/src/primitives/tailwind/Toggle'
import Tooltip from '@etherealengine/ui/src/primitives/tailwind/ToolTip'
import { useTranslation } from 'react-i18next'
import { GrGithub } from 'react-icons/gr'
import {
  HiOutlineArrowPath,
  HiOutlineCommandLine,
  HiOutlineExclamationCircle,
  HiOutlineFolder,
  HiOutlineTrash,
  HiOutlineUsers
} from 'react-icons/hi2'
import AddEditProjectModal from './AddEditProjectModal'
import ManageUserPermissionModal from './ManageUserPermissionModal'

const logger = multiLogger.child({ component: 'client-core:ProjectTable' })

export default function ProjectTable() {
  const { t } = useTranslation()
  const modalProcessing = useHookstate(false)
  const activeProjectId = useHookstate<string | null>(null)
  const projectQuery = useFind(projectPath, {
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
      projectId: activeProjectId?.value,
      paginate: false
    }
  })

  const handleEnabledChange = async (project: ProjectType) => {
    await ProjectService.setEnabled(project.id, !project.enabled)
    projectQuery.refetch()
  }

  const RowActions = ({ project }: { project: ProjectType }) => {
    const projectUpdateStatus = useHookstate(getMutableState(ProjectUpdateState)[project.name]).value

    return (
      <div className="flex items-center justify-evenly p-1">
        <Button
          startIcon={<HiOutlineArrowPath />}
          size="small"
          className="bg-theme-blue-secondary mr-2 h-min whitespace-pre text-[#214AA6] disabled:opacity-50 dark:text-white"
          disabled={project.name === 'default-project'}
          onClick={() => {
            PopoverState.showPopupover(
              <AddEditProjectModal
                update={true}
                processing={modalProcessing.value}
                inputProject={project}
                onSubmit={async () => {
                  modalProcessing.set(true)
                  await ProjectService.uploadProject({
                    sourceURL: projectUpdateStatus.sourceURL,
                    destinationURL: projectUpdateStatus.destinationURL,
                    name: projectUpdateStatus.projectName,
                    reset: true,
                    commitSHA: projectUpdateStatus.selectedSHA,
                    sourceBranch: projectUpdateStatus.selectedBranch,
                    updateType: projectUpdateStatus.updateType,
                    updateSchedule: projectUpdateStatus.updateSchedule
                  }).catch((err) => {
                    NotificationService.dispatchNotify(err.message, { variant: 'error' })
                  })
                  modalProcessing.set(false)
                  PopoverState.hidePopupover()
                }}
              />
            )
          }}
        >
          {t('admin:components.project.actions.update')}
        </Button>
        <Button
          startIcon={<GrGithub />}
          size="small"
          className="bg-theme-blue-secondary mr-2 h-min whitespace-pre text-[#214AA6] disabled:opacity-50 dark:text-white"
          disabled={!project || !project.repositoryPath || project.name === 'default-project'}
          onClick={() => {
            PopoverState.showPopupover(
              <ConfirmDialog
                text={`${t('admin:components.project.confirmPushProjectToGithub')}? ${project.name} - ${
                  project.repositoryPath
                }`}
                onSubmit={async () => {
                  await ProjectService.pushProject(project.id).catch(() => modalProcessing.set(false))
                }}
              />
            )
          }}
        >
          {t('admin:components.project.actions.push')}
        </Button>

        <Button
          startIcon={<HiOutlineUsers />}
          size="small"
          className="bg-theme-blue-secondary mr-2 h-min whitespace-pre text-[#214AA6] disabled:opacity-50 dark:text-white"
          onClick={() => {
            activeProjectId.set(project.id)
            PopoverState.showPopupover(
              <ManageUserPermissionModal project={project} projectPermissions={projectPermissionsFindQuery.data} />
            )
          }}
        >
          {t('admin:components.project.actions.access')}
        </Button>
        <Button
          startIcon={<HiOutlineCommandLine />}
          size="small"
          className="bg-theme-blue-secondary mr-2 h-min whitespace-pre text-[#214AA6] disabled:opacity-50 dark:text-white"
          disabled={config.client.localBuildOrDev}
          onClick={() => {
            PopoverState.showPopupover(
              <ConfirmDialog
                text={`${t('admin:components.project.confirmProjectInvalidate')} '${project.name}'?`}
                onSubmit={async () => {
                  await ProjectService.invalidateProjectCache(project.name)
                }}
              />
            )
          }}
        >
          {t('admin:components.project.actions.invalidateCache')}
        </Button>
        <Button
          startIcon={<HiOutlineFolder />}
          size="small"
          className="bg-theme-blue-secondary mr-2 h-min whitespace-pre text-[#214AA6] disabled:opacity-50 dark:text-white"
        >
          {t('admin:components.common.view')}
        </Button>
        <Button
          startIcon={<HiOutlineTrash />}
          size="small"
          className="bg-theme-blue-secondary h-min whitespace-pre text-[#214AA6] disabled:opacity-50 dark:text-white"
          disabled={project.name === 'default-project'}
          onClick={() => {
            PopoverState.showPopupover(
              <ConfirmDialog
                text={`${t('admin:components.project.confirmProjectDelete')} '${project.name}'?`}
                onSubmit={async () => {
                  await ProjectService.removeProject(project.id).catch((err) => logger.error(err))
                }}
              />
            )
          }}
        >
          {t('admin:components.common.remove')}
        </Button>
      </div>
    )
  }

  const createRows = (rows: readonly ProjectType[]): ProjectRowType[] =>
    rows.map((row) => {
      return {
        name: (
          <div className="flex items-center gap-2">
            <a href={`/studio/${row.name}`} className={row.needsRebuild ? 'text-blue-400' : 'text-theme-primary'}>
              {row.name}
            </a>
            {!!row.needsRebuild && (
              <Tooltip title={t('admin:components.project.outdatedBuild')} direction="right">
                <HiOutlineExclamationCircle className="text-orange-400" />
              </Tooltip>
            )}
            {!!row.hasLocalChanges && (
              <Tooltip title={t('admin:components.project.hasLocalChanges')} direction="right">
                <HiOutlineExclamationCircle className="text-yellow-400" />
              </Tooltip>
            )}
          </div>
        ),
        projectVersion: row.version,
        enabled: (
          <Toggle
            disabled={row.name === 'default-project'}
            value={row.enabled}
            onChange={() => handleEnabledChange(row)}
          />
        ),
        commitSHA: (
          <span className="flex items-center justify-between">
            <Tooltip title={row.commitSHA || ''}>
              <>{row.commitSHA?.slice(0, 8)}</>
            </Tooltip>{' '}
            <CopyText text={row.commitSHA || ''} className="ml-1" />
          </span>
        ),
        commitDate: row.commitDate
          ? new Date(row.commitDate).toLocaleString('en-us', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            })
          : '-',
        actions: <RowActions project={row} />
      }
    })

  return <DataTable query={projectQuery} columns={projectsColumns} rows={createRows(projectQuery.data)} />
}
