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

/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: ['../**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  important: true, // important in prod is must be
  theme: {
    extend: {
      gradientColorStops: {
        ...Array.from({ length: 101 }, (_, i) => i).reduce((acc, curr) => {
          acc[curr] = `${curr}%`
          return acc
        }, {})
      },
      textColor: {
        theme: {
          input: 'var(--text-input)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          highlight: 'var(--text-highlight)',
          gray3: 'var(--text-gray3)',
          iconGreen: 'var(--icon-green)',
          iconRed: 'var(--icon-red)',
          'menu-default': 'var(--text-menu-default)'
        }
      },
      backgroundColor: {
        theme: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          highlight: 'var(--bg-highlight)',
          surfaceInput: 'var(--bg-surface-input)',
          'surrface-bg': 'var(--bg-surface-bg)',
          'surface-main': 'var(--bg-surface-main)',
          'surface-dropdown': 'var(--bg-surface-dropdown)',
          'surface-card': 'var(--bg-surface-card)',
          'table-secondary': 'var(--bg-table-secondary)',
          'blue-secondary': 'var(--bg-blue-secondary)',
          'studio-surface': 'var(--bg-studio-surface)',
          bannerInformative: 'var(--bg-banner-informative)',
          tagGreen: 'var(--bg-tag-green)',
          tagLime: 'var(--bg-tag-lime)',
          tagRed: 'var(--bg-tag-red)',
          tagYellow: 'var(--bg-tag-yellow)'
        }
      },
      borderColor: {
        theme: {
          primary: 'var(--border-primary)',
          input: 'var(--border-input)',
          focus: 'var(--border-focus)'
        }
      },
      colors: {
        'blue-primary': 'var(--blue-primary)'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        figtree: ['Figtree', 'sans-serif']
      }
    }
  },
  safelist: [
    ...Array.from({ length: 101 }, (_, i) => `via-[${i}%]`),
    ...Array.from({ length: 101 }, (_, i) => `to-[${i}%]`)
  ]
}
