document.addEventListener("DOMContentLoaded", () => {

	// Settings button toggle
  const asciiToggle = document.getElementById('ascii-ctl-toggle');
  asciiToggle.addEventListener('click', (event) => {
    event.preventDefault();
    const expanded = document.body.classList.toggle('ascii-settings-open');
    asciiToggle.setAttribute('aria-expanded', String(expanded));
	});
  
  
    const el = (id) => document.getElementById(id);

    const cell = el("asciiCellSize");
    const cellOut = el("asciiCellSizeOut");

    const glyph = el("asciiGlyphOpacity");
    const glyphOut = el("asciiGlyphOpacityOut");

    const tile = el("asciiTileOpacity");
    const tileOut = el("asciiTileOpacityOut");

    function withManager(fn) {
      const mgr = window.ASCIIRendererManagerSingleton;
      if (mgr && Array.isArray(mgr.renderers)) fn(mgr);
    }

    function applyAll(patch, { refresh = false, uniforms = false } = {}) {
      withManager((mgr) => {
        for (const r of mgr.renderers) {
          Object.assign(r.config, patch);
          if (uniforms && typeof r.pushUniforms === "function") r.pushUniforms();
          if (refresh && typeof r.forceRefresh === "function") r.forceRefresh();
          // draw without uploading video texture
          if (typeof r.drawFrame === "function") r.drawFrame(false);
        }
      });
    }

    // Initialize slider values from the first renderer once available
    function syncInitial() {
      const mgr = window.ASCIIRendererManagerSingleton;
      if (!mgr?.renderers?.length) return false;
      const r = mgr.renderers[0];
      cell.value = Math.round(r.config.cellSizePx ?? 12);
      cellOut.textContent = cell.value;

      glyph.value = Math.round((r.config.glyphOpacity ?? 1) * 100);
      glyphOut.textContent = glyph.value;

      tile.value = Math.round((r.config.tileOpacity ?? 0.5) * 100);
      tileOut.textContent = tile.value;
      return true;
    }

    if (!syncInitial()) {
      let tries = 0;
      const id = setInterval(() => {
        if (syncInitial() || ++tries > 50) clearInterval(id); // ~5s max
      }, 100);
    }

    // Listeners
    cell.addEventListener("input", () => {
      const v = Number(cell.value);
      cellOut.textContent = v;
      applyAll({ cellSizePx: v }, { refresh: true, uniforms: true });
    }, { passive: true });

    glyph.addEventListener("input", () => {
      const v = Number(glyph.value);
      glyphOut.textContent = v;
      applyAll({ glyphOpacity: v / 100 }, { uniforms: true });
    }, { passive: true });

    tile.addEventListener("input", () => {
      const v = Number(tile.value);
      tileOut.textContent = v;
      applyAll({ tileOpacity: v / 100 }, { uniforms: true });
    }, { passive: true });
  });
