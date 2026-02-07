import { defineAsyncComponent } from 'vue';
import { loadRemoteModule } from './remote-loader.client';

// Converts a remote route descriptor (with meta.remote, scope, url) into a
// Vue component that lazy-loads the remote module on client-side using the
// existing `loadRemoteModule` helper. The remote module is expected to
// expose `./RemoteHome` or the component specified by `meta.module`.
export function adaptRemoteRoute(descriptor: any) {
    const scope = descriptor?.meta?.scope;
    const url = descriptor?.meta?.url;
    const moduleName = descriptor?.meta?.module || './RemoteHome';

    if (!scope || !url) {
        return null;
    }

    const component = defineAsyncComponent(() =>
        loadRemoteModule(url, scope, moduleName).then((mod) => {
            return mod && (mod.default || mod);
        })
    );

    return { ...descriptor, component };
}
