function getServiceEndpointsMap({computeEndpoint, iamEndpoint, rmEndpoint}) {
    return {
        compute: [
            {
                serviceIds: [
                    'yandex.cloud.compute.v1.DiskPlacementGroupService',
                    'yandex.cloud.compute.v1.DiskService',
                    'yandex.cloud.compute.v1.DiskTypeService',
                    'yandex.cloud.compute.v1.FilesystemService',
                    'yandex.cloud.compute.v1.HostGroupService',
                    'yandex.cloud.compute.v1.HostTypeService',
                    'yandex.cloud.compute.v1.ImageService',
                    'yandex.cloud.compute.v1.InstanceService',
                    'yandex.cloud.compute.v1.PlacementGroupService',
                    'yandex.cloud.compute.v1.SnapshotService',
                    'yandex.cloud.compute.v1.ZoneService',
                    'yandex.cloud.compute.v1.instancegroup.InstanceGroupService',
                    'yandex.cloud.compute.v1.SnapshotScheduleService',
                ],
                endpoint: computeEndpoint,
            },
        ],
        iam: [
            {
                serviceIds: [
                    'yandex.cloud.iam.v1.ApiKeyService',
                    'yandex.cloud.iam.v1.IamTokenService',
                    'yandex.cloud.iam.v1.KeyService',
                    'yandex.cloud.iam.v1.RoleService',
                    'yandex.cloud.iam.v1.ServiceAccountService',
                    'yandex.cloud.iam.v1.UserAccountService',
                    'yandex.cloud.iam.v1.YandexPassportUserAccountService',
                    'yandex.cloud.iam.v1.awscompatibility.AccessKeyService',
                ],
                endpoint: iamEndpoint,
            },
        ],
        'resource-manager': [
            {
                serviceIds: [
                    'yandex.cloud.resourcemanager.v1.CloudService',
                    'yandex.cloud.resourcemanager.v1.FolderService',
                ],
                endpoint: rmEndpoint,
            },
        ],
    };
}

module.exports = {getServiceEndpointsMap};
