/**
 * Capture homepage screenshots for every site in portfolio-data.js.
 * Saves 16:10 JPEGs to html/images/portfolio/{id}.jpg
 *
 * Usage: node scripts/capture-portfolio.js
 *        node scripts/capture-portfolio.js --only=fleurealle,emdc-group
 */
const fs = require("fs");
const path = require("path");

const localBrowsers = path.join(process.env.USERPROFILE || "", "AppData", "Local", "ms-playwright");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}

const { chromium } = require("playwright");
const { sites } = require("./portfolio-data");

const OUT_DIR = path.join(__dirname, "..", "html", "images", "portfolio");
const VIEWPORT = { width: 1440, height: 900 };
const CLIP = { x: 0, y: 0, width: 1440, height: 900 };

const EXTRA_WAIT_HOSTS = [
  "fleurealle.liteweb.info",
  "gwip.liteweb.info",
  "brightproperties.uk",
  "santamariabouar.com",
  "arar-co.com",
  "podvorie-livan.com",
  "guerrasports.com",
  "emdcgroup.com",
];

const DISMISS_NAMES = [
  /accept all/i,
  /^accept$/i,
  /^continue$/i,
  /^i agree$/i,
  /^got it$/i,
  /^allow$/i,
  /^ok$/i,
  /allow all/i,
];

async function dismissOverlays(page) {
  for (const name of DISMISS_NAMES) {
    try {
      const btn = page.getByRole("button", { name });
      if (await btn.first().isVisible({ timeout: 600 })) {
        await btn.first().click({ timeout: 1200 });
        await page.waitForTimeout(400);
      }
    } catch {
      /* overlay not present */
    }
  }

  try {
    const close = page.locator('[aria-label*="close" i], .cookie-close, .modal-close, button:has-text("×")').first();
    if (await close.isVisible({ timeout: 400 })) {
      await close.click({ timeout: 800 });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Headless Chromium often never autoplays video and screenshots of <video>
 * are blank. Force load/play, then stamp the current frame onto an <img>
 * so the JPEG actually contains the hero.
 */
async function prepareHeroMedia(page) {
  try {
    await Promise.race([
      page.evaluate(async () => {
    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function waitEvent(el, name, ms) {
      return new Promise((resolve) => {
        const done = () => {
          el.removeEventListener(name, done);
          resolve();
        };
        el.addEventListener(name, done);
        setTimeout(done, ms);
      });
    }

    document.querySelectorAll(".carousel").forEach((el) => {
      el.classList.remove("slide");
      try {
        if (window.bootstrap && window.bootstrap.Carousel) {
          const inst =
            window.bootstrap.Carousel.getInstance(el) ||
            new window.bootstrap.Carousel(el, { interval: false });
          inst.pause();
          inst.to(0);
        }
      } catch {
        /* ignore */
      }
    });

    const videos = Array.from(document.querySelectorAll("video"));
    for (const video of videos) {
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.controls = false;
      try {
        video.load();
      } catch {
        /* ignore */
      }
      try {
        await Promise.race([video.play(), wait(4000)]);
      } catch {
        /* autoplay may still fail; keep waiting for data */
      }

      if (video.readyState < 2) {
        await Promise.race([waitEvent(video, "loadeddata", 12000), waitEvent(video, "playing", 12000)]);
      }

      if (video.duration && Number.isFinite(video.duration) && video.duration > 0.4) {
        const t = Math.min(1.25, Math.max(0.35, video.duration * 0.12));
        try {
          video.currentTime = t;
          await waitEvent(video, "seeked", 4000);
        } catch {
          /* ignore */
        }
      }

      await wait(250);

      if (!video.videoWidth) {
        const poster = video.getAttribute("poster") || video.poster;
        if (poster) {
          const img = document.createElement("img");
          img.src = poster;
          img.className = video.className;
          if (video.id) img.id = video.id;
          const style = getComputedStyle(video);
          img.style.cssText = video.getAttribute("style") || "";
          img.style.width = style.width;
          img.style.height = style.height;
          img.style.objectFit = style.objectFit || "cover";
          img.style.position = style.position === "static" ? "absolute" : style.position;
          img.style.inset = style.inset;
          img.style.top = style.top;
          img.style.left = style.left;
          img.style.zIndex = style.zIndex && style.zIndex !== "auto" ? style.zIndex : "0";
          video.replaceWith(img);
          await waitEvent(img, "load", 6000);
        }
        continue;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/jpeg", 0.9);
      img.alt = video.getAttribute("aria-label") || "Hero";
      img.className = video.className;
      if (video.id) img.id = video.id;

      const style = getComputedStyle(video);
      img.style.cssText = video.getAttribute("style") || "";
      img.style.width = style.width;
      img.style.height = style.height;
      img.style.objectFit = style.objectFit || "cover";
      img.style.position = style.position === "static" ? "absolute" : style.position;
      img.style.inset = style.inset;
      img.style.top = style.top;
      img.style.left = style.left;
      img.style.right = style.right;
      img.style.bottom = style.bottom;
      img.style.zIndex = style.zIndex && style.zIndex !== "auto" ? style.zIndex : "0";
      img.style.maxWidth = "none";

      video.replaceWith(img);
    }

    const heroImgs = Array.from(
      document.querySelectorAll(".carousel-item.active img, video + img, .hero img, .hero-swiper-media")
    ).filter((el) => el.tagName === "IMG");

    await Promise.all(
      heroImgs.slice(0, 2).map(async (img) => {
        if (img.decode) {
          try {
            await Promise.race([img.decode(), wait(4000)]);
          } catch {
            /* ignore */
          }
        }
        if (!img.complete) await waitEvent(img, "load", 5000);
      })
    );
  }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 28000)),
    ]);
  } catch (err) {
    console.warn(`  hero media: ${err.message}`);
  }
}

async function capturePlaceholder(page, site, outPath) {
  const safeName = String(site.name).replace(/</g, "&lt;");
  const safeUrl = String(site.url).replace(/</g, "&lt;");
  await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;width:1440px;height:900px;background:#0b1f3a;color:#fff;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:48px;box-sizing:border-box">
  <div style="font-family:sans-serif;font-size:13px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.55;margin-bottom:20px">LiteWeb</div>
  <div style="font-size:42px;font-weight:700;line-height:1.2">${safeName}</div>
  <div style="margin-top:16px;font-family:sans-serif;font-size:16px;opacity:0.65">${safeUrl}</div>
</body></html>`);
  await page.screenshot({ path: outPath, type: "jpeg", quality: 82, clip: CLIP });
}

async function captureSite(page, site) {
  const outPath = path.join(OUT_DIR, `${site.id}.jpg`);
  const extraWait = EXTRA_WAIT_HOSTS.some((host) => site.url.includes(host));

  try {
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!extraWait) {
      try {
        await page.waitForLoadState("networkidle", { timeout: 8000 });
      } catch {
        /* some sites never go idle */
      }
    }
    await page.waitForTimeout(extraWait ? 4000 : 1800);
    await dismissOverlays(page);
    try {
      await page.waitForSelector("h1, img, video, .hero, header", { timeout: 8000 });
    } catch {
      /* proceed anyway */
    }
    await dismissOverlays(page);
    await prepareHeroMedia(page);
    await page.waitForTimeout(extraWait ? 1200 : 400);
    await page.screenshot({ path: outPath, type: "jpeg", quality: 82, clip: CLIP });
    console.log(`ok   ${site.id}`);
    return true;
  } catch (err) {
    console.warn(`fail ${site.id}: ${err.message}`);
    try {
      await capturePlaceholder(page, site, outPath);
      console.log(`ph   ${site.id} (placeholder)`);
    } catch (phErr) {
      console.error(`skip ${site.id}: could not write placeholder (${phErr.message})`);
    }
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const onlyIds = onlyArg
    ? onlyArg
        .slice("--only=".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : null;
  const targets = onlyIds ? sites.filter((site) => onlyIds.includes(site.id)) : sites;
  if (!targets.length) {
    console.error("No matching sites to capture.");
    process.exit(1);
  }

  const chromePath = path.join(localBrowsers, "chromium-1148", "chrome-win", "chrome.exe");
  const launchOptions = {
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-blink-features=AutomationControlled",
      "--mute-audio",
    ],
  };
  if (fs.existsSync(chromePath)) {
    launchOptions.executablePath = chromePath;
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: "en-US",
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    } catch {
      /* ignore */
    }
    HTMLMediaElement.prototype.play = (function (orig) {
      return function playPatched() {
        this.muted = true;
        this.playsInline = true;
        return orig.apply(this, arguments);
      };
    })(HTMLMediaElement.prototype.play);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  let ok = 0;
  for (const site of targets) {
    const success = await captureSite(page, site);
    if (success) ok += 1;
  }

  await browser.close();
  console.log(`\nCaptured ${ok}/${targets.length} live screenshots.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
