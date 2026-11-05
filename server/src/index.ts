import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { env } from './config/env.js';

export { createApp } from './app.js';
export default createApp;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createApp().then((server) => {
    server.listen(env.port, env.host, () => console.log(`DARB API listening on http://${env.host}:${env.port}`));
  }).catch((error: unknown) => {
    console.error('DARB startup failed', error);
    process.exitCode = 1;
  });
}
