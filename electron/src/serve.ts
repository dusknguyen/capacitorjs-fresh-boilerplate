import fs from 'node:fs/promises';
import path from 'node:path';
import electron, { BrowserWindow, Session } from 'electron';

// Function to safely get the path to a file
const getPath = async (filePath: string): Promise<string | undefined> => {
  try {
    const result = await fs.stat(filePath);
    return result.isFile() ? filePath : undefined;
  } catch {
    return undefined;
  }
};

// Electron Serve function
export default function electronServe(options) {
  options = {
    isCorsEnabled: true,
    scheme: 'app',
    hostname: 'localhost',
    file: 'index',
    ...options,
  };

  if (!options.directory) {
    throw new Error('The `directory` option is required');
  }

  options.directory = path.resolve(electron.app.getAppPath(), options.directory);

  // Register custom protocol
  electron.protocol.registerSchemesAsPrivileged([
    {
      scheme: options.scheme,
      privileges: {
        standard: true,
        secure: true,
        allowServiceWorkers: true,
        supportFetchAPI: true,
        corsEnabled: options.isCorsEnabled,
        stream: true,
      },
    },
  ]);

  // On app ready, register the protocol handler
  electron.app.on('ready', () => {
    const session: Session = options.partition ? electron.session.fromPartition(options.partition) : electron.session.defaultSession;

    // Handle requests for files
    session.protocol.handle(options.scheme, async (request) => {
      try {
        const requestUrl = new URL(request.url);
        let uri = decodeURIComponent(requestUrl.pathname);
        if (uri === '/') uri += 'index'; // Fallback to index

        const normalizedFilePath = path.normalize(path.join(options.directory, uri));

        // Try to get the requested file or its `.html` version
        const finalPath = (await getPath(normalizedFilePath)) || (await getPath(`${normalizedFilePath}.html`));

        if (!finalPath) {
          // Fallback to the default index.html
          return electron.net.fetch(`file://${path.join(options.directory, `${options.file}.html`)}`);
        }

        // Serve the valid file path
        return electron.net.fetch(`file://${finalPath}`);
      } catch (error) {
        console.error('Error serving the file:', error.message);
        // On any error, fallback to index.html
        return electron.net.fetch(`file://${path.join(options.directory, `${options.file}.html`)}`);
      }
    });
  });

  // Load the main page
  return async (window_: BrowserWindow, searchParameters?: Record<string, string>) => {
    const queryString = searchParameters ? '?' + new URLSearchParams(searchParameters).toString() : '';
    await window_.loadURL(`${options.scheme}://${options.hostname}${queryString}`);
  };
}
