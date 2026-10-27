document.addEventListener('DOMContentLoaded', () => {
     new ASCIILoader({
      preloadPolicy: 'meta', // or 'none'
      dprCap: 2,
      cellSizePx: 10
    });
});
