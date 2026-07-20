import { createApiClient } from '@arboria-tech/arboria-ui';
import { session } from '@/lib/session';

const base_api = createApiClient(process.env.NEXT_PUBLIC_API!, session);
export default base_api;
