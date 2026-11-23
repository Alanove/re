import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cachedModulePromise;

function compileAndImport() {
  if (!cachedModulePromise) {
    cachedModulePromise = (async () => {
      // Compile under the package so Node resolves nodemailer from packages/email-sender/node_modules.
      const outDir = path.join(root, 'test', '.compiled');
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.mkdirSync(outDir, { recursive: true });
      const configPath = path.join(outDir, 'tsconfig.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              strict: true,
              skipLibCheck: true,
              rootDir: path.join(root, 'src').replace(/\\/g, '/'),
              outDir: outDir.replace(/\\/g, '/'),
              declaration: false,
              esModuleInterop: true,
              typeRoots: [path.join(root, 'node_modules', '@types').replace(/\\/g, '/')],
              types: ['node']
            },
            include: [path.join(root, 'src', '**', '*.ts').replace(/\\/g, '/')]
          },
          null,
          2
        )
      );
      const tscJs = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js');
      const result = spawnSync(process.execPath, [tscJs, '-p', configPath], {
        encoding: 'utf8',
        cwd: root
      });
      if (result.status !== 0) {
        throw new Error(`tsc failed:\n${result.stdout}\n${result.stderr}`);
      }
      return import(pathToFileURL(path.join(outDir, 'createMailer.js')).href);
    })();
  }
  return cachedModulePromise;
}

test('send refuses when the mailer is not configured', async () => {
  const { createMailer, MailerError } = await compileAndImport();
  const mailer = createMailer(null);
  assert.equal(mailer.isConfigured(), false);
  await assert.rejects(
    () =>
      mailer.send({
        replyTo: 'visitor@example.com',
        subject: 'Hello',
        text: 'A real message body.'
      }),
    (error) => error instanceof MailerError && error.message === 'Email is not configured.'
  );
});

test('send rejects a subject with a newline', async () => {
  const { createMailer, MailerError } = await compileAndImport();
  const mailer = createMailer({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    from: 'noreply@example.com',
    defaultTo: 'inbox@example.com'
  });
  assert.equal(mailer.isConfigured(), true);
  await assert.rejects(
    () =>
      mailer.send({
        replyTo: 'visitor@example.com',
        subject: 'Hello\nBcc: evil@example.com',
        text: 'A real message body.'
      }),
    (error) => error instanceof MailerError && error.message === 'Invalid outgoing mail.'
  );
});

test('send rejects a bad reply-to address', async () => {
  const { createMailer, MailerError } = await compileAndImport();
  const mailer = createMailer({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    from: 'noreply@example.com',
    defaultTo: 'inbox@example.com'
  });
  await assert.rejects(
    () =>
      mailer.send({
        replyTo: 'not-an-email',
        subject: 'Hello',
        text: 'A real message body.'
      }),
    (error) => error instanceof MailerError && error.message === 'Invalid outgoing mail.'
  );
});
