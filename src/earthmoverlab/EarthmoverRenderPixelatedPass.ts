import * as THREE from 'three';
import { WebGLRenderer, WebGLRenderTarget } from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export interface EarthmoverPixelUniforms {
  normalEdgeStrength: number;
  depthEdgeStrength: number;
  outlineInkStrength: number;
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  shadowLift: number;
}

export class EarthmoverRenderPixelatedPass extends Pass {
  fsQuad: FullScreenQuad;
  resolution: THREE.Vector2;
  scene: THREE.Scene;
  camera: THREE.Camera;
  rgbRenderTarget: WebGLRenderTarget;
  normalRenderTarget: WebGLRenderTarget;
  normalMaterial: THREE.Material;

  constructor(resolution: THREE.Vector2, scene: THREE.Scene, camera: THREE.Camera) {
    super();
    this.resolution = resolution;
    this.fsQuad = new FullScreenQuad(this.material());
    this.scene = scene;
    this.camera = camera;
    this.rgbRenderTarget = this.pixelRenderTarget(resolution, THREE.RGBAFormat, true);
    this.normalRenderTarget = this.pixelRenderTarget(resolution, THREE.RGBAFormat, false);
    this.normalMaterial = new THREE.MeshNormalMaterial();
  }

  setUniforms(values: Partial<EarthmoverPixelUniforms>): void {
    const uniforms = (this.fsQuad.material as THREE.ShaderMaterial).uniforms;
    if (values.normalEdgeStrength !== undefined) uniforms.normalEdgeStrength.value = values.normalEdgeStrength;
    if (values.depthEdgeStrength !== undefined) uniforms.depthEdgeStrength.value = values.depthEdgeStrength;
    if (values.outlineInkStrength !== undefined) uniforms.outlineInkStrength.value = values.outlineInkStrength;
    if (values.brightness !== undefined) uniforms.brightness.value = values.brightness;
    if (values.contrast !== undefined) uniforms.contrast.value = values.contrast;
    if (values.saturation !== undefined) uniforms.saturation.value = values.saturation;
    if (values.gamma !== undefined) uniforms.gamma.value = values.gamma;
    if (values.shadowLift !== undefined) uniforms.shadowLift.value = values.shadowLift;
  }

  setResolution(resolution: THREE.Vector2): void {
    this.resolution.copy(resolution);
    this.rgbRenderTarget.setSize(resolution.x, resolution.y);
    this.normalRenderTarget.setSize(resolution.x, resolution.y);
    if (this.rgbRenderTarget.depthTexture) this.rgbRenderTarget.depthTexture.dispose();
    this.rgbRenderTarget.depthTexture = new THREE.DepthTexture(resolution.x, resolution.y);
    const uniforms = (this.fsQuad.material as THREE.ShaderMaterial).uniforms;
    uniforms.resolution.value.set(resolution.x, resolution.y, 1 / resolution.x, 1 / resolution.y);
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget): void {
    renderer.setRenderTarget(this.rgbRenderTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    const oldOverride = this.scene.overrideMaterial;
    renderer.setRenderTarget(this.normalRenderTarget);
    renderer.clear();
    this.scene.overrideMaterial = this.normalMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = oldOverride;

    const uniforms = (this.fsQuad.material as THREE.ShaderMaterial).uniforms;
    uniforms.tDiffuse.value = this.rgbRenderTarget.texture;
    uniforms.tDepth.value = this.rgbRenderTarget.depthTexture;
    uniforms.tNormal.value = this.normalRenderTarget.texture;

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
        tDepth: { value: null },
        tNormal: { value: null },
        resolution: { value: new THREE.Vector4(this.resolution.x, this.resolution.y, 1 / this.resolution.x, 1 / this.resolution.y) },
        normalEdgeStrength: { value: 0.65 },
        depthEdgeStrength: { value: 1.15 },
        outlineInkStrength: { value: 0.92 },
        brightness: { value: 1.0 },
        contrast: { value: 1.45 },
        saturation: { value: 1.35 },
        gamma: { value: 0.90 },
        shadowLift: { value: -0.08 }
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
        uniform sampler2D tDepth;
        uniform sampler2D tNormal;
        uniform vec4 resolution;
        uniform float normalEdgeStrength;
        uniform float depthEdgeStrength;
        uniform float outlineInkStrength;
        uniform float brightness;
        uniform float contrast;
        uniform float saturation;
        uniform float gamma;
        uniform float shadowLift;
        varying vec2 vUv;

        float getDepth(int x, int y) {
          return texture2D(tDepth, vUv + vec2(x, y) * resolution.zw).r;
        }
        vec3 getNormal(int x, int y) {
          return texture2D(tNormal, vUv + vec2(x, y) * resolution.zw).rgb * 2.0 - 1.0;
        }
        float neighborNormalEdgeIndicator(int x, int y, float depth, vec3 normal) {
          float depthDiff = getDepth(x, y) - depth;
          vec3 normalEdgeBias = vec3(1.0, 1.0, 1.0);
          float normalDiff = dot(normal - getNormal(x, y), normalEdgeBias);
          float normalIndicator = clamp(smoothstep(-0.01, 0.01, normalDiff), 0.0, 1.0);
          float depthIndicator = clamp(sign(depthDiff * 0.25 + 0.0025), 0.0, 1.0);
          return distance(normal, getNormal(x, y)) * depthIndicator * normalIndicator;
        }
        float depthEdgeIndicator() {
          float depth = getDepth(0, 0);
          float diff = 0.0;
          diff += clamp(getDepth(1, 0) - depth, 0.0, 1.0);
          diff += clamp(getDepth(-1, 0) - depth, 0.0, 1.0);
          diff += clamp(getDepth(0, 1) - depth, 0.0, 1.0);
          diff += clamp(getDepth(0, -1) - depth, 0.0, 1.0);
          return floor(smoothstep(0.01, 0.02, diff * depthEdgeStrength) * 2.0) / 2.0;
        }
        float normalEdgeIndicator() {
          float depth = getDepth(0, 0);
          vec3 normal = getNormal(0, 0);
          float indicator = 0.0;
          indicator += neighborNormalEdgeIndicator(0, -1, depth, normal);
          indicator += neighborNormalEdgeIndicator(0, 1, depth, normal);
          indicator += neighborNormalEdgeIndicator(-1, 0, depth, normal);
          indicator += neighborNormalEdgeIndicator(1, 0, depth, normal);
          return step(0.1, indicator * normalEdgeStrength);
        }
        vec3 gradeColor(vec3 color) {
          color *= brightness;
          color = (color - 0.5) * contrast + 0.5;
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          color = mix(vec3(luma), color, saturation);
          color += shadowLift;
          color = pow(clamp(color, 0.0, 1.0), vec3(gamma));
          return clamp(color, 0.0, 1.0);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          float dei = depthEdgeIndicator();
          float nei = normalEdgeIndicator();

          float silhouette = step(0.25, dei);
          float crease = step(0.5, nei) * (1.0 - silhouette);
          float ink = clamp(silhouette + crease * 0.55, 0.0, 1.0);

          vec3 outlineColor = vec3(0.025, 0.032, 0.052);
          vec3 highlightColor = vec3(1.08, 1.06, 0.98);

          vec3 color = gradeColor(texel.rgb);
          color = mix(color, color * highlightColor, crease * 0.18);
          color = mix(color, outlineColor, ink * outlineInkStrength);

          gl_FragColor = vec4(color, texel.a);
        }
      `
    });
  }

  pixelRenderTarget(resolution: THREE.Vector2, format: THREE.PixelFormat, depthTexture: boolean): WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(
      resolution.x,
      resolution.y,
      !depthTexture ? undefined : { depthTexture: new THREE.DepthTexture(resolution.x, resolution.y), depthBuffer: true }
    );
    target.texture.format = format;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.stencilBuffer = false;
    return target;
  }
}
