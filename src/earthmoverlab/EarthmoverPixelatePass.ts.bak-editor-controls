import * as THREE from 'three';
import { WebGLRenderer, WebGLRenderTarget } from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export class EarthmoverPixelatePass extends Pass {
  fsQuad: FullScreenQuad;
  resolution: THREE.Vector2;

  constructor(resolution: THREE.Vector2) {
    super();
    this.resolution = resolution;
    this.fsQuad = new FullScreenQuad(this.material());
  }

  setResolution(resolution: THREE.Vector2): void {
    this.resolution.copy(resolution);
    const uniforms = (this.fsQuad.material as THREE.ShaderMaterial).uniforms;
    uniforms.resolution.value.set(resolution.x, resolution.y, 1 / resolution.x, 1 / resolution.y);
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    const uniforms = (this.fsQuad.material as THREE.ShaderMaterial).uniforms;
    uniforms.tDiffuse.value = readBuffer.texture;
    if (this.renderToScreen) renderer.setRenderTarget(null);
    else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.fsQuad.render(renderer);
  }

  material(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector4(this.resolution.x, this.resolution.y, 1 / this.resolution.x, 1 / this.resolution.y) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec4 resolution;
        varying vec2 vUv;
        void main() {
          vec2 iuv = (floor(resolution.xy * vUv) + 0.5) * resolution.zw;
          gl_FragColor = texture2D(tDiffuse, iuv);
        }
      `
    });
  }
}
