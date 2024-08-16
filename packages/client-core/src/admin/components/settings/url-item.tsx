import Input from "@etherealengine/ui/src/primitives/tailwind/Input";
import Button from "@etherealengine/ui/src/primitives/tailwind/Button";
import React from "react";
import { useTranslation } from 'react-i18next'
import { HiTrash } from 'react-icons/hi2'
import { v4 as uuidv4 } from 'uuid'

export const URLItem = ({
    iceServer
}) => {
    const { t } = useTranslation()

    return typeof iceServer.urls.value === 'string' ? <div className="col-span-1 flex flex-row items-center"> <Input
        className="col-span-1"
        label={t('admin:components.setting.webRTCSettings.iceURL')}
        value={iceServer.urls.value}
        onChange={(e) => {
            iceServer.urls.set(e.target.value)
        }}
    />
    <Button
        startIcon={<HiTrash />}
        variant="danger"
        size="small"
        style={{ margin: '20px 0 0 5px' }}
        onClick={() => {
            iceServer.urls.set([])
        }}
    />
        </div> :
        iceServer.urls?.map((url, index) => {
        return <div className="col-span-1 flex flex-row items-center" key={uuidv4()}>
            <Input
                label={t('admin:components.setting.webRTCSettings.iceURL')}
                value={url.value}
                onChange={(e) => {
                    iceServer.urls[index].set(e.target.value)
                }}
            />
            <Button
                startIcon={<HiTrash />}
                variant="danger"
                size="small"
                style={{ margin: '20px 0 0 5px' }}
                onClick={() => {
                    const urls = [...new Set(iceServer.urls.value)]
                    urls.splice(index, 1)
                    iceServer.urls.set(urls)
                }}
            />
        </div>
    })
}