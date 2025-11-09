(() => {
  // src/utils/iconUtilsCore.js
  var isBareBase64 = (str) => {
    if (!str || typeof str !== "string") return false;
    if (str.startsWith("data:") || str.startsWith("http") || str.startsWith("/")) return false;
    const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
    const cleanStr = str.replace(/\s/g, "");
    return cleanStr.length > 20 && base64Pattern.test(cleanStr);
  };
  var normalizeBase64 = (icon) => {
    if (isBareBase64(icon)) {
      return `data:image/png;base64,${icon}`;
    }
    return icon;
  };
  var getAssetUrl = (path) => {
    if (!path || typeof path !== "string") return path;
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    if (path.startsWith("/")) {
      return path;
    }
    return path;
  };
  var normalizeIconSource = ({ icon, iconType }) => {
    if (!icon) {
      return { src: "\u{1F396}\uFE0F", isImage: false };
    }
    let normalizedIcon = normalizeBase64(icon);
    const isImageType = iconType === "image";
    const isUrl = typeof normalizedIcon === "string" && (normalizedIcon.startsWith("/") || normalizedIcon.startsWith("http") || normalizedIcon.startsWith("data:"));
    if (isImageType || isUrl) {
      return {
        src: getAssetUrl(normalizedIcon),
        isImage: true
      };
    }
    return {
      src: normalizedIcon,
      isImage: false
    };
  };
  var renderIconString = (icon, iconType, size = 48) => {
    const { src, isImage } = normalizeIconSource({ icon, iconType });
    if (isImage) {
      return `<img src="${src}" alt="Icon" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`;
    }
    return src;
  };

  // src/utils/legacyIconBridge.js
  window.LegacyIconUtils = {
    renderIconString,
    getAssetUrl
  };
})();
