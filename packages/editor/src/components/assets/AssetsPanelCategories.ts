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

import { defineState } from '@etherealengine/hyperflux'

export const AssetsPanelCategories = defineState({
  name: 'AssetsPanelCategories',
  initial: {
    'Default Prefab': {},

    Model: {
      // NPC: {},
      // Avatar: {},
      // Animal: {},
      Template: {
        // Backdrop: {},
        // Stage: {}
      },
      Architectural: {
        Floor: {},
        Ceiling: {},
        Wall: {}
      },
      // 'Basic Shape': {
      //   Artistic: {},
      //   Primitive: {
      //     'Platonic Solid': {},
      //     Fractal: {}
      //   }
      // },
      Kit: {
        Gothic: {},
        Cottage: {},
        Scifi: {},
        Modern: {},

        Ecommerce: {}
      },
      Prop: {
        // Furniture: {
        //   Chairs: {},
        //   Showcase: {},
        //   Displays: {}
        // }
      },
      Nature: {}
      // Terrain: {}
    },
    Material: {
      // Standard: {
      //   Plastic: {},
      //   Glass: {},
      //   'Rough glass': {},
      //   Metal: {},
      //   Glow: {},
      //   Rubber: {},
      //   Water: {},
      //   Bubble: {},
      //   Diamond: {},
      //   Clay: {},
      //   'Car Paint': {},
      //   Wood: {},
      //   Stone: {},
      //   Dirt: {},
      //   Grass: {},
      //   Cloth: {},
      //   Bark: {},
      //   Snow: {}
      // },
      // Advanced: {
      //   Static: {},
      //   Animated: {}
      // }
    },
    Image: {
      // Background: {},
      // Texture: {
      //   Diffuse: {},
      //   'Normal Maps': {},
      //   Occlusion: {},
      //   Metalness: {},
      //   Roughness: {}
      // },
      // Tiling: {
      //   Diffuse: {},
      //   'Normal Map': {},
      //   Occlusion: {},
      //   Metalness: {},
      //   Roughness: {}
      // },
      // Sprite: {}
    },
    // Light: {},
    Video: {},
    Audio: {
      // Music: {},
      // 'Sound FX': {}
    },
    Particle: {
      // Smoke: {},
      // Fire: {},
      // Lightning: {},
      // Portal: {},
      // Sparkle: {}
    },
    Skybox: {
      // 'Time of Day': {
      //   Morning: {},
      //   Noon: {},
      //   Evening: {},
      //   Night: {}
      // },
      // Abstract: {},
      // 'Low Contrast': {},
      // 'High Contrast': {}
    },
    'Post Processing': {
      // Fog: {},
      // Cinematic: {}
    }
    // Agent: {},
    // Genre: {
    //   Office: {},
    //   Gothic: {},
    //   Scifi: {},
    //   Cottage: {},
    //   Modern: {},
    //   Luxury: {},
    //   Noir: {},
    //   Nature: {
    //     Jungle: {},
    //     Arctic: {},
    //     Boreal: {},
    //     Desert: {}
    //   },
    //   Holiday: {
    //     Passover: {},
    //     'St Patrick’s Day': {},
    //     'Yam Kippur': {},
    //     'Veteran’s Day': {}
    //   },
    //   Abstract: {},
    //   Fantasy: {}
    // }
  } as object
})
