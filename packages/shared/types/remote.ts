export type RemoteRoute = {
    path: string;
    name?: string;
    // A lazy-loaded component factory or a direct component value
    component?: (() => Promise<any>) | any;
    meta?: Record<string, any>;
};

export type GetRoutes = () => Promise<RemoteRoute[]> | RemoteRoute[];

export type RemoteModule = any;

// A minimal representation of a federated container expected shape on server
export type RemoteFactory = () => any;

export interface RemoteContainer {
    get: (request: string) => Promise<RemoteFactory>;
    init?: (shareScope: Record<string, any>) => Promise<void> | void;
}
