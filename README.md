# yc-images-cleaner

Mini project for cleaning compute images in cloud. A service account with role `editor` on cloud is required for its operation.

## Usage

1. Create a copy of the `.env.example` file and rename it to `.env`, fill in the required values (or necessary env-variables can be passed from the outside).
2. Install dependencies using the command `npm ci`.
3. Launch the application using the command `npm start`.

You can filter folders by YC_FOLDER_IDS variable.

You can add as many bundles of variables as you want. You should use same variables with index. Index start from '0': (YC_CLOUD_ID_0, YC_SA_ID_0, YC_SA_ACCESS_KEY_ID_0, YC_SA_PRIVATE_KEY_0, YC_FOLDER_IDS_0)
