/* One decoded video, one texture upload per video frame, one visible canvas.
 * Pointer-only redraws reuse the current texture. Crop, alpha and reveal happen
 * in the same shader; real/simulation never run on independent video clocks.
 */
window.createVideoRevealRenderer = (video, canvas) => {
  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false,
    depth: false, stencil: false, preserveDrawingBuffer: false,
  });
  let width = 1, height = 1, ratio = 1, dirty = true;
  const stats = { textureUploads: 0, draws: 0 };
  const resize = (w, h) => {
    width = Math.max(1, w);
    height = Math.max(1, h);
    ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2500000 / (width * height)));
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
  };
  if (!gl) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return null;
    canvas.dataset.videoRenderer = 'canvas2d';
    return {
      stats, resize, invalidate() { dirty = true; },
      render(scenes) {
        if (video.readyState < 2 || scenes.some((scene) => scene.mask)) return false;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        for (const scene of scenes) {
          const split = Number.isFinite(scene.splitPosition) ? Math.max(0, Math.min(1, scene.splitPosition)) : -1;
          const base = split >= 0 ? scene.real : scene.simulationBase ? scene.simulation : scene.real;
          const alternate = scene.simulationBase ? scene.real : scene.simulation;
          const [x, y, w, h] = scene.viewport;
          context.drawImage(video, ...base, x, y, w, h);
          if (split >= 0) {
            context.save();
            context.beginPath();
            context.rect(x + w * split, y, w * (1 - split), h);
            context.clip();
            context.drawImage(video, ...scene.simulation, x, y, w, h);
            context.restore();
            continue;
          }
          if (scene.revealing) {
            context.save();
            context.beginPath();
            if (scene.full) context.rect(x, y, w, h);
            else context.arc(x + scene.pointer[0], y + scene.pointer[1], scene.radius, 0, 2 * Math.PI);
            context.clip();
            context.drawImage(video, ...alternate, x, y, w, h);
            context.restore();
          }
        }
        dirty = false;
        stats.draws++;
        return true;
      },
    };
  }
  let available = true, textureWidth = 0, textureHeight = 0;
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); available = false; });
  const compile = (type, code) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Video reveal shader unavailable');
    return shader;
  };
  let program;
  try {
    program = gl.createProgram();
    const vertex = compile(gl.VERTEX_SHADER, `
      attribute vec2 position;
      varying vec2 local;
      void main() {
        local = vec2(position.x * .5 + .5, .5 - position.y * .5);
        gl_Position = vec4(position, 0., 1.);
      }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D frame;
      uniform vec2 videoSize, tileSize, pointer;
      uniform vec4 realRegion, simulationRegion, maskRegion;
      uniform float radius, revealing, full, simulationBase, overlayOpacity, splitPosition;
      varying vec2 local;
      vec3 sampleRegion(vec4 region) {
        vec2 pixel = region.xy + clamp(local * region.zw, vec2(.5), region.zw - .5);
        return texture2D(frame, vec2(pixel.x / videoSize.x, 1. - pixel.y / videoSize.y)).rgb;
      }
      vec4 simulationColor() {
        float alpha = maskRegion.z > 0. ? clamp((sampleRegion(maskRegion).r - .008) / .984, 0., 1.) : 1.;
        return vec4(sampleRegion(simulationRegion) * alpha, alpha);
      }
      void main() {
        if (splitPosition >= 0.) {
          gl_FragColor = local.x < splitPosition ? vec4(sampleRegion(realRegion), 1.) : simulationColor();
          return;
        }
        if (overlayOpacity >= 0.) {
          vec4 prediction = simulationColor();
          float opacity = clamp(overlayOpacity, 0., 1.);
          // Source-over: transparent prediction pixels leave the real image intact.
          gl_FragColor = vec4(sampleRegion(realRegion) * (1. - prediction.a * opacity)
                            + prediction.rgb * opacity, 1.);
          return;
        }
        float circle = 1. - smoothstep(radius - 3., radius, distance(local * tileSize, pointer));
        float reveal = revealing * mix(circle, 1., full);
        float simulation = mix(simulationBase, 1. - simulationBase, reveal);
        if (simulation < .001) gl_FragColor = vec4(sampleRegion(realRegion), 1.);
        else if (simulation > .999) gl_FragColor = simulationColor();
        else gl_FragColor = mix(vec4(sampleRegion(realRegion), 1.), simulationColor(), simulation);
      }
    `);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Video reveal program unavailable');
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  } catch (_) { return null; }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, 'frame'), 0);
  const uniforms = Object.fromEntries(['videoSize', 'tileSize', 'pointer', 'realRegion',
    'simulationRegion', 'maskRegion', 'radius', 'revealing', 'full', 'simulationBase', 'overlayOpacity', 'splitPosition']
    .map((name) => [name, gl.getUniformLocation(program, name)]));
  canvas.dataset.videoRenderer = 'webgl';
  return {
    stats, resize, invalidate() { dirty = true; },
    render(scenes) {
      if (!available || video.readyState < 2) return false;
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h || w > maxTextureSize || h > maxTextureSize) return false;
      try {
        if (dirty || textureWidth !== w || textureHeight !== h) {
          // Upload before drawing any tile, avoiding texture uploads between draw calls.
          if (textureWidth !== w || textureHeight !== h) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            textureWidth = w;
            textureHeight = h;
          }
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
          dirty = false;
          stats.textureUploads++;
        }
        gl.useProgram(program);
        gl.uniform2f(uniforms.videoSize, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (const scene of scenes) {
          const [x, y, tileWidth, tileHeight] = scene.viewport;
          const left = Math.round(x * ratio), right = Math.round((x + tileWidth) * ratio);
          const top = Math.round(y * ratio), bottom = Math.round((y + tileHeight) * ratio);
          gl.viewport(left, canvas.height - bottom, right - left, bottom - top);
          gl.uniform4fv(uniforms.realRegion, scene.real);
          gl.uniform4fv(uniforms.simulationRegion, scene.simulation);
          gl.uniform4fv(uniforms.maskRegion, scene.mask || [0, 0, 0, 0]);
          gl.uniform2f(uniforms.tileSize, tileWidth, tileHeight);
          gl.uniform2fv(uniforms.pointer, scene.pointer);
          gl.uniform1f(uniforms.radius, scene.radius);
          gl.uniform1f(uniforms.revealing, Number(scene.revealing));
          gl.uniform1f(uniforms.full, Number(scene.full));
          gl.uniform1f(uniforms.simulationBase, Number(scene.simulationBase));
          gl.uniform1f(uniforms.overlayOpacity, Number.isFinite(scene.overlayOpacity) ? scene.overlayOpacity : -1);
          gl.uniform1f(uniforms.splitPosition, Number.isFinite(scene.splitPosition) ? Math.max(0, Math.min(1, scene.splitPosition)) : -1);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        stats.draws++;
        return true;
      } catch (_) { available = false; return false; }
    },
  };
};
