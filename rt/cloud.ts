///<reference path='refs.ts'/>
module TDev.Cloud {

    export var lite = false;

    export function getServiceUrl() { return <string>((<any>window).rootUrl); }

    export function mkLegalDiv() {
        var link = (text: string, lnk: string) =>
            HTML.mkA(null, getServiceUrl() + lnk, "_blank", text);
        return div("wall-dialog-body", div("smallText",
                lf("Publishing is subject to our "),
                link(lf("terms of use"), "/legal"),
                lf(". Please read our information about "), link(lf("privacy and cookies"), "/privacy"), "."))
    }

    export var authenticateAsync = (activity:string, redirect = false, dontRedirect = false): Promise =>
    { // boolean

        if (!Cloud.isAccessTokenExpired()) return Promise.as(true);

        function loginAsync() {
            var loginUrl = Cloud.getServiceUrl() + "/oauth/dialog?response_type=token&"
                + "client_id=webapp"
                + "&identity_provider=" + encodeURIComponent(Cloud.getIdentityProvider() || "");
            return TDev.RT.Web.oauth_v2_async(loginUrl, "touchdevelop")
                .then((or: TDev.RT.OAuthResponse) => {
                    if (or.is_error()) return false;
                    else {
                        var id = or.others().at('id');
                        var oldid = Cloud.getUserId();
                        if (oldid && id != oldid) {
                            // TODO: error message.
                            return false;
                        }
                        Cloud.setUserId(or.others().at('id'));
                        Cloud.setAccessToken(encodeURIComponent(or.access_token()));
                        Cloud.setIdentityProvider(or.others().at('identity_provider'));
                        return true;
                    }
                });
        }

        return Cloud.isOnlineWithPingAsync()
            .then((isOnline : boolean) => {
                if (!isOnline) return Promise.as(false);

                var prevHash = (window.location.hash || "#").replace(/#/, "");
                var login = (<any>TDev).Login;
                if (login) {
                    if (!login.show || dontRedirect)
                        login = null;
                    if (!redirect && (!prevHash || /^(hub|list:.*:user:me:)/.test(prevHash)))
                        login = null;
                }

                var r = new PromiseInv();

                var m = new ModalDialog();
                m.addHTML(
                    Util.fmt("<h3>{0:q} requires sign&nbsp;in</h3>", activity) +
                    (!(<any>TDev).TheEditor ? "" :
                      "<p class='agree'>" +
                      "After you sign in we will back up and sync scripts between your devices. " +
                      "You will be able to publish scripts, join and create groups, post comments, post leaderboard scores, and give hearts. " +
                      "In short, it's totally awesome!" +
                      "</p>") +
                      "<p class='agree'>You can sign in with your Microsoft, Google, Facebook or Yahoo account.</p>"
                    )
                m.fullWhite();
                var ignoreDismiss = false;
                m.add(div("wall-dialog-buttons",
                    HTML.mkButton(lf("maybe later"), () => { m.dismiss() }, "gray-button"),
                    HTML.mkButtonElt("wall-button login-button", SVG.getLoginButton()).withClick(() => {
                        ignoreDismiss = true;
                        m.dismiss()
                        if (login) login.show();
                        else loginAsync().done(v => r.success(v))
                    })));
                m.onDismiss = () => {
                    if (!ignoreDismiss) r.success(false);
                };
                m.show();

                return r;
            })
    }

    export function anonMode(activity:string, restart:()=>void = null, redirect = false)
    {
        if (Cloud.isOffline()) {
            Cloud.showModalOnlineInfo(lf("{0} requires online access", activity))
            return true;
        }
        if (Cloud.getUserId()) return false;
        Cloud.authenticateAsync(activity, redirect).done((ok) => {
            if (ok && restart) restart();
        })
        return true;
    }

    export function parseAccessToken(h: string, onStateError : () => void, onUserError: () => void ): boolean {
        var stateMatch = h.match(/.*&state=([^&]*)/);
        var state = stateMatch ? stateMatch[1] : "";
        if (Cloud.oauthStates().indexOf(decodeURIComponent(state)) == -1) {
            onStateError();
            return false;
        }

        var token = h.match(/.*#access_token=([^&]*)/)[1];
        var m = h.match(/.*&identity_provider=([^&]*)/);
        var identityProvider = m ? decodeURIComponent(m[1]) : undefined;
        var id = h.match(/.*&id=([^&]*)/)[1];
        var expires = parseInt((h.match(/.*&expires_in=([^&]*)/)||["0","0"])[1]);
        var oldid = Cloud.getUserId();
        if (oldid && id != oldid) {
            onUserError();
            return false;
        }

        if (/.*[#&]dbg=true/.test(h))
            window.localStorage.setItem("dbg",  "true")
        else
            window.localStorage.removeItem("dbg");
        Cloud.setUserId(id);
        Cloud.setIdentityProvider(identityProvider || "");
        Cloud.setAccessToken(token);
        return true;
    }

    export function getAccessToken() : string {
        return window.localStorage.getItem("access_token");
    }
    export function isAccessTokenExpired() : boolean {
        return !getAccessToken() || !!window.localStorage.getItem("access_token_expired");
    }
    export function accessTokenExpired() : void {
        window.localStorage.setItem("access_token_expired",  "1")
    }
    export function setAccessToken(token : string) : void {
        window.localStorage.removeItem("access_token_expired");
        if (!token) window.localStorage.removeItem("access_token");
        else window.localStorage.setItem("access_token",  token)
    }
    export var getUserId = () => window.localStorage.getItem("userid");

    export var currentReleaseId = "";
    export function getWorldId(): string {
        var worldId = window.localStorage.getItem("worldId");
        if (!worldId) window.localStorage.setItem("worldId",  worldId = "$webclient$-" + Util.guidGen())
        return worldId;
    }
    export function oauthStates() {
        var a = JSON.parse(window.localStorage.getItem("oauth_states") || "[]");
        if (a.length == 0) a = [Random.normalized().toString()];
        window.localStorage.setItem("oauth_states",  JSON.stringify(a))
        return a;
    }
    export function setUserId(id : string) {
        if (!id)
            window.localStorage.removeItem("userid");
        else
            window.localStorage.setItem("userid",  id)
    }
    export function getIdentityProvider()  {
        return window.localStorage.getItem("identity_provider");
    }
    export function setIdentityProvider(id : string) {
        if (!id)
            window.localStorage.removeItem("identity_provider");
        else
            window.localStorage.setItem("identity_provider",  id)
    }
    export interface Progress {
        guid?: string;
        index?: number;
        completed?: number;
        numSteps?: number;
        lastUsed?: number;
    }
    export interface Progresses {
        [id: string]: Progress;
    }

    function mergeProgress(oldData: Progresses, data: Progresses) {
        oldData = JSON.parse(JSON.stringify(oldData))
        Object.keys(data).forEach(id => {
            var oldProgress = oldData[id] || <Progress>{};
            var progress = data[id];
            if (oldProgress.index === undefined || oldProgress.index <= progress.index) {
                if (progress.guid) oldProgress.guid = progress.guid;
                oldProgress.index = progress.index
                if (progress.completed && (oldProgress.completed === undefined || oldProgress.completed > progress.completed)) oldProgress.completed = progress.completed;
                oldProgress.numSteps = progress.numSteps;
                oldProgress.lastUsed = progress.lastUsed;
            }
            oldData[id] = oldProgress;
        });
        return oldData
    }

    export function storeProgress(data: Progresses) {
        var newData = mergeProgress(loadPendingProgress(), data);
        window.localStorage.setItem("progress",  JSON.stringify(newData))
        window.localStorage.setItem("total_progress", JSON.stringify(mergeProgress(loadProgress(), data)));
    }

    function clearPendingProgress(data: Progresses) {
        var oldData = loadPendingProgress();
        Object.keys(data).forEach(id => {
            var oldProgress = oldData[id];
            var progress = data[id];
            if (oldProgress &&
                (!oldProgress.guid || !progress.guid) &&
                (oldProgress.index === undefined || progress.index === undefined || oldProgress.index <= progress.index) &&
                (oldProgress.completed === undefined || progress.completed === undefined || oldProgress.completed >= progress.completed ))
                delete oldData[id];
        });
        window.localStorage.setItem("progress",  JSON.stringify(oldData))
    }

    export function loadProgress() {
        return loadPendingProgress("total_progress")
    }

    function loadPendingProgress(name = "progress") {
        return <Progresses>JSON.parse(window.localStorage.getItem(name) || "{}");
    }

    export function isOffline() : boolean {
        return !isOnline();
    }
    export function isOnline() : boolean {
        var b = !TDev.Browser.noNetwork && (TDev.Browser.isNodeJS || window.navigator.onLine) && isTouchDevelopOnline();
        // randomly turns off connectivity
        if (TDev.dbg && b && isChaosOffline() && TDev.RT.Math_.random(10) < 4)
            b = false;
        return b;
    }
    export function isOnlineWithPingAsync() : Promise { // of boolean
        if (!isOnline()) return Promise.as(false);
        return pingAsync();
    }

    export var transientOfflineMode = false;
    export function isTouchDevelopOnline() : boolean {
        return !window.localStorage.getItem('offline_mode') && !transientOfflineMode;
    }
    export function setTouchDevelopOnline(value: boolean) {
        if (value)
            window.localStorage.removeItem('offline_mode');
        else
            window.localStorage.setItem('offline_mode',  "true")
    }
    export function isChaosOffline() : boolean {
        return !!window.localStorage.getItem('chaos_offline_mode');
    }
    export function setChaosOffline(value: boolean) {
        if (!value)
            window.localStorage.removeItem('chaos_offline_mode');
        else
            window.localStorage.setItem('chaos_offline_mode',  "true")
    }
    export function offlineErrorAsync(): Promise {
        var msg = isTouchDevelopOnline() ? "offline mode is on" : "force offline mode is on";
        return new Promise((onSuccess, onError, onProgress) => {
            var e = new Error(msg);
            (<any>e).status = 502;
            onError(e);
        });
    }
    export function canPublish()
    {
        return getUserId() != "paema";
    }
    export function onlineInfo(): string {
        if (Cloud.isOffline()) {
            var msg = lf("You appear to be offline. ") + (isTouchDevelopOnline()
                ? lf("Please connect to the internet.")
                : lf("Please go to the settings in the main hub to disable offline mode."));
            return msg;
        }
        else {
            return lf("You are online.");
        }
    }
    export function showOnlineInfoProgess() {
        HTML.showProgressNotification(onlineInfo(), true);
    }
    export function showModalOnlineInfo(title : string) {
        ModalDialog.info(title, onlineInfo());
    }
    var appendAccessToken = (url: string) => (url + (/\?/.test(url) ? "&" : "?") + "access_token=" + getAccessToken() + "&world_id=" + encodeURIComponent(Cloud.getWorldId()) + "&release_id=" + encodeURIComponent(Cloud.currentReleaseId) + "&user_platform=" + encodeURIComponent(Browser.platformCaps.join(",")));
    export function getPublicApiUrl(path: string) : string {
        //getServiceUrl() + "/api/" + path;
        return appendAccessToken(getServiceUrl() + "/api/" + path);
    }
    export function getPrivateApiUrl(path: string) : string {
        return appendAccessToken(getServiceUrl() + "/api" + (path == null ? "" : "/" + path));
    }
    export function getScriptTextAsync(id: string) : Promise {
        return Util.httpGetTextAsync(getPublicApiUrl(encodeURIComponent(id) + "/text?original=true&ids=true"))
    }
    export function getPrivateApiAsync(path: string) : Promise {
        return Util.httpGetJsonAsync(getPrivateApiUrl(path));
    }
    export function getPublicApiAsync(path: string) : Promise {
        return Util.httpGetJsonAsync(getPublicApiUrl(path));
    }
    export function postPrivateApiAsync(path:string, req:any) : Promise {
        return Util.httpPostJsonAsync(getPrivateApiUrl(path), req);
    }
    export function deletePrivateApiAsync(path: string): Promise {
        return Util.httpRequestAsync(Cloud.getPrivateApiUrl(path), "DELETE");
    }
    export function deletePublicationAsync(id: string): Promise {
        return Util.httpRequestAsync(Cloud.getPrivateApiUrl(id), "DELETE");
    }
    export function getRandomAsync() : Promise {
        return Util.httpGetTextAsync(getPublicApiUrl("random"));
    }
    export interface Version {
        instanceId: string;
        version: number;
        time: number;
        // LITE
        baseSnapshot: string;
    }
    export function isVersionNewer(version1: Version, version2: Version): boolean {
        if (typeof version1 === "object" && typeof version2 === "object")
        {
            if (version1.instanceId == version2.instanceId)
                return version1.version > version2.version || version1.version == version2.version && version1.time > version2.time;
            else
                return version1.time > version2.time;
        }
        return false;
    }

    export interface Header {
        guid: string;
        name: string;
        scriptId: string;
        scriptTime:number;
        updateId: string;
        updateTime:number;
        scriptVersion: Version;
        meta: any;
        capabilities: string;
        flow: string;
        sourcesThatNeedToBeGrantedAccess: string;
        userId: string;
        status: string;
        hasErrors: boolean;
        //libraryDependencies: string[];
        publishAsHidden:boolean;
        recentUse: number; // seconds since epoch
        // For compatibility reasons with previous cloud entries, we need to
        // adopt the view that [editor == undefined] means "default
        // TouchDevelop" editor, while anything else means "external editor".
        editor?: string;

    }
    export interface AskSomething {
        title: string;
        picture?: string;
        message: string;
        linkName?: string;
        linkUrl?: string;
    }
    export interface InstalledHeaders {
        headers: Header[];
        newNotifications: number;
        notifications: boolean;
        email: boolean;
        emailNewsletter: boolean;
        emailNotifications: boolean;
        profileIndex: number;
        profileCount: number;
        time: number;
        askBeta?:boolean;
        askSomething?:AskSomething;
        minimum?: string;
        random?:string;
        v?: number;
        user?: any;
        blobcontainer?: string;
    }
    export interface InstalledBodies {
        bodies: Body[];
        recentUses: RecentUse[];
    }
    export interface UserSettings {
        nickname?: string;
        aboutme?: string;
        website?: string;
        notifications?: boolean;
        notifications2?: string;
        picturelinkedtofacebook?: boolean;
        realname?: string;
        gender?: string;
        howfound?: string;
        culture?: string;
        yearofbirth?: number;
        programmingknowledge?: string;
        occupation?: string;
        emailnewsletter2?: string;
        emailfrequency?: string;
        email?: string;
        location?: string;
        twitterhandle?: string;
        githubuser?: string;
        editorMode?: string;
        school?: string;
        wallpaper?: string;
    }
    export function getUserInstalledAsync() : Promise // of InstalledHeaders
    {
        return getPrivateApiAsync("me/installed");
    }
    export function getUserInstalledLongAsync(v?: number, m?: boolean) : Promise // of InstalledHeaders
    {
        return getPrivateApiAsync("me/installedlong" + (v ? "?v=" + v + (m ? "&m=1" : "") : ""));
    }
    export interface RecentUse {
        guid: string;
        recentUse: number; // seconds since epoch
    }
    // See the [Header] type for more comments.
    export interface Body {
        guid: string;
        name: string;
        scriptId: string;
        updateId: string;
        scriptVersion: Version;
        meta: string;
        capabilities: string;
        flow: string;
        sourcesThatNeedToBeGrantedAccess: string;
        userId: string;
        status: string;
        hasErrors: boolean;
        //libraryDependencies: string[];
        script: string;
        editorState: string;
        recentUse: number; // seconds since epoch
        editor?: string;
    }

    export interface BatchResponse
    {
        code: number;
        body: any;
        ETag: string;
    }
    export interface BatchResponses
    {
        code: number;
        array: BatchResponse[];
    }

    export interface PostUserInstalledResponse {
        v?: number;
        delay: number;
        numErrors?: number;
        headers?: Header[];
    }

    export interface PostApiGroupsBody {
        name: string;
        description: string;
        school?:string;
        grade?:string;
        allowexport: boolean;
        allowappstatistics: boolean;
        userplatform: string[];
    }
    export interface PostApiGroupsResponse {
        id: string;
    }
    export interface ApiGroupCodeResponse {
        code: string; // can be null; in particular, is null initially
        expiration: number; // can be null; in particular, is null initially; in seconds since 1970
    }
    export interface ApiGroupCodeRequest {
        expiration?: number;
            // in seconds since 1970; if present, cannot be in the past or more than a year in the future;
            // defaults to 14 days into the future if null or not present
    }

    export function getUserInstalledBodyAsync(guid: string) : Promise // of InstalledBodies
    {
        return getPrivateApiAsync("me/installed/" + guid);
    }
    export function postUserInstalledAsync(installedBodies: InstalledBodies) : Promise // of PostUserInstalledResponse
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl("me/installed"), installedBodies);
    }
    export function postUserInstalledPublishAsync(guid:string, hidden:boolean, scriptVersion:string, meta?:any) : Promise // of InstalledBodies
    {
        var url = "me/installed/" + guid + "/publish?hidden=" + (hidden ? "true" : "false")
        if (scriptVersion)
            url += "&scriptversion=" + encodeURIComponent(scriptVersion)
        if (!meta) meta = {}
        var mergeIds = meta.parentIds
        if (mergeIds)
            url += "&mergeids=" + encodeURIComponent(mergeIds)
        return Util.httpPostJsonAsync(getPrivateApiUrl(url), Cloud.lite ? meta : "")
    }
    export function postApiBatch(bundle: any) : Promise // of BatchResponses
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl(null), bundle);
    }
    export function postBugReportAsync(bug: BugReport) : Promise // of void
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl("bug"), bug);
    }
    export function postTicksAsync(ticks:any) : Promise // of void
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl("ticks"), ticks);
    }
    export function postNotificationsAsync() : Promise // of void
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl("me/notifications"), "");
    }
    export interface PushNotificationRequestBody {
           // Push notification URL;
           // our cloud code will recognize by the URL what the target is. The URL must be understood by System.Uri.TryCreate
           subscriptionuri: string;
           versionminor: number; // minor OS version, e.g. 0
           versionmajor: number; // major OS version, e.g. 4
    }
    export function postNotificationChannelAsync(body: PushNotificationRequestBody) : Promise // of void
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl("me/notificationchannel"), body);
    }
    export function getUserApiKeysAsync(): Promise {
        return Util.httpGetJsonAsync(getPrivateApiUrl("me/keys"));
    }
    export function getUserSettingsAsync(): Promise {
            return Util.httpGetJsonAsync(getPrivateApiUrl("me/settings"));
    }
    export function postUserSettingsAsync(body: UserSettings) : Promise // of void
    {
        return Util.httpPostJsonAsync(getPrivateApiUrl("me/settings"), body);
    }
    export interface AppApiKey
    {
        id : string;
        name : string;
        url : string;
        help: string;
        value : string;
    }
    export function getAppAsync(id:string, appPlatform : string) : Promise // of json
    {
        return Util.httpGetJsonAsync(getPrivateApiUrl(id + "/" + appPlatform + "app"));
    }
    export function postAppAsync(id:string, appPlatform : string, data:any) : Promise // of string
    {
        return Util.httpPostTextAsync(getPrivateApiUrl(id + "/" + appPlatform + "app"), JSON.stringify(data));
    }
    export function getWebAppAsync(id:string) : Promise // of json
    {
        return Util.httpGetJsonAsync(getPrivateApiUrl(id + "/webapp"));
    }
    export function postWebAppAsync(id: string, previewUrl: boolean, data: any): Promise // of string
    {
        return Util.httpPostTextAsync(getPrivateApiUrl(id + "/webapp" + (previewUrl ? "?previewUrl=true" : "")), JSON.stringify(data));
    }
    export function deleteWebAppAsync(id: string): Promise // of string
    {
        return Util.httpDeleteAsync(getPrivateApiUrl(id + "/webapp"));
    }
    export function postAskBetaAsync(accept:boolean) : Promise // of string
    {
        return Util.httpPostTextAsync(getPrivateApiUrl("/me/askbeta?accept=" + accept), "");
    }
    export function postAskSomethingAsync(accept: boolean): Promise // of string
    {
        return Util.httpPostTextAsync(getPrivateApiUrl("/me/asksomething?accept=" + accept), "");
    }
    // ping the server to test if it is online
    // and there is no funny filtering happening
    // this is costly so needs to be used wisely
    export function pingAsync(): Promise // of boolean
    {
        if (/http:\/\/localhost/i.test(document.URL)) return Promise.as(true); // does not work for localhost

        var v = TDev.RT.Math_.random(0xffffff).toString();
        var url = getPublicApiUrl("ping?value=" + encodeURIComponent(v));
        return new Promise((onSuccess: (v: any) => any, onError: (v: any) => any, onProgress: (v: any) => any) => {
            var client: XMLHttpRequest;
            function ready() {
                if (client.readyState == 4)
                    onSuccess(client.status == 200 && client.responseText === v);
            }
            client = new XMLHttpRequest();
            client.onreadystatechange = ready;
            client.open("GET", url);
            client.send();
        });
    }
    export function postPendingProgressAsync() {
        if (!getUserId() || !getAccessToken() || isOffline() || dbg) return Promise.as();
        var data = loadPendingProgress();
        if (Object.keys(data).length == 0) return Promise.as();
        return Cloud.postPrivateApiAsync("me/progress", data)
            .then(
                () => clearPendingProgress(data),
                () => { }); // clear relevant progress records on success, otherwise swallow error
    }

    export function postCommentAsync(id: string, text:string): Promise { // JsonComment
        var req = { kind: "comment", text: text, userplatform: Browser.platformCaps };
        return Cloud.postPrivateApiAsync(id + "/comments", req)
    }
}
