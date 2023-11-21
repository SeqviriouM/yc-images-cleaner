const path = require('path');

const {Session, cloudApi, serviceClients} = require('@yandex-cloud/nodejs-sdk');
const {ServiceEndpointResolver} = require('@yandex-cloud/nodejs-sdk/dist/service-endpoints');
const dotEnv = require('dotenv');
const cron = require('node-cron');

const dotEnvPath = path.resolve(__dirname, '../.env');
dotEnv.config({path: dotEnvPath});

const {getServiceEndpointsMap} = require('./constants');
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

const CLOUD_ID = getEnv('YC_CLOUD_ID', '');
const SA_ID = getEnv('YC_SA_ID', '');
const SA_ACCESS_KEY_ID = getEnv('YC_SA_ACCESS_KEY_ID', '');
const SA_PRIVATE_KEY = getEnv('YC_SA_PRIVATE_KEY', '');
const FOLDER_IDS = getEnv('YC_FOLDER_IDS', '');

const ORG_CLOUD_ID = getEnv('YC_ORG_CLOUD_ID', '');
const ORG_SA_ID = getEnv('YC_ORG_SA_ID', '');
const ORG_SA_ACCESS_KEY_ID = getEnv('YC_ORG_SA_ACCESS_KEY_ID', '');
const ORG_SA_PRIVATE_KEY = getEnv('YC_ORG_SA_PRIVATE_KEY', '');
const ORG_FOLDER_IDS = getEnv('YC_ORG_FOLDER_IDS', '');

const SAVED_RECENT_IMAGES_COUNT = getEnv('YC_KEEP_IMAGES_COUNT', 30);
const MAX_OPERATIONS_IN_CLOUD = getEnv('YC_MAX_OPERATIONS_IN_CLOUD', 30);

const defaultIsCustomResolver = Boolean(Number(getEnv('YC_CUSTOM_SERVICE_ENDPOINT_RESOLVER', 0)));

const defaultComputeEndpoint = getEnv('YC_COMPUTE_ENDPOINT', '');
const defaultIamEndpoint = getEnv('YC_IAM_ENDPOINT', '');
const defaultRmEndpoint = getEnv('YC_RM_ENDPOINT', '');
const defaultCustomServiceEndpointResolver = new ServiceEndpointResolver(
    getServiceEndpointsMap({
        computeEndpoint: defaultComputeEndpoint,
        iamEndpoint: defaultIamEndpoint,
        rmEndpoint: defaultRmEndpoint,
    }),
);

async function getImagesToCleanInFolder(client, folderId) {
    try {
        const {images} = await client.list(
            ListImagesRequest.fromPartial({pageSize: DEFAULT_PAGE_SIZE, folderId}),
        );

        // Sort from more recent images to older ones
        images.sort((imageA, imageB) => {
            return new Date(imageB.createdAt).getTime() - new Date(imageA.createdAt).getTime();
        });

        return images.slice(SAVED_RECENT_IMAGES_COUNT);
    } catch (error) {
        console.error('An error has occurred while get compute images to clean in folder', error);

        return Promise.reject(error);
    }
}

async function cleaner({
    cloudId,
    saId,
    saKeyId,
    saPrivateKey,
    folderIds,
    isCustomResolver = defaultIsCustomResolver,
    customServiceEndpointResolver = defaultCustomServiceEndpointResolver,
}) {
    const session = new Session(
        {
            serviceAccountJson: {
                serviceAccountId: saId,
                accessKeyId: saKeyId,
                privateKey: saPrivateKey,
            },
        },
        isCustomResolver ? customServiceEndpointResolver : undefined,
    );
    const rmFoldersClient = session.client(serviceClients.FolderServiceClient);
    const computeImagesClient = session.client(serviceClients.ComputeImageServiceClient);

    try {
        const {folders} = await rmFoldersClient.list(
            ListFoldersRequest.fromPartial({pageSize: DEFAULT_PAGE_SIZE, cloudId}),
        );

        const filteredFolders =
            folderIds ? folders.filter(({id}) => folderIds.includes(id)) : folders;

        const imagesToClean = [];
        for (const folder of filteredFolders) {
            const folderImages = await getImagesToCleanInFolder(computeImagesClient, folder.id);

            if (imagesToClean.length + folderImages.length > MAX_OPERATIONS_IN_CLOUD) {
                // If folderImages contains more images that can be simultaneously deleted than then only the valid part is taken
                const endSliceIndex = MAX_OPERATIONS_IN_CLOUD - imagesToClean.length;
                imagesToClean.push(...folderImages.slice(0, endSliceIndex));
                break;
            } else {
                imagesToClean.push(...folderImages);
            }
        }

        // Delete old images
        const imagePromises = imagesToClean.map((image) =>
            computeImagesClient.delete(DeleteImageRequest.fromPartial({imageId: image.id})),
        );

        await Promise.all(imagePromises);

        console.log(`Successfully removed ${imagesToClean.length} old compute images`);
    } catch (error) {
        console.error('An error has occurred while cleaning compute images', error);
    }
}

// For cron purpose
cron.schedule('0 12-18 * * 0-5', async () => {
    const cloudEnv = CLOUD_ID && SA_ID && SA_ACCESS_KEY_ID && SA_PRIVATE_KEY;
    const orgEnv = ORG_CLOUD_ID && ORG_SA_ID && ORG_SA_ACCESS_KEY_ID && ORG_SA_PRIVATE_KEY;

    if (cloudEnv) {
        await cleaner({
            cloudId: CLOUD_ID,
            saId: SA_ID,
            saKeyId: SA_ACCESS_KEY_ID,
            saPrivateKey: SA_PRIVATE_KEY,
            folderIds: FOLDER_IDS,
        }); // console
    }

    if (orgEnv) {
        await cleaner({
            cloudId: ORG_CLOUD_ID,
            saId: ORG_SA_ID,
            saKeyId: ORG_SA_ACCESS_KEY_ID,
            saPrivateKey: ORG_SA_PRIVATE_KEY,
            folderIds: ORG_FOLDER_IDS,
        }); // org
    }

    let envIndex = 0;
    while (true) {
        try {
            const cloudId = getEnv(`YC_CLOUD_ID_${envIndex}`);
            const saId = getEnv(`YC_SA_ID_${envIndex}`);
            const saKeyId = getEnv(`YC_SA_ACCESS_KEY_ID_${envIndex}`);
            const saPrivateKey = getEnv(`YC_SA_PRIVATE_KEY_${envIndex}`);
            const folderIds = getEnv(`YC_FOLDER_IDS_${envIndex}`, '');

            if (!cloudId || !saId || !saKeyId || !saPrivateKey) {
                break;
            }

            const envCustomResolver = getEnv(`YC_CUSTOM_SERVICE_ENDPOINT_RESOLVER_${envIndex}`, '');
            const isCustomResolver =
                envCustomResolver === ''
                    ? defaultIsCustomResolver
                    : Boolean(Number(envCustomResolver));
            const computeEndpoint = getEnv(`YC_COMPUTE_ENDPOINT_${envIndex}`, '');
            const iamEndpoint = getEnv(`YC_IAM_ENDPOINT_${envIndex}`, '');
            const rmEndpoint = getEnv(`YC_RM_ENDPOINT_${envIndex}`, '');
            const customServiceEndpointResolver = new ServiceEndpointResolver(
                getServiceEndpointsMap({
                    computeEndpoint: computeEndpoint || defaultComputeEndpoint,
                    iamEndpoint: iamEndpoint || defaultIamEndpoint,
                    rmEndpoint: rmEndpoint || defaultRmEndpoint,
                }),
            );

            envIndex++;
            await cleaner({
                cloudId,
                saId,
                saKeyId,
                saPrivateKey,
                folderIds,
                isCustomResolver,
                customServiceEndpointResolver,
            });
        } catch (error) {
            break;
        }
    }

    if (!cloudEnv && !orgEnv && !envIndex) {
        console.error('Env variables are not defined');
    }
});

// For module purpose
// module.exports = {cleaner};
