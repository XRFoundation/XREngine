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

import { Paginated } from '@feathersjs/feathers'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { locationPath, LocationType } from '@etherealengine/common/src/schema.type.module'
import { Engine } from '@etherealengine/ecs/src/Engine'
import Button from '@etherealengine/ui/src/primitives/mui/Button'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'
import InputAdornment from '@etherealengine/ui/src/primitives/mui/InputAdornment'
import Table from '@etherealengine/ui/src/primitives/mui/Table'
import TableBody from '@etherealengine/ui/src/primitives/mui/TableBody'
import TableCell from '@etherealengine/ui/src/primitives/mui/TableCell'
import TableHead from '@etherealengine/ui/src/primitives/mui/TableHead'
import TablePagination from '@etherealengine/ui/src/primitives/mui/TablePagination'
import TableRow from '@etherealengine/ui/src/primitives/mui/TableRow'
import TextField from '@etherealengine/ui/src/primitives/mui/TextField'
import Typography from '@etherealengine/ui/src/primitives/mui/Typography'

import { LocationSeed } from '../../../../social/services/LocationService'
import styles from '../index.module.scss'

interface Props {
  changeActiveLocation: (location: LocationType) => void
}
const LocationMenu = (props: Props) => {
  const [page, setPage] = useState(0)
  const [locationDetails, setLocationsDetails] = useState<Paginated<LocationType>>(null!)
  const ROWS_PER_PAGE = 10
  const { t } = useTranslation()
  const tableHeaders = [
    { id: 'name', numeric: false, disablePadding: false, label: t('user:usermenu.locationTable.col-name') },
    { id: 'sceneId', numeric: false, disablePadding: false, label: t('user:usermenu.locationTable.col-scene') },
    {
      id: 'maxUsersPerInstance',
      numeric: true,
      disablePadding: false,
      label: t('user:usermenu.locationTable.col-maxuser')
    }
  ]

  useEffect(() => {
    fetchLocations(0, ROWS_PER_PAGE)
  }, [])

  const fetchLocations = (page: number, rows: number, search?: string) => {
    Engine.instance.api
      .service(locationPath)
      .find({
        query: {
          $limit: rows,
          $skip: page * rows,
          $or: [
            {
              name: {
                $like: `%${search}%`
              }
            },
            {
              sceneId: {
                $like: `%${search}%`
              }
            }
          ]
        }
      })
      .then((res: Paginated<LocationType>) => {
        setLocationsDetails(res)
      })
  }

  const handlePageChange = (_, page) => {
    fetchLocations(page, ROWS_PER_PAGE)
    setPage(page)
  }

  let isTimerStarted = false
  const handleSearch = () => {
    if (isTimerStarted) return

    isTimerStarted = true

    setTimeout(() => {
      isTimerStarted = false
      const value = (document.getElementById('searchbox') as any).value
      fetchLocations(page, ROWS_PER_PAGE, value)
    }, 500)
  }

  return (
    <div className={styles.menuPanel}>
      <section className={styles.locationPanel}>
        <Typography variant="h2">{t('user:usermenu.locationTable.title')}</Typography>
        {!locationDetails ? (
          <section>{t('user:usermenu.locationTable.loading')}</section>
        ) : (
          <>
            <section className={styles.control}>
              <TextField
                margin="none"
                size="small"
                placeholder={t('user:usermenu.locationTable.lbl-search')}
                variant="outlined"
                id="searchbox"
                onChange={handleSearch}
                className={styles.searchbox}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Icon type="Search" />
                    </InputAdornment>
                  )
                }}
              />
              <Button className={styles.newLocation} onClick={() => props.changeActiveLocation(LocationSeed)}>
                <Icon type="Add" />
                {t('user:usermenu.locationTable.lbl-new')}
              </Button>
            </section>
            <section className={styles.tableContainer}>
              <Table size="small" className={styles.locationTable}>
                <TableHead className={styles.tableHead}>
                  <TableRow className={styles.trow}>
                    {tableHeaders.map((headCell) => (
                      <TableCell className={styles.tcell} key={headCell.id}>
                        {headCell.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody className={styles.tablebody}>
                  {locationDetails.data?.map((row, i) => {
                    return (
                      <TableRow
                        className={styles.tableRow}
                        key={i}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') props.changeActiveLocation(row)
                        }}
                        onClick={() => props.changeActiveLocation(row)}
                      >
                        {tableHeaders.map((headCell) => (
                          <TableCell className={styles.tableCell} key={headCell.id}>
                            {row[headCell.id]}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </section>
            <TablePagination
              component="div"
              count={locationDetails.total}
              rowsPerPage={ROWS_PER_PAGE}
              rowsPerPageOptions={[ROWS_PER_PAGE]}
              page={page}
              onPageChange={handlePageChange}
              size="small"
              className={styles.tablePagination}
            />
          </>
        )}
      </section>
    </div>
  )
}

export default LocationMenu
