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

import assert from 'assert'

import { ShaderChunk } from 'three'
import { FogShaders, initBrownianMotionFogShader, initHeightFogShader, removeFogShader } from './FogShaders'

describe('FogShaders', () => {
  describe('removeFogShader', () => {
    it('should set ShaderChunk.fog_pars_fragment to the default fog_pars_fragment shader', () => {
      assert.equal(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.default)
      initHeightFogShader()
      assert.notEqual(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.default)
      removeFogShader()
      assert.equal(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.default)
    })

    it('should set ShaderChunk.fog_pars_vertex to the default fog_pars_vertex shader', () => {
      assert.equal(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.default)
      initHeightFogShader()
      assert.notEqual(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.default)
      removeFogShader()
      assert.equal(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.default)
    })

    it('should set ShaderChunk.fog_fragment to the default fog_fragment shader', () => {
      assert.equal(ShaderChunk.fog_fragment, FogShaders.fog_fragment.default)
      initHeightFogShader()
      assert.notEqual(ShaderChunk.fog_fragment, FogShaders.fog_fragment.default)
      removeFogShader()
      assert.equal(ShaderChunk.fog_fragment, FogShaders.fog_fragment.default)
    })

    it('should set ShaderChunk.fog_vertex to the default fog_vertex shader', () => {
      assert.equal(ShaderChunk.fog_vertex, FogShaders.fog_vertex.default)
      initHeightFogShader()
      assert.notEqual(ShaderChunk.fog_vertex, FogShaders.fog_vertex.default)
      removeFogShader()
      assert.equal(ShaderChunk.fog_vertex, FogShaders.fog_vertex.default)
    })
  })

  describe('initBrownianMotionFogShader', () => {
    afterEach(() => {
      removeFogShader()
    })

    it('should initialize ShaderChunk.fog_pars_vertex with the brownianMotionFog pars vertex shader', () => {
      assert.notEqual(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.brownianMotionFog)
      initBrownianMotionFogShader()
      assert.equal(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.brownianMotionFog)
    })

    it('should initialize ShaderChunk.fog_vertex with the brownianMotionFog vertex shader', () => {
      assert.notEqual(ShaderChunk.fog_vertex, FogShaders.fog_vertex.brownianMotionFog)
      initBrownianMotionFogShader()
      assert.equal(ShaderChunk.fog_vertex, FogShaders.fog_vertex.brownianMotionFog)
    })

    it('should initialize ShaderChunk.fog_pars_fragment with the brownianMotionFog pars fragment shader', () => {
      assert.notEqual(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.brownianMotionFog)
      initBrownianMotionFogShader()
      assert.equal(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.brownianMotionFog)
    })

    it('should initialize ShaderChunk.fog_fragment with the brownianMotionFog fragment shader', () => {
      assert.notEqual(ShaderChunk.fog_fragment, FogShaders.fog_fragment.brownianMotionFog)
      initBrownianMotionFogShader()
      assert.equal(ShaderChunk.fog_fragment, FogShaders.fog_fragment.brownianMotionFog)
    })
  })

  describe('initHeightFogShader', () => {
    afterEach(() => {
      removeFogShader()
    })

    it('should initialize ShaderChunk.fog_pars_vertex with the heightFog pars vertex shader', () => {
      assert.notEqual(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.heightFog)
      initHeightFogShader()
      assert.equal(ShaderChunk.fog_pars_vertex, FogShaders.fog_pars_vertex.heightFog)
    })

    it('should initialize ShaderChunk.fog_vertex with the heightFog vertex shader', () => {
      assert.notEqual(ShaderChunk.fog_vertex, FogShaders.fog_vertex.heightFog)
      initHeightFogShader()
      assert.equal(ShaderChunk.fog_vertex, FogShaders.fog_vertex.heightFog)
    })

    it('should initialize ShaderChunk.fog_pars_fragment with the heightFog pars fragment shader', () => {
      assert.notEqual(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.heightFog)
      initHeightFogShader()
      assert.equal(ShaderChunk.fog_pars_fragment, FogShaders.fog_pars_fragment.heightFog)
    })

    it('should initialize ShaderChunk.fog_fragment with the heightFog fragment shader', () => {
      assert.notEqual(ShaderChunk.fog_fragment, FogShaders.fog_fragment.heightFog)
      initHeightFogShader()
      assert.equal(ShaderChunk.fog_fragment, FogShaders.fog_fragment.heightFog)
    })
  })
})
