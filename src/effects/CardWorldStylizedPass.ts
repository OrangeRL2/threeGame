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
}

/**
 * CardWorldStylizedPass
 *
 * A local direct-to-screen stylized renderer inspired by:
 * - depth + normal buffer outline rendering
 * - realtime 3D pixel-art render stacks using base/depth/normal passes
 *
 * This intentionally does NOT use EffectComposer or node_modules RenderPixelatedPass.
 * The stable direct renderer remains available in ThreeGame via F4 toggle.
 */
export class CardWorldStylizedPass {
  private colorTarget!: THREE.WebGLRenderTarget;
  private normalTarget!: THREE.WebGLRenderTarget;
  private depthTarget!: THREE.WebGLRenderTarget;
  private normalMaterial = new THREE.MeshNormalMaterial();
  private depthMaterial = new THREE.MeshDepthMaterial();
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private width = 1;
  private height = 1;
  private options: CardWorldStylizedPassOptions;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    options: Partial<CardWorldStylizedPassOptions> = {}
  ) {
    this.options = {
      pixelSize: 2,
      colorLevels: 6,
      ditherStrength: 0.08,
      outlineStrength: 10.0,
      outlineThreshold: 0.045,
      normalStrength: 1.35,
      normalThreshold: 0.16,
      outlineColor: 0x1a2238,
      shadowStrength: 0.12,
      ...options
    };

    this.depthMaterial.depthPacking = THREE.BasicDepthPacking;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.createMaterial());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.resize(window.innerWidth, window.innerHeight);
  }

  setOptions(options: Partial<CardWorldStylizedPassOptions>): void {
    this.options = { ...this.options, ...options };
    const uniforms = this.quad.material.uniforms;
    uniforms.colorLevels.value = this.options.colorLevels;
    uniforms.ditherStrength.value = this.options.ditherStrength;
    uniforms.outlineStrength.value = this.options.outlineStrength;
    uniforms.outlineThreshold.value = this.options.outlineThreshold;
    uniforms.normalStrength.value = this.options.normalStrength;
    uniforms.normalThreshold.value = this.options.normalThreshold;
    uniforms.outlineColor.value.set(this.options.outlineColor);
    uniforms.shadowStrength.value = this.options.shadowStrength;
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const renderWidth = Math.max(1, Math.floor(this.width / this.options.pixelSize));
    const renderHeight = Math.max(1, Math.floor(this.height / this.options.pixelSize));

    this.colorTarget?.dispose();
    this.normalTarget?.dispose();
    this.depthTarget?.dispose();

    this.colorTarget = this.createTarget(renderWidth, renderHeight, true);
    this.normalTarget = this.createTarget(renderWidth, renderHeight, false);
    this.depthTarget = this.createTarget(renderWidth, renderHeight, false);

    this.quad.material.uniforms.resolution.value.set(renderWidth, renderHeight, 1 / renderWidth, 1 / renderHeight);
  }

  render(): void {
    // 1) Beauty/color pass.
    this.renderer.setRenderTarget(this.colorTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 2) Normal pass.
    const oldOverride = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.normalMaterial;
    this.renderer.setRenderTarget(this.normalTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 3) Dedicated depth texture pass. This avoids depending on readBuffer/depthTexture composer behavior.
    this.scene.overrideMaterial = this.depthMaterial;
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = oldOverride;

    const uniforms = this.quad.material.uniforms;
    uniforms.tColor.value = this.colorTarget.texture;
    uniforms.tNormal.value = this.normalTarget.texture;
    uniforms.tDepth.value = this.depthTarget.texture;

    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.colorTarget?.dispose();
    this.normalTarget?.dispose();
    this.depthTarget?.dispose();
    this.normalMaterial.dispose();
    this.depthMaterial.dispose();
    this.quad.material.dispose();
    this.quad.geometry.dispose();
  }

  private createTarget(width: number, height: number, depthBuffer: boolean): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer,
      stencilBuffer: false
    });
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    return target;
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tNormal: { value: null },
        tDepth: { value: null },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
        colorLevels: { value: this.options.colorLevels },
        ditherStrength: { value: this.options.ditherStrength },
        outlineStrength: { value: this.options.outlineStrength },
        outlineThreshold: { value: this.options.outlineThreshold },
        normalStrength: { value: this.options.normalStrength },
        normalThreshold: { value: this.options.normalThreshold },
        outlineColor: { value: new THREE.Color(this.options.outlineColor) },
        shadowStrength: { value: this.options.shadowStrength }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor;
        uniform sampler2D tNormal;
        uniform sampler2D tDepth;
        uniform vec4 resolution;
        uniform float colorLevels;
        uniform float ditherStrength;
        uniform float outlineStrength;
        uniform float outlineThreshold;
        uniform float normalStrength;
        uniform float normalThreshold;
        uniform vec3 outlineColor;
        uniform float shadowStrength;
        varying vec2 vUv;

        float bayer4(vec2 p) {
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          if (i == 0) return 0.0 / 16.0;
          if (i == 1) return 8.0 / 16.0;
          if (i == 2) return 2.0 / 16.0;
          if (i == 3) return 10.0 / 16.0;
          if (i == 4) return 12.0 / 16.0;
          if (i == 5) return 4.0 / 16.0;
          if (i == 6) return 14.0 / 16.0;
          if (i == 7) return 6.0 / 16.0;
          if (i == 8) return 3.0 / 16.0;
          if (i == 9) return 11.0 / 16.0;
          if (i == 10) return 1.0 / 16.0;
          if (i == 11) return 9.0 / 16.0;
          if (i == 12) return 15.0 / 16.0;
          if (i == 13) return 7.0 / 16.0;
          if (i == 14) return 13.0 / 16.0;
          return 5.0 / 16.0;
        }

        float depthAt(int x, int y) {
          return texture2D(tDepth, vUv + vec2(float(x), float(y)) * resolution.zw).r;
        }

        vec3 normalAt(int x, int y) {
          return texture2D(tNormal, vUv + vec2(float(x), float(y)) * resolution.zw).rgb * 2.0 - 1.0;
        }

        float depthEdge() {
          float c = depthAt(0, 0);
          float d = 0.0;
          d += abs(c - depthAt(1, 0));
          d += abs(c - depthAt(-1, 0));
          d += abs(c - depthAt(0, 1));
          d += abs(c - depthAt(0, -1));
          d += abs(c - depthAt(1, 1)) * 0.5;
          d += abs(c - depthAt(-1, -1)) * 0.5;
          return smoothstep(outlineThreshold, outlineThreshold * 2.0, d * outlineStrength);
        }

        float normalEdge() {
          vec3 c = normalAt(0, 0);
          float n = 0.0;
          n += distance(c, normalAt(1, 0));
          n += distance(c, normalAt(-1, 0));
          n += distance(c, normalAt(0, 1));
          n += distance(c, normalAt(0, -1));
          return smoothstep(normalThreshold, normalThreshold * 2.0, n * normalStrength);
        }

        vec3 quantizeColor(vec3 color, float dither) {
          vec3 lifted = pow(max(color, vec3(0.0)), vec3(0.92));
          lifted += (dither - 0.5) * ditherStrength;
          return floor(clamp(lifted, 0.0, 1.0) * colorLevels + 0.5) / colorLevels;
        }

        void main() {
          vec4 source = texture2D(tColor, vUv);
          vec3 normal = normalAt(0, 0);
          float dither = bayer4(gl_FragCoord.xy);

          // Small normal-based value shaping: enough to read faces, not enough to become neon.
          float viewFacing = clamp(normal.z * 0.5 + 0.5, 0.0, 1.0);
          float band = floor(viewFacing * 3.0) / 3.0;
          vec3 color = source.rgb * (1.0 - shadowStrength + band * shadowStrength);
          color = quantizeColor(color, dither);

          float edge = clamp(max(depthEdge(), normalEdge() * 0.75), 0.0, 1.0);
          vec3 outlined = mix(color, outlineColor, edge * 0.72);
          gl_FragColor = vec4(outlined, source.a);
        }
      `
    });
  }
}
