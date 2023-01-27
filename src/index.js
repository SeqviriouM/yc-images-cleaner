const {Session, cloudApi, serviceClients} = require('@yandex-cloud/nodejs-sdk');
const ServiceEndpoints = require('@yandex-cloud/nodejs-sdk/dist/service-endpoints');
const {getEnv} = require('./utils.js');

const {
    compute: {
        image_service: {ListImagesRequest, DeleteImageRequest},
    },
    resourcemanager: {
        folder_service: {ListFoldersRequest},
    },
} = cloudApi;

const DEFAULT_API_ENDPOINT = 'api.cloud.yandex.net:443';
const DEFAULT_PAGE_SIZE = 1000;
const SAVED_RECENT_IMAGES_COUNT = getEnv('YC_KEEP_IMAGES_COUNT', 30);

async function cleanImagesInFolder(client, folderId) {
    try {
        const {images} = await client.list(
            ListImagesRequest.fromPartial({pageSize: DEFAULT_PAGE_SIZE, folderId}),
        );

        // Sort from more recent images to older ones
        images.sort((imageA, imageB) => {
            return new Date(imageB.createdAt).getTime() - new Date(imageA.createdAt).getTime();
        });

        // Delete old images
        const imagePromises = images
            .slice(SAVED_RECENT_IMAGES_COUNT)
            .map((image) => client.delete(DeleteImageRequest.fromPartial({imageId: image.id})));

        return Promise.all(imagePromises);
    } catch (error) {
        console.error('An error has occurred while clean compute images in folder', error);
    }
}

(async () => {
    const sessionConfig = {};

    // check auth by iam token from serverless context
    const iamToken = getEnv('YC_IAM_TOKEN', null);
    if (iamToken) {
        sessionConfig.iamToken = iamToken;
    } else {
        sessionConfig.serviceAccountJson = {
            serviceAccountId: getEnv('YC_SA_ID'),
            accessKeyId: getEnv('YC_SA_ACCESS_KEY_ID'),
            privateKey: getEnv('YC_SA_PRIVATE_KEY'),
        };
    }

    const session = new Session(sessionConfig);
    const apiEndpoint = getEnv('YC_API_ENDPOINT', null);

    const superGetServiceClientEndpoint = ServiceEndpoints.getServiceClientEndpoint;
    ServiceEndpoints.getServiceClientEndpoint = (generatedClientCtor) => {
        let endpoint = superGetServiceClientEndpoint(generatedClientCtor);

        if (apiEndpoint) {
            endpoint = endpoint.replace(DEFAULT_API_ENDPOINT, apiEndpoint);
        }

        return endpoint;
    };

    const rmFoldersClient = session.client(serviceClients.FolderServiceClient);
    const computeImagesClient = session.client(serviceClients.ComputeImageServiceClient);

    try {
        const {folders} = await rmFoldersClient.list(
            ListFoldersRequest.fromPartial({
                pageSize: DEFAULT_PAGE_SIZE,
                cloudId: getEnv('YC_CLOUD_ID'),
            }),
        );

        for (const folder of folders) {
            cleanImagesInFolder(computeImagesClient, folder.id);
        }
    } catch (error) {
        console.error('An error has occurred while cleaning compute images', error);
    }
})();
