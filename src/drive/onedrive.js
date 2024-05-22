import oneDriveAPI from "onedrive-api";
import { AuthorizationCode } from "simple-oauth2";


export class OneDriveFile{
    constructor(id, name, size, type, downloadUrl, original){
        this.id = id;
        this.name = name;
        this.size = size;
        this.type = type;
        this.downloadUrl = downloadUrl;
        this.original = original;
    }

    getDownloadUrl(){
        return this.downloadUrl;
    }

    getThumbnailUrl(){
        if (this.original.thumbnails.length > 0) {
            return this.original.thumbnails[0].medium.url;
        }

        return null;
    }

    static fromJson(json){
        return new OneDriveFile(
            json.id,
            json.name,
            json.size,
            json.file.mimeType,
            json['@content.downloadUrl'] || json['@microsoft.graph.downloadUrl'],
            json
        )
    }
}

export class OneDriveFolder{
    constructor(id, name, original){
        this.id = id;
        this.name = name;
        this.original = original;
    }

    static fromJson(json){
        return new OneDriveFolder(
            json.id,
            json.name,
            json
        )
    }
}

export class OneDriveAccessToken{
    constructor(accessToken, refreshToken, expiresAt){
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresAt = expiresAt;
    }
}

export class OneDriveBridge{
    static currentAccessToken = null;

    static async getItemsInFolder(folderId = '342C26028B941029!310694'){
        return new Promise(async (resolve, reject) => {
            oneDriveAPI.items
            .listChildren({
                accessToken: (await OneDriveBridge.getAccessToken()).accessToken,
                itemId: folderId,
                drive: "me",
                driveId: "",
            }).then((res) => {
                const items = res.value.map((item) => {
                    if(item.folder){
                        return OneDriveFolder.fromJson(item)
                    }else{
                        return OneDriveFile.fromJson(item)
                    }
                })

                resolve({
                    files: items.filter((item) => item instanceof OneDriveFile),
                    folders: items.filter((item) => item instanceof OneDriveFolder)
                })
            }).catch((err) => {
                reject(err)
            })
        })
        
    }



    static async getAccessToken(){
        return new Promise(async (resolve, reject) => {
            if (OneDriveBridge.currentAccessToken == null){
                const servedToken = await ((await fetch('https://intra.imedicineapp.com/revacheck/token.php?action=retrieve-access-token&secret=' + process.env.REVACHECK_ONEDRIVE_INTRA_SECRET)).json());
                OneDriveBridge.currentAccessToken = new OneDriveAccessToken(servedToken['ACCESS_TOKEN'], servedToken['REFRESH_TOKEN'], servedToken['EXPIRES_AT']);
                const response = await OneDriveBridge.getAccessToken();
                resolve(response);
            }
    
            if (new Date(OneDriveBridge.currentAccessToken.expiresAt) < new Date()) {
                const msCredentials = await ((await fetch('https://intra.imedicineapp.com/revacheck/token.php?action=retrieve-ms-credentials&secret=' + process.env.REVACHECK_ONEDRIVE_INTRA_SECRET)).json());
    
                const client = new AuthorizationCode({
                    client: {
                        id: msCredentials.CLIENT_ID,
                        secret: msCredentials.CLIENT_SECRET,
                    },
                    auth: {
                        tokenHost: 'https://login.live.com',
                        tokenPath: '/oauth20_token.srf',
                        authorizePath: '/oauth20_authorize.srf',
                    },
                    options: {
                        authorizationMethod: 'body',
                    },
                });
    
                const validToken = {
                    access_token: OneDriveBridge.currentAccessToken.accessToken,
                    refresh_token: OneDriveBridge.currentAccessToken.refreshToken,
                    expires_in: 3600,
                    token_type: "Bearer",
                    scope: "files.read.all offline_access",
                };
                const accessToken = client.createToken(validToken);
                const refershedToken = await accessToken.refresh();

    
                OneDriveBridge.currentAccessToken = new OneDriveAccessToken(refershedToken.token.access_token, refershedToken.token.refresh_token, (new Date(refershedToken.token.expires_at)).toISOString());
    
                const formData = new FormData();
                formData.append('access_token', OneDriveBridge.currentAccessToken.accessToken);
                formData.append('refresh_token', OneDriveBridge.currentAccessToken.refreshToken);
                formData.append('expires_at', OneDriveBridge.currentAccessToken.expiresAt);
                formData.append('action', 'store-access-token')
                formData.append('secret', process.env.REVACHECK_ONEDRIVE_INTRA_SECRET);
    
                const response = await (await fetch('https://intra.imedicineapp.com/revacheck/token.php', {
                    method: 'POST',
                    body: formData
                })).json();

                console.log(response);

                resolve(OneDriveBridge.currentAccessToken)
            }else{
                resolve(OneDriveBridge.currentAccessToken)
            }
        })
    }
}
