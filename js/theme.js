(function() {

    function darkenHex(hex, factor) {
      hex = hex.replace("#", "");
      if (hex.length === 3) { hex = hex.split("").map(c => c + c).join(""); }
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      r = Math.max(0, Math.floor(r * (1 - factor)));
      g = Math.max(0, Math.floor(g * (1 - factor)));
      b = Math.max(0, Math.floor(b * (1 - factor)));
      return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    }

    function lightenHex(hex, factor) {
      hex = hex.replace("#", "");
      if (hex.length === 3) { hex = hex.split("").map(c => c + c).join(""); }
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      r = Math.min(255, Math.floor(r + (255 - r) * factor));
      g = Math.min(255, Math.floor(g + (255 - g) * factor));
      b = Math.min(255, Math.floor(b + (255 - b) * factor));
      return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    }

    let theme = {
      primary: "#7100e3"
    };
    theme.primaryDark = darkenHex(theme.primary, 0.15);
    theme.secondary = lightenHex(theme.primary, 0.15);

    let currentBlobUrls = {
      gradient: null,
      output: null
    };

    function updateCSSVariables() {
      document.documentElement.style.setProperty("--primary", theme.primary);
      document.documentElement.style.setProperty("--primary-dark", theme.primaryDark);
      document.documentElement.style.setProperty("--secondary", theme.secondary);

    }

    async function updateSVGBackground(variableName, filePath, colorMap, oldBlobUrl) {
        try {

            if (oldBlobUrl) {
                URL.revokeObjectURL(oldBlobUrl);
            }

            const response = await fetch(filePath + '?v=' + Date.now());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
            }
            let svgText = await response.text();

            for (const [origColor, newColor] of Object.entries(colorMap)) {

                const regex = new RegExp(origColor.replace('#', '\\#'), "gi");
                svgText = svgText.replace(regex, newColor);
            }

            const blob = new Blob([svgText], { type: "image/svg+xml" });
            const newBlobUrl = URL.createObjectURL(blob);

            document.documentElement.style.setProperty(variableName, `url(${newBlobUrl})`);

            return newBlobUrl;

        } catch (e) {
            console.error("Error updating SVG background for variable:", variableName, filePath, e);

            return oldBlobUrl;
        }
    }

    async function updateSVGs() {

      let colorMapOutput = {
        "#7192e3": theme.secondary,
        "#5a74b5": theme.primary,
        "#435788": theme.primaryDark,
        "#2d3a5a": darkenHex(theme.primaryDark, 0.1),
        "#161d2d": darkenHex(theme.primaryDark, 0.2),

      };

      let colorMapGradient = {
        "#1d2a3e": theme.primaryDark

      };

      currentBlobUrls.output = await updateSVGBackground('--output-svg-url', 'images/output.svg', colorMapOutput, currentBlobUrls.output);
      currentBlobUrls.gradient = await updateSVGBackground('--gradient-svg-url', 'images/gradient.svg', colorMapGradient, currentBlobUrls.gradient);
    }

    async function initTheme(newPrimary) {
      if (newPrimary) {
        theme.primary = newPrimary;
        theme.primaryDark = darkenHex(newPrimary, 0.15);
        theme.secondary = lightenHex(newPrimary, 0.15);
      } else {

        theme.primary = theme.primary || "##7192e3";
        theme.primaryDark = theme.primaryDark || darkenHex(theme.primary, 0.15);
        theme.secondary = theme.secondary || lightenHex(theme.primary, 0.15);
      }

      updateCSSVariables();

      await updateSVGs();
    }

    window.initTheme = initTheme;

    document.addEventListener('DOMContentLoaded', () => {

        initTheme();
    });

  })();
