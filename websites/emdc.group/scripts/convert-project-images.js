/**
 * Convert every raster under public/projects to WebP + -thumb.webp and
 * rewrite data/projects.json image filenames.
 *
 * Usage (from the site folder):
 *   node scripts/convert-project-images.js
 */
const fs = require('fs');
const path = require('path');

const siteRoot = path.resolve(__dirname, '..');
const projectsDir = path.join(siteRoot, 'public', 'projects');
const projectsJsonPath = path.join(siteRoot, 'data', 'projects.json');
const RASTER_EXT = /\.(jpe?g|png|gif|webp|bmp|tif{1,2}|heic|heif|avif)$/i;

function projectThumbFilename(imageName) {
  const base = path.basename(imageName, path.extname(imageName));
  if (base.endsWith('-thumb')) {
    return `${base}.webp`;
  }
  return `${base}-thumb.webp`;
}

async function loadSharp() {
  try {
    return require('sharp');
  } catch (error) {
    throw new Error(`sharp is required: ${error.message}`);
  }
}

async function writeWebp(sharp, input, destPath, maxWidth, quality) {
  const tempPath = `${destPath}.${Date.now()}.tmp`;
  try {
    await sharp(input)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality, alphaQuality: Math.min(100, quality + 8), effort: 4 })
      .toFile(tempPath);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    fs.renameSync(tempPath, destPath);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

async function convertFile(sharp, absolutePath) {
  const filename = path.basename(absolutePath);
  const ext = path.extname(filename);
  if (!RASTER_EXT.test(ext) || ext.toLowerCase() === '.svg') {
    return null;
  }
  if (/-thumb\.webp$/i.test(filename)) {
    return null;
  }

  const dir = path.dirname(absolutePath);
  const base = path.basename(filename, ext);
  const displayName = `${base}.webp`;
  const thumbName = projectThumbFilename(displayName);
  const displayPath = path.join(dir, displayName);
  const thumbPath = path.join(dir, thumbName);

  const input = fs.readFileSync(absolutePath);
  const sameWebp = ext.toLowerCase() === '.webp' && path.resolve(absolutePath) === path.resolve(displayPath);

  if (!sameWebp || !fs.existsSync(displayPath)) {
    await writeWebp(sharp, input, displayPath, 1600, 82);
  }

  const displayBuffer = fs.readFileSync(displayPath);
  if (!fs.existsSync(thumbPath)) {
    await writeWebp(sharp, displayBuffer, thumbPath, 800, 78);
  }

  if (path.resolve(absolutePath) !== path.resolve(displayPath) && path.resolve(absolutePath) !== path.resolve(thumbPath)) {
    fs.unlinkSync(absolutePath);
  }

  return displayName;
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const sharp = await loadSharp();
  if (!fs.existsSync(projectsJsonPath)) {
    throw new Error(`Missing ${projectsJsonPath}`);
  }

  const data = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
  const projects = Array.isArray(data.projects) ? data.projects : [];
  let converted = 0;
  let skipped = 0;
  let renamed = 0;

  for (const project of projects) {
    const folder = project.folder_name || 'temp';
    const projectDir = path.join(projectsDir, folder);

    if (project.project_image) {
      const current = path.join(projectDir, path.basename(project.project_image));
      if (fs.existsSync(current)) {
        const nextName = await convertFile(sharp, current);
        if (nextName && nextName !== project.project_image) {
          project.project_image = nextName;
          renamed += 1;
          converted += 1;
        } else if (nextName) {
          skipped += 1;
        }
      } else {
        const webpGuess = path.join(projectDir, `${path.basename(project.project_image, path.extname(project.project_image))}.webp`);
        if (fs.existsSync(webpGuess)) {
          const nextName = path.basename(webpGuess);
          if (nextName !== project.project_image) {
            project.project_image = nextName;
            renamed += 1;
          }
          if (!fs.existsSync(path.join(projectDir, projectThumbFilename(nextName)))) {
            await convertFile(sharp, webpGuess);
            converted += 1;
          } else {
            skipped += 1;
          }
        }
      }
    }

    if (Array.isArray(project.works)) {
      for (const work of project.works) {
        if (!Array.isArray(work.images)) continue;
        const workDir = work.folder_name
          ? path.join(projectDir, work.folder_name)
          : projectDir;
        const nextImages = [];
        for (const imageName of work.images) {
          const current = path.join(workDir, path.basename(imageName));
          if (fs.existsSync(current)) {
            const nextName = await convertFile(sharp, current);
            if (nextName) {
              nextImages.push(nextName);
              if (nextName !== imageName) {
                renamed += 1;
                converted += 1;
              } else {
                skipped += 1;
              }
            } else {
              nextImages.push(imageName);
            }
          } else {
            const webpGuess = path.join(workDir, `${path.basename(imageName, path.extname(imageName))}.webp`);
            if (fs.existsSync(webpGuess)) {
              nextImages.push(path.basename(webpGuess));
              if (!fs.existsSync(path.join(workDir, projectThumbFilename(path.basename(webpGuess))))) {
                await convertFile(sharp, webpGuess);
                converted += 1;
              }
            } else {
              nextImages.push(imageName);
            }
          }
        }
        work.images = nextImages;
      }
    }
  }

  // Convert any leftover raster files not referenced (safety for orphans).
  for (const file of walkFiles(projectsDir)) {
    const name = path.basename(file);
    if (/-thumb\.webp$/i.test(name)) continue;
    if (!RASTER_EXT.test(path.extname(name))) continue;
    if (path.extname(name).toLowerCase() === '.webp') {
      const thumb = path.join(path.dirname(file), projectThumbFilename(name));
      if (!fs.existsSync(thumb)) {
        await convertFile(sharp, file);
        converted += 1;
      }
      continue;
    }
    await convertFile(sharp, file);
    converted += 1;
  }

  fs.writeFileSync(projectsJsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Project images: converted=${converted} skipped=${skipped} renamed=${renamed}`);
  console.log(`Updated ${projectsJsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
