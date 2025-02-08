import process from 'node:process';
import { app, dialog, ipcMain } from 'electron';
import debounce from 'lodash.debounce';
let appName = app.name;
let invokeErrorHandler: (title: string, error: any) => Promise<void>;
let isInstalled = false;
export const ERROR_HANDLER_CHANNEL = 'ERROR';
// Định nghĩa kiểu dữ liệu cho options
interface ErrorHandlerOptions {
  logger: (error: any) => void;
  showDialog: boolean;
  title: string;
}
// Cấu hình mặc định cho error handler
const defaultOptions: ErrorHandlerOptions = {
  logger: console.error,
  showDialog: process.type !== 'renderer',
  title: 'Error',
};
let options: ErrorHandlerOptions = { ...defaultOptions };
// Thiết lập IPC cho xử lý lỗi
if (process.type === 'renderer') {
  invokeErrorHandler = async (title = 'App encountered an error', error) => {
    const { ipcRenderer } = await import('electron');
    try {
      await ipcRenderer.invoke(ERROR_HANDLER_CHANNEL, title, error);
    } catch (invokeError) {
      if (invokeError.message === 'An object could not be cloned.') {
        ipcRenderer.invoke(ERROR_HANDLER_CHANNEL, title, error);
      }
    }
  };
} else {
  ipcMain.handle(ERROR_HANDLER_CHANNEL, async (_event, title, error) => {
    handleError(title, error);
  });
}
// Hàm xử lý lỗi tập trung
const handleError = (title = `${appName} encountered an error`, error: any) => {
  try {
    options.logger(error); // Ghi lỗi bằng hàm logger đã cấu hình
    if (options.showDialog) {
      dialog.showMessageBox({
        type: 'error',
        title,
        message: error.message || error.toString(),
        detail: error.stack || '',
      });
    }
  } catch (loggerError) {
    dialog.showErrorBox('The `logger` option function threw an error', loggerError.stack || 'Error stack is unavailable.');
  }
};
// Thiết lập xử lý lỗi không mong muốn
export default function unhandled(inputOptions: Partial<ErrorHandlerOptions> = {}) {
  if (isInstalled) return; // Tránh cài đặt lại nhiều lần
  isInstalled = true;
  options = { ...options, ...inputOptions }; // Gộp các tùy chọn người dùng
  if (process.type === 'renderer') {
    const errorHandler = debounce((error) => invokeErrorHandler('Unhandled Error', error), 200);
    const rejectionHandler = debounce((reason) => invokeErrorHandler('Unhandled Promise Rejection', reason), 200);
    window.addEventListener('error', (event) => {
      event.preventDefault();
      errorHandler(event.error || event);
    });
    window.addEventListener('unhandledrejection', (event) => {
      event.preventDefault();
      rejectionHandler(event.reason);
    });
  } else {
    process.on('uncaughtException', (error) => handleError('Unhandled Error', error));
    process.on('unhandledRejection', (reason) => handleError('Unhandled Promise Rejection', reason));
  }
}
// Hàm ghi lỗi thủ công
export function logError(error: any, inputOptions: Partial<ErrorHandlerOptions> = {}) {
  const mergedOptions = { ...options, ...inputOptions };
  const errorTitle = mergedOptions.title || 'Error';
  if (typeof invokeErrorHandler === 'function') {
    invokeErrorHandler(errorTitle, error);
  } else {
    handleError(errorTitle, error);
  }
}
