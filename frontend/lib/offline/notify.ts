// Toast de sucesso de uma ação que GRAVA no backend.
//
// No modo offline a escrita é simulada e o adapter já avisou "Prévia: nada foi
// enviado" (`offline-adapter.ts`). Um "enviada com sucesso" ao lado daquele
// aviso fingiria o envio — então, offline, o sucesso fica calado. Com a API de
// pé, nada muda.

import { toast, type ToastOptions } from 'react-toastify';

import { isOfflineActive } from './offline-store';

export function notifySuccess(message: string, options?: ToastOptions) {
  if (isOfflineActive()) return;
  toast.success(message, options);
}
