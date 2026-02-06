import { loadServerContainer } from '../remote-routes.server'

export async function loadRemoteServerModule(pathOrUrl: string, scope: string, moduleName: string) {
  const container = await loadServerContainer(pathOrUrl, scope)
  if (!container) return null

  // initialize sharing if available on host
  try {
    if ((global as any).__webpack_init_sharing__) {
      // @ts-ignore
      await (global as any).__webpack_init_sharing__('default')
    }
  } catch (e) {
    // ignore
  }

  if (typeof container.get === 'function') {
    try {
      const factory = await container.get(moduleName)
      const mod = factory()
      return mod && (mod.default || mod)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to load module ${moduleName} from ${scope}:`, e && e.message ? e.message : e)
      return null
    }
  }

  return null
}
