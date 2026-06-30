import * as THREE from 'three';

export interface CardWorldStylizedPassOptions {
  pixelSize: number;
  colorLevels: number;
  ditherStrength: number;
  outlineStrength: number;
  outlineThreshold: number;
  normalStrength: number;
  normalThreshold: number;
  outlineColor: THREE.ColorRepresentation;
  shadowStrength: number;
  normalEdgeStrength: number;
  depthEdgeStrength: number;
  outlineInkStrength: number;
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  shadowLift: number;
}

/**
 * Bright Earthmover-style first pass for CardWorld with explicit output color encoding.
 *
 * This intentionally does NOT use normal/depth outlines yet.
 * Reason: the main game has many transparent sprite/label planes and flat slabs.
 * Feeding those through overrideMaterial normal/depth passes produces huge false
 * edge masks, which is what made F4 look globally dark/muddy.
 *
 * This pass does the safe part first:
 * - render scene at low resolution
 * - nearest-neighbor upscale
 * - mild Earthmover-style color grade
 *
 * After this matches the clean Earthmover brightness, outlines can be re-added
 * selectively for terrain-only objects.
 */
export class CardWorldStylizedPass {
  private colorTarget!: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private width = 1;
  private height = 1;
  private loggedFirstRender = false;
  private options: CardWorldStylizedPassOptions;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    options: Partial<CardWorldStylizedPassOptions> = {}
  ) {
    this.options = {
      pixelSize: 3,
      colorLevels: 0,
      ditherStrength: 0.0,
      outlineStrength: 0.0,
      outlineThreshold: 0.045,
      normalStrength: 0.0,
      normalThreshold: 0.16,
      outlineColor: 0x182238,
      shadowStrength: 0.0,
      normalEdgeStrength: 0.0,
      depthEdgeStrength: 0.0,
      outlineInkStrength: 0.0,
      brightness: 1.05,
      contrast: 1.05,
      saturation: 1.05,
      gamma: 1.0,
      shadowLift: 0.0,
      ...options
    };

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.createMaterial());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.resize(window.innerWidth, window.innerHeight);
  }

  setOptions(options: Partial<CardWorldStylizedPassOptions>): void {
    this.options = { ...this.options, ...options };
    const uniforms = this.quad.material.uniforms;
    uniforms.brightness.value = this.options.brightness;
    uniforms.contrast.value = this.options.contrast;
    uniforms.saturation.value = this.options.saturation;
    uniforms.gamma.value = this.options.gamma;
    uniforms.shadowLift.value = this.options.shadowLift;
    uniforms.colorLevels.value = this.options.colorLevels;
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const renderWidth = Math.max(1, Math.floor(this.width / this.options.pixelSize));
    const renderHeight = Math.max(1, Math.floor(this.height / this.options.pixelSize));

    this.colorTarget?.dispose();
    this.colorTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      depthBuffer: true,
      stencilBuffer: false
    });
    this.colorTarget.texture.magFilter = THREE.NearestFilter;
    this.colorTarget.texture.minFilter = THREE.NearestFilter;
    this.colorTarget.texture.generateMipmaps = false;
    this.colorTarget.texture.colorSpace = THREE.SRGBColorSpace;

    this.quad.material.uniforms.resolution.value.set(renderWidth, renderHeight, 1 / renderWidth, 1 / renderHeight);
  }

  render(): void {
    if (!this.loggedFirstRender) {
      this.loggedFirstRender = true;
      console.info('[CardWorld] Earthmover-style CardWorldStylizedPass v6 OUTPUT COLOR FIX rendering');
    }

    this.renderer.setRenderTarget(this.colorTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    const uniforms = this.quad.material.uniforms;
    uniforms.tDiffuse.value = this.colorTarget.texture;

    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.colorTarget?.dispose();
    this.quad.material.dispose();
    this.quad.geometry.dispose();
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
        brightness: { value: this.options.brightness },
        contrast: { value: this.options.contrast },
        saturation: { value: this.options.saturation },
        gamma: { value: this.options.gamma },
        shadowLift: { value: this.options.shadowLift },
        colorLevels: { value: this.options.colorLevels }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec4 resolution;
        uniform float brightness;
        uniform float contrast;
        uniform float saturation;
        uniform float gamma;
        uniform float shadowLift;
        uniform float colorLevels;
        varying vec2 vUv;

        vec3 gradeColor(vec3 color) {
          color *= brightness;
          color = (color - 0.5) * contrast + 0.5;
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          color = mix(vec3(luma), color, saturation);
          color += shadowLift;
          color = pow(clamp(color, 0.0, 1.0), vec3(gamma));
          return clamp(color, 0.0, 1.0);
        }

        vec3 optionalQuantize(vec3 color) {
          if (colorLevels <= 1.0) return color;
          return floor(clamp(color, 0.0, 1.0) * colorLevels + 0.5) / colorLevels;
        }

        void main() {
          vec2 iuv = (floor(resolution.xy * vUv) + 0.5) * resolution.zw;
          vec4 texel = texture2D(tDiffuse, iuv);
          vec3 color = optionalQuantize(gradeColor(texel.rgb));

          // This direct-to-screen ShaderMaterial does not go through Three.js OutputPass.
          // Without this encode step, the low-res render target is displayed too dark.
          color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

          gl_FragColor = vec4(color, texel.a);
        }
      `
    });
  }
}
