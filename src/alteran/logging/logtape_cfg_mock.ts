export * from "npm:@logtape/logtape";

import { ensureAlteranLogtapeConfigured } from "./logtape_config.ts";

await ensureAlteranLogtapeConfigured();
