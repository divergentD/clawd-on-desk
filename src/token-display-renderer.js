"use strict";

(function() {
  const tokenValue = document.getElementById("tokenValue");
  const tokenBadge = document.getElementById("tokenBadge");
  const modelRows = document.getElementById("modelRows");
  const MODEL_COLORS = ["#FF6B6B", "#4D96FF", "#6BCB77", "#B983FF"];

  let currentTotal = 0;
  let animating = false;
  let pendingTotal = null;
  let lastRows = [];

  const darkScheme = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function isDarkTheme() {
    return !!(darkScheme && darkScheme.matches);
  }

  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return String(num);
  }

  function springEasing(t) {
    const tension = 120;
    const friction = 14;
    const omega = Math.sqrt(tension);
    const zeta = friction / (2 * Math.sqrt(tension));
    const dampedOmega = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) *
           (Math.cos(dampedOmega * t) + (zeta * omega / dampedOmega) * Math.sin(dampedOmega * t));
  }

  function animateCountUp(targetValue, duration) {
    if (animating) {
      pendingTotal = targetValue;
      return;
    }
    animating = true;

    const startValue = currentTotal;
    const delta = targetValue - startValue;
    const startTime = performance.now();

    if (Math.abs(delta) < 1) {
      currentTotal = targetValue;
      tokenValue.textContent = formatNumber(currentTotal);
      animating = false;
      flushPendingUpdate(duration);
      return;
    }

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = springEasing(progress);

      currentTotal = startValue + delta * eased;
      tokenValue.textContent = formatNumber(Math.round(currentTotal));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        currentTotal = targetValue;
        tokenValue.textContent = formatNumber(currentTotal);
        animating = false;

        if (Math.abs(delta) >= 100) {
          tokenBadge.style.transform = "scale(1.15)";
          setTimeout(() => {
            tokenBadge.style.transform = "scale(1)";
          }, 200);
        }
        flushPendingUpdate(duration);
      }
    }

    requestAnimationFrame(step);
  }

  function flushPendingUpdate(duration) {
    const nextTotal = pendingTotal;
    pendingTotal = null;
    if (nextTotal !== null && nextTotal !== currentTotal) {
      animateCountUp(nextTotal, duration);
    }
  }

  function handleSnapshot(data) {
    if (!data || !Array.isArray(data.sessions)) return;
    const { totalTokens, rows } = window.tokenDisplayModels.groupTokenUsage(data.sessions);
    lastRows = rows;
    renderModelRows(rows);
    if (totalTokens !== currentTotal) {
      animateCountUp(totalTokens, 800);
    }
  }

  function renderModelRows(rows) {
    const dark = isDarkTheme();
    modelRows.replaceChildren();
    rows.forEach(({ model, tokens, iconUrl, iconUrlDark }, index) => {
      const src = (dark && iconUrlDark) ? iconUrlDark : iconUrl;
      const row = document.createElement("div");
      row.className = "model-row";

      const icon = document.createElement(src ? "img" : "span");
      icon.className = src ? "model-icon" : "model-dot";
      if (src) {
        icon.src = src;
        icon.alt = "";
      } else {
        icon.style.backgroundColor = MODEL_COLORS[index % MODEL_COLORS.length];
      }

      const name = document.createElement("span");
      name.className = "model-name";
      name.title = model;
      name.textContent = model;

      const value = document.createElement("span");
      value.className = "model-value";
      value.textContent = formatNumber(tokens);

      row.append(icon, name, value);
      modelRows.append(row);
    });
  }

  if (darkScheme) {
    const onSchemeChange = () => renderModelRows(lastRows);
    if (typeof darkScheme.addEventListener === "function") {
      darkScheme.addEventListener("change", onSchemeChange);
    } else if (typeof darkScheme.addListener === "function") {
      darkScheme.addListener(onSchemeChange);
    }
  }

  if (typeof window.tokenDisplayAPI !== "undefined") {
    window.tokenDisplayAPI.onSnapshot(handleSnapshot);
    window.tokenDisplayAPI.getSnapshot().then(handleSnapshot).catch(() => {});
  }
})();
