declare const __BUILD_STAMP__: string | undefined;

/** When this copy of the app was built (UTC), so any installed copy can be told apart. "development" when run unbuilt. */
export const BUILD_STAMP: string = typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'development';
