import * as THREE from 'three';

export interface CardWorldPixelPassOptions {
  pixelSize: number;
  normalEdgeCoefficient: number;
  depthEdgeCoefficient: number;
}

/**
 * Local pixel shader pass based on pixel-shader-source-bundle.txt.
 * Renders directly to screen and does not use EffectComposer or node_modules RenderPixelatedPass.
 */
export class CardWorldPixelPass {
  private colorTarget!: THREE.WebGLRenderTarget;
  private normalTarget!: THREE.WebGLRenderTarget;
  private normalMaterial = new THREE.MeshNormalMaterial();
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private width = 1;
  private height = 1;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private options: CardWorldPixelPassOptions
  ) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.createMaterial());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.resize(window.innerWidth, window.innerHeight);
  }

  setOptions(options: Partial<CardWorldPixelPassOptions>): void {
    this.options = { ...this.options, ...options };
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const renderWidth = Math.max(1, Math.floor(this.width / this.options.pixelSize));
    const renderHeight = Math.max(1, Math.floor(this.height / this.options.pixelSize));

    this.colorTarget?.dispose();
    this.normalTarget?.dispose();

    this.colorTarget = this.createRenderTarget(renderWidth, renderHeight, true);
    this.normalTarget = this.createRenderTarget(renderWidth, renderHeight, false);

    const uniforms = this.quad.material.uniforms;
    uniforms.resolution.value.set(renderWidth, renderHeight, 1 / renderWidth, 1 / renderHeight);
  }

  render(): void {
    const uniforms = this.quad.material.uniforms;
    uniforms.normalEdgeCoefficient.value = this.options.normalEdgeCoefficient;
    uniforms.depthEdgeCoefficient.value = this.options.depthEdgeCoefficient;

    this.renderer.setRenderTarget(this.colorTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    const oldOverrideMaterial = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.normalMaterial;
    this.renderer.setRenderTarget(this.normalTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = oldOverrideMaterial;

    uniforms.tDiffuse.value = this.colorTarget.texture;
    uniforms.tDepth.value = this.colorTarget.depthTexture;
    uniforms.tNormal.value = this.normalTarget.texture;

    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.colorTarget?.dispose();
    this.normalTarget?.dispose();
    this.normalMaterial.dispose();
    this.quad.material.dispose();
    this.quad.geometry.dispose();
  }

  private createRenderTarget(width: number, height: number, withDepth: boolean): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: withDepth,
      stencilBuffer: false
    });
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    if (withDepth) target.depthTexture = new THREE.DepthTexture(width, height);
    return target;
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
        normalEdgeCoefficient: { value: this.options.normalEdgeCoefficient },
        depthEdgeCoefficient: { value: this.options.depthEdgeCoefficient }
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
        uniform sampler2D tDepth;
        uniform sampler2D tNormal;
        uniform vec4 resolution;
        uniform float normalEdgeCoefficient;
        uniform float depthEdgeCoefficient;
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
          return floor(smoothstep(0.01, 0.02, diff) * 2.0) / 2.0;
        }

        float normalEdgeIndicator() {
          float depth = getDepth(0, 0);
          vec3 normal = getNormal(0, 0);
          float indicator = 0.0;
          indicator += neighborNormalEdgeIndicator(0, -1, depth, normal);
          indicator += neighborNormalEdgeIndicator(0, 1, depth, normal);
          indicator += neighborNormalEdgeIndicator(-1, 0, depth, normal);
          indicator += neighborNormalEdgeIndicator(1, 0, depth, normal);
          return step(0.1, indicator);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          float dei = depthEdgeIndicator();
          float nei = normalEdgeIndicator();
          float coefficient = dei > 0.0
            ? (1.0 - depthEdgeCoefficient * dei)
            : (1.0 + normalEdgeCoefficient * nei);
          gl_FragColor = texel * coefficient;
        }
      `
    });
  }
}
