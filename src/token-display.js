"use strict";

const { BrowserWindow } = require("electron");
const path = require("path");
const { getModelIconUrl } = require("./state-model-icons");

const isLinux = process.platform === "linux";
const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

const TOKEN_DISPLAY_WIDTH = 196;
const TOKEN_DISPLAY_HEIGHT = 116;
const GAP = 6;
const EDGE_MARGIN = 8;
const WIN_TOPMOST_LEVEL = "pop-up-menu";
const LINUX_WINDOW_TYPE = "toolbar";

function computeTokenDisplayBounds({ petHitRect, workArea }) {
  if (!petHitRect || !workArea) return null;
  const minX = workArea.x + EDGE_MARGIN;
  const maxX = workArea.x + workArea.width - TOKEN_DISPLAY_WIDTH - EDGE_MARGIN;
  const minY = workArea.y + EDGE_MARGIN;
  const maxY = workArea.y + workArea.height - TOKEN_DISPLAY_HEIGHT - EDGE_MARGIN;
  const x = Math.max(minX, Math.min(
    petHitRect.right + GAP,
    maxX
  ));
  const y = Math.max(minY, Math.min(
    Math.round((petHitRect.top + petHitRect.bottom) / 2 - TOKEN_DISPLAY_HEIGHT / 2),
    maxY
  ));

  return {
    x,
    y,
    width: TOKEN_DISPLAY_WIDTH,
    height: TOKEN_DISPLAY_HEIGHT,
  };
}

function buildTokenData(snapshot) {
  return {
    sessions: ((snapshot && snapshot.sessions) || []).map((session) => ({
      id: session.id,
      agentId: session.agentId,
      iconUrl: session.iconUrl,
      modelIconUrl: getModelIconUrl(session.model, { dark: false }),
      modelIconUrlDark: getModelIconUrl(session.model, { dark: true }),
      model: session.model,
      inputTokens: session.inputTokens,
      outputTokens: session.outputTokens,
      totalCost: session.totalCost,
    })),
  };
}

module.exports = function initTokenDisplay(ctx) {
  let tokenWindow = null;
  let lastSnapshot = null;
  let isVisible = false;

  function getWindow() {
    return tokenWindow;
  }

  function computeBounds() {
    const petBounds = typeof ctx.getPetWindowBounds === "function" ? ctx.getPetWindowBounds() : null;
    if (!petBounds) return null;
    const cx = petBounds.x + petBounds.width / 2;
    const cy = petBounds.y + petBounds.height / 2;
    const workArea = typeof ctx.getNearestWorkArea === "function" ? ctx.getNearestWorkArea(cx, cy) : null;
    if (!workArea) return null;

    const hitRect = typeof ctx.getHitRectScreen === "function"
      ? ctx.getHitRectScreen(petBounds)
      : {
        left: petBounds.x,
        top: petBounds.y,
        right: petBounds.x + petBounds.width,
        bottom: petBounds.y + petBounds.height,
      };

    return computeTokenDisplayBounds({ petHitRect: hitRect, workArea });
  }

  function createWindow() {
    if (tokenWindow && !tokenWindow.isDestroyed()) return;

    const bounds = computeBounds();
    if (!bounds) return;

    tokenWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: TOKEN_DISPLAY_WIDTH,
      height: TOKEN_DISPLAY_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: !isMac,
      focusable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      ...(isLinux ? { type: LINUX_WINDOW_TYPE } : {}),
      ...(isMac ? { type: "panel" } : {}),
      webPreferences: {
        preload: path.join(__dirname, "preload-token-display.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    tokenWindow.loadFile(path.join(__dirname, "token-display.html"));
    tokenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (isWin) {
      try {
        tokenWindow.setAlwaysOnTop(true, WIN_TOPMOST_LEVEL);
      } catch (err) {
        console.warn("TokenDisplay: setAlwaysOnTop failed:", err.message);
      }
    }

    tokenWindow.once("ready-to-show", () => {
      if (isVisible) {
        tokenWindow.show();
      }
    });

    tokenWindow.webContents.on("did-finish-load", () => {
      if (lastSnapshot) {
        tokenWindow.webContents.send("token-display:snapshot", buildTokenData(lastSnapshot));
      }
      if (isVisible) {
        tokenWindow.show();
      }
    });
  }

  function destroyWindow() {
    if (!tokenWindow || tokenWindow.isDestroyed()) return;
    tokenWindow.destroy();
    tokenWindow = null;
  }

  function reposition() {
    if (!tokenWindow || tokenWindow.isDestroyed()) return;
    const bounds = computeBounds();
    if (!bounds) return;
    tokenWindow.setPosition(Math.round(bounds.x), Math.round(bounds.y));
  }

  function snapshotHasTokenData(snapshot) {
    return !!(snapshot && Array.isArray(snapshot.sessions)
      && snapshot.sessions.some((session) => session.inputTokens || session.outputTokens));
  }

  function shouldShow() {
    return ctx.tokenDisplayEnabled !== false &&
      !ctx.petHidden &&
      !!ctx.mouseOverPet &&
      !ctx.getMiniMode() &&
      !ctx.getMiniTransitioning() &&
      snapshotHasTokenData(lastSnapshot);
  }

  function updateVisibility() {
    if (shouldShow()) {
      if (!tokenWindow || tokenWindow.isDestroyed()) {
        createWindow();
      } else if (!isVisible) {
        tokenWindow.show();
      }
      isVisible = true;
    } else {
      if (tokenWindow && !tokenWindow.isDestroyed() && isVisible) {
        tokenWindow.hide();
      }
      isVisible = false;
    }
  }

  function sendSnapshot(snapshot) {
    lastSnapshot = snapshot;
    updateVisibility();
    if (!shouldShow() || !tokenWindow || tokenWindow.isDestroyed()) {
      return;
    }
    if (tokenWindow.webContents.isLoading()) {
      return;
    }
    tokenWindow.webContents.send("token-display:snapshot", buildTokenData(snapshot));
  }

  function syncVisibility() {
    updateVisibility();
  }

  return {
    getWindow,
    reposition,
    sendSnapshot,
    syncVisibility,
    hasTokenData: () => snapshotHasTokenData(lastSnapshot),
    destroy: destroyWindow,
  };
};

module.exports.computeTokenDisplayBounds = computeTokenDisplayBounds;
module.exports.buildTokenData = buildTokenData;
