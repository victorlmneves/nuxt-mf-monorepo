export type RemoteRoute = {
    path: string;
    name?: string;
    component?: any;
};

export type GetRoutes = () => Promise<RemoteRoute[]> | RemoteRoute[];

export type RemoteModule = any;
