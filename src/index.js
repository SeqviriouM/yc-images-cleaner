const path = require('path');

const {Session, cloudApi, serviceClients} = require('@yandex-cloud/nodejs-sdk');
const {ServiceEndpointResolver} = require('@yandex-cloud/nodejs-sdk/dist/service-endpoints');
const dotEnv = require('dotenv');

const dotEnvPath = path.resolve(__dirname, '../.env');
dotEnv.config({path: dotEnvPath});

const {SERVICE_ENDPOINTS_MAP} = require('./constants');
const {getEnv} = require('./utils');

const {
    compute: {
        image_service: {ListImagesRequest, DeleteImageRequest},
    },
    resourcemanager: {
        folder_service: {ListFoldersRequest},
    },
} = cloudApi;
const DEFAULT_PAGE_SIZE = 1000;
const CLOUD_ID = getEnv('YC_CLOUD_ID');
const SA_ID = getEnv('YC_SA_ID');
const SA_ACCESS_KEY_ID = getEnv('YC_SA_ACCESS_KEY_ID');
const SA_PRIVATE_KEY = getEnv('YC_SA_PRIVATE_KEY');
const SAVED_RECENT_IMAGES_COUNT = getEnv('YC_KEEP_IMAGES_COUNT', 30);

const isCustomResolver = Boolean(Number(getEnv('YC_CUSTOM_SERVICE_ENDPOINT_RESOLVER')));
const customServiceEndpointResolver = new ServiceEndpointResolver(SERVICE_ENDPOINTS_MAP);

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

        return Promise.reject(error);
    }
}

(async () => {
    const session = new Session(
        {
            serviceAccountJson: {
                serviceAccountId: SA_ID,
                accessKeyId: SA_ACCESS_KEY_ID,
                privateKey: SA_PRIVATE_KEY,
            },
        },
        isCustomResolver ? customServiceEndpointResolver : undefined,
    );
    const rmFoldersClient = session.client(serviceClients.FolderServiceClient);
    const computeImagesClient = session.client(serviceClients.ComputeImageServiceClient);

    try {
        const {folders} = await rmFoldersClient.list(
            ListFoldersRequest.fromPartial({pageSize: DEFAULT_PAGE_SIZE, cloudId: CLOUD_ID}),
        );

        for (const folder of folders) {
            cleanImagesInFolder(computeImagesClient, folder.id);
        }
    } catch (error) {
        console.error('An error has occurred while cleaning compute images', error);
    }
})();
