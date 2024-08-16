import Input from "@etherealengine/ui/src/primitives/tailwind/Input";
import Button from "@etherealengine/ui/src/primitives/tailwind/Button";
import React from "react";
import { useTranslation } from 'react-i18next'
import { HiTrash } from 'react-icons/hi2'

export const URLItem = ({
    iceServer
}) => {
    const { t } = useTranslation()

    return typeof iceServer.urls.value === 'string' ? <> <Input
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
        fullWidth
        onClick={() => {
            iceServer.urls.set([])
        }}
    />
        </> :
        iceServer.urls?.map((url, index) => {
        return <>
            <Input
                className="col-span-1"
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
                fullWidth
                onClick={() => {
                    const urls = iceServer.urls.value
                    urls.splice(index, 1)
                    iceServer.urls.set(urls)
                }}
            />
        </>
    })
}