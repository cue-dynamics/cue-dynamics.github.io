/* Decode a single color + alpha MP4 onto a transparent canvas.
 * Both planes share the same video frame and the existing comparison clock.
 */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('video[data-alpha-packed]').forEach((video) => {
    const parent = video.parentElement;
    const poster = document.createElement('img');
    poster.className = 'lab-alpha-poster';
    poster.alt = '';
    poster.setAttribute('aria-hidden', 'true');
    poster.src = video.poster;
    const canvas = document.createElement('canvas');
    canvas.className = 'lab-alpha-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    video.after(poster, canvas);
    parent.classList.add('has-alpha-video');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return; // A transparent still remains if GPU compositing is unavailable.

    const shader = (type, source) => {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Video shader unavailable');
      return result;
    };
    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, `
        attribute vec2 position;
        varying vec2 uv;
        void main() {
          uv = position * .5 + .5;
          gl_Position = vec4(position, 0., 1.);
        }
      `));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        uniform sampler2D frame;
        uniform vec2 texel;
        varying vec2 uv;
        void main() {
          // Stay inside each half, including at the outermost filtered pixel.
          vec2 colorUV = vec2(clamp(uv.x * .5, texel.x * .5, .5 - texel.x * .5), uv.y);
          vec3 color = texture2D(frame, colorUV).rgb;
          float alpha = texture2D(frame, colorUV + vec2(.5, 0.)).r;
          // H264 can leave one or two levels in transparent areas.
          alpha = clamp((alpha - .008) / .984, 0., 1.);
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Video program unavailable');
    } catch (_) {
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
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
    const texel = gl.getUniformLocation(program, 'texel');
    let inView = true;
    let available = true;
    let raf = 0;
    const clear = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      parent.classList.remove('has-alpha-frame');
    };
    const draw = () => {
      if (!available || !inView || video.readyState < 2 || gl.isContextLost()) return;
      const width = video.videoWidth / 2;
      const height = video.videoHeight;
      if (!width || !height) return;
      if (video.videoWidth > gl.getParameter(gl.MAX_TEXTURE_SIZE)) { available = false; clear(); return; }
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(texel, 1 / video.videoWidth, 1 / height);
      }
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        parent.classList.add('has-alpha-frame');
      } catch (_) {
        clear();
      }
    };
    const tick = () => {
      draw();
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(tick);
      else if (!video.paused) raf = requestAnimationFrame(tick);
    };
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(tick);
    else video.addEventListener('play', () => { cancelAnimationFrame(raf); tick(); });
    video.addEventListener('loadeddata', draw);
    video.addEventListener('seeked', draw);
    video.addEventListener('emptied', clear);
    video.addEventListener('error', clear);
    canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); available = false; clear(); });
    new MutationObserver(() => { poster.src = video.poster; }).observe(video, { attributes: true, attributeFilter: ['poster'] });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) draw(); }).observe(parent);
    }
    draw();
  });
});
