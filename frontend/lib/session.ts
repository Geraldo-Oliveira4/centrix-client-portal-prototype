import { createSessionManager } from '@arboria-tech/arboria-ui';
import { SESSION_KEY } from './session-key';

export { SESSION_KEY };
export const session = createSessionManager(SESSION_KEY);
